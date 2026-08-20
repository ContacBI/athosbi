export async function readXlsxFirstSheet(file) {
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);
  const sharedStrings = await readSharedStrings(entries);
  const sheetPath = await firstSheetPath(entries);
  const sheetXml = await zipText(entries, sheetPath);
  return parseSheetXml(sheetXml, sharedStrings);
}

function parseZipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("arquivo XLSX inválido");
  const view = new DataView(buffer);
  const total = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const entries = {};
  let pos = centralOffset;
  for (let i = 0; i < total; i += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const fileNameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + fileNameLength));
    entries[name] = { buffer, method, compressedSize, localOffset };
    pos += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function zipText(entries, name) {
  const entry = entries[name];
  if (!entry) throw new Error(`não encontrei ${name} dentro do XLSX`);
  const view = new DataView(entry.buffer);
  const bytes = new Uint8Array(entry.buffer);
  const local = entry.localOffset;
  const fileNameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const start = local + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  let data;
  if (entry.method === 0) {
    data = compressed;
  } else if (entry.method === 8 && "DecompressionStream" in window) {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    data = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error("compressão do XLSX não suportada neste navegador");
  }
  return new TextDecoder("utf-8").decode(data);
}

// A real combined diário export can be enormous once decompressed — one
// file the size of a photo (~10MB zipped) unpacks to 70+MB of raw XML with
// 200k+ rows. DOMParser building a full DOM tree over that (the previous
// approach here, and also what getElementsByTagNameNS was walking per row
// AND per cell) is what made big files look "stuck": tens of seconds of
// synchronous, memory-heavy work blocking the tab with nothing on screen to
// show for it, easy to mistake for a crash. Regex-scanning the raw XML text
// instead — never building a DOM at all — parses the same 200k-row file in
// a couple of seconds. Verified byte-for-byte identical output against
// SheetJS on a real 208k-row export (every cell, not just spot-checked)
// before this replaced the DOM-based version.
function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

// Attribute quoting isn't always double quotes in the wild — files from
// some accounting systems' own export engines use single quotes
// (`t='s'` rather than `t="s"`), both valid XML.
function parseSharedStrings(xml) {
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let siMatch;
  while ((siMatch = siRegex.exec(xml))) {
    let text = "";
    let tMatch;
    tRegex.lastIndex = 0;
    while ((tMatch = tRegex.exec(siMatch[1]))) text += decodeXmlEntities(tMatch[1]);
    strings.push(text);
  }
  return strings;
}

async function readSharedStrings(entries) {
  if (!entries["xl/sharedStrings.xml"]) return [];
  return parseSharedStrings(await zipText(entries, "xl/sharedStrings.xml"));
}

async function firstSheetPath(entries) {
  if (entries["xl/workbook.xml"] && entries["xl/_rels/workbook.xml.rels"]) {
    const workbook = new DOMParser().parseFromString(await zipText(entries, "xl/workbook.xml"), "application/xml");
    const firstSheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
    const relId = firstSheet?.getAttribute("r:id");
    const rels = new DOMParser().parseFromString(await zipText(entries, "xl/_rels/workbook.xml.rels"), "application/xml");
    const rel = Array.from(rels.getElementsByTagNameNS("*", "Relationship")).find((item) => item.getAttribute("Id") === relId);
    const target = rel?.getAttribute("Target");
    if (target) return `xl/${target.replace(/^\/+/, "")}`;
  }
  return "xl/worksheets/sheet1.xml";
}

function parseSheetXml(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xml))) {
    const rowXml = rowMatch[1] || "";
    const values = [];
    let autoCol = 0;
    let cellMatch;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowXml))) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const refMatch = attrs.match(/ r=["']([A-Z]+)\d+["']/);
      const col = refMatch ? columnIndex(refMatch[1]) : autoCol;
      autoCol = col + 1;
      const typeMatch = attrs.match(/ t=["']([a-z]+)["']/);
      const type = typeMatch ? typeMatch[1] : null;
      let value; // stays undefined for a genuinely empty cell (no <v>/<t> at all)
      if (inner) {
        const vMatch = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (vMatch) value = decodeXmlEntities(vMatch[1]);
        else if (tMatch) value = decodeXmlEntities(tMatch[1]);
      }
      values[col] = value === undefined ? "" : type === "s" ? sharedStrings[Number(value)] || "" : value;
    }
    rows.push(values);
  }
  return rows;
}

function columnIndex(col) {
  let index = 0;
  for (const char of col) index = index * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}
