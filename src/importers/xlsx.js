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

async function readSharedStrings(entries) {
  if (!entries["xl/sharedStrings.xml"]) return [];
  const xml = await zipText(entries, "xl/sharedStrings.xml");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagNameNS("*", "si")).map((si) =>
    Array.from(si.getElementsByTagNameNS("*", "t")).map((t) => t.textContent || "").join("")
  );
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
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagNameNS("*", "row")).map((row) => {
    const values = [];
    Array.from(row.getElementsByTagNameNS("*", "c")).forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const col = columnIndex(ref.replace(/[0-9]/g, ""));
      const type = cell.getAttribute("t");
      const valueNode = cell.getElementsByTagNameNS("*", "v")[0];
      const inlineNode = cell.getElementsByTagNameNS("*", "t")[0];
      let value = valueNode?.textContent ?? inlineNode?.textContent ?? "";
      if (type === "s") value = sharedStrings[Number(value)] || "";
      values[col] = value;
    });
    return values;
  });
}

function columnIndex(col) {
  let index = 0;
  for (const char of col) index = index * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, index - 1);
}
