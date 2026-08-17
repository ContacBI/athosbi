export function parseCsv(text, delimiter = ";") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((item) => item !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((item) => item.replace(/^\uFEFF/, "").trim());
  return rows.map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ""])));
}

export async function readCsvFile(file) {
  return parseCsv(await file.text());
}
