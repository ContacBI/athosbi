import { readXlsxFirstSheet } from "./xlsx.js";
import { parseCsv } from "./csv.js";

export async function importBalancete(file) {
  return accountsFromTrialBalance(await readXlsxFirstSheet(file));
}

export async function importDiario(file, mappingRows = []) {
  if (isCsvFile(file)) return journalFromCsvRows(parseCsv(await file.text()), mappingRows);
  return journalFromRows(await readXlsxFirstSheet(file), mappingRows);
}

export function accountsFromTrialBalance(rows) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeText(cell) === "codigo"));
  if (headerIndex < 0) return accountsFromStructuredBalance(rows);
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const header = Array.from({ length: width }, (_, index) => normalizeText(rows[headerIndex][index]));
  const findCol = (...patterns) => header.findIndex((item) => patterns.some((pattern) => String(item || "").includes(pattern)));
  const codeCol = findCol("codigo");
  const classCol = findCol("classificacao");
  const descCol = findCol("descricao");
  const previousCol = findCol("saldo anterior");
  const debitCol = findCol("debito");
  const creditCol = findCol("credito");
  const currentCol = findCol("saldo atual");
  if (codeCol < 0 || descCol < 0) return [];

  const raw = rows.slice(headerIndex + 1).map((row) => {
    const codigo = String(row[codeCol] ?? "").trim().replace(",", ".");
    const originalName = String(row[descCol] ?? "");
    const nome = originalName.trim();
    if (!codigo || !nome || !/^\d+(\.\d+)?$/.test(codigo)) return null;
    const spaces = originalName.length - originalName.replace(/^\s+/, "").length;
    return {
      codigo: String(Number(codigo)),
      classificacao: classCol >= 0 && row[classCol] ? String(row[classCol]).trim() : String(Number(codigo)),
      nome_conta: nome,
      tipo_sintetica: "nao",
      grau: String(Math.max(1, Math.round(spaces / 3) + 1)),
      saldo_anterior: toNumber(previousCol >= 0 ? row[previousCol] : 0),
      debito: toNumber(debitCol >= 0 ? row[debitCol] : 0),
      credito: toNumber(creditCol >= 0 ? row[creditCol] : 0),
      saldo_atual: toNumber(currentCol >= 0 ? row[currentCol] : 0),
    };
  }).filter(Boolean);

  raw.forEach((account, index) => {
    const next = raw[index + 1];
    account.tipo_sintetica = next && Number(next.grau) > Number(account.grau) ? "sim" : "nao";
  });
  return raw;
}

function accountsFromStructuredBalance(rows) {
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeText);
    return normalized.includes("saldo inicial") && normalized.includes("saldo final");
  });
  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

  return rows.slice(startIndex).map((row) => {
    const codeCol = numericAccountCode(row[3]) ? 3 : numericAccountCode(row[5]) ? 5 : -1;
    const nameCol = codeCol === 3 || codeCol === 5 ? 4 : -1;
    const codigo = codeCol >= 0 ? String(Number(String(row[codeCol]).trim().replace(",", "."))) : "";
    const nome = nameCol >= 0 ? String(row[nameCol] ?? "").trim() : "";
    if (!codigo || !nome) return null;
    const saldoAnterior = toNumber(row[6]);
    const saldoAtual = toNumber(row[7]);
    const movimento = saldoAtual - saldoAnterior;
    return {
      codigo,
      classificacao: codigo,
      nome_conta: nome,
      tipo_sintetica: "nao",
      grau: String(Math.max(1, nameCol + 1)),
      saldo_anterior: saldoAnterior,
      debito: movimento > 0 ? movimento : 0,
      credito: movimento < 0 ? Math.abs(movimento) : 0,
      saldo_atual: saldoAtual,
    };
  }).filter(Boolean);
}

export function journalFromRows(rows, mappingRows = []) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeText(cell) === "data"));
  if (headerIndex < 0) return [];
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const header = Array.from({ length: width }, (_, index) => normalizeText(rows[headerIndex][index]));
  const findCol = (...patterns) => header.findIndex((item) => patterns.some((pattern) => String(item || "").includes(pattern)));
  const dateCol = findCol("data");
  const descCol = findCol("descricao", "nome da conta");
  const reducedCodeCol = reducedCodeColumn(rows, headerIndex, descCol);
  const classCol = findCol("classificacao") >= 0 ? findCol("classificacao") : reducedCodeCol;
  const historyCol = findCol("historico", "hist");
  const debitCol = findCol("debito");
  const creditCol = findCol("credito");
  const dcCol = findCol("d/c", "dc");
  const valueCol = findCol("valor numerico") >= 0 ? findCol("valor numerico") : findCol("valor");
  if (dateCol < 0 || classCol < 0 || descCol < 0 || historyCol < 0) return [];
  const mapping = new Map(mappingRows.map((row) => [row.classificacao, row]));
  return rows.slice(headerIndex + 1).map((row, offset) => {
    const date = row[dateCol];
    const classificacao = cleanAccountCode(row[classCol]);
    const descricao = String(row[descCol] ?? "").trim();
    const historico = String(row[historyCol] ?? "").trim();
    const dc = normalizeText(row[dcCol] || "");
    const value = toNumber(valueCol >= 0 ? row[valueCol] : 0);
    const debito = debitCol >= 0 ? toNumber(row[debitCol]) : dc === "d" ? value : 0;
    const credito = creditCol >= 0 ? toNumber(row[creditCol]) : dc === "c" ? value : 0;
    if (!date || !classificacao || !descricao || !historico || (!debito && !credito)) return null;
    const map = mapping.get(classificacao) || {};
    return {
      linha_origem: String(headerIndex + offset + 2),
      data: excelDate(date),
      classificacao,
      descricao_conta: descricao,
      historico,
      debito,
      credito,
      valor_liquido: debito - credito,
      codigo_gerencial: map.codigo_gerencial || "",
      categoria_gerencial: map.categoria_gerencial || "",
      demonstrativo: map.demonstrativo || "",
      grupo_macro: map.grupo_macro || "",
    };
  }).filter(Boolean);
}

function reducedCodeColumn(rows, headerIndex, beforeCol = -1) {
  const sample = rows.slice(headerIndex + 1, headerIndex + 51);
  const scores = [];
  const width = beforeCol > 0 ? beforeCol : Math.max(...sample.map((row) => row.length), 0);
  for (let col = 0; col < width; col += 1) {
    const numericValues = sample.map((row) => row[col]).filter(numericAccountCode);
    const hits = numericValues.length;
    const averageLength = hits
      ? numericValues.reduce((sum, value) => sum + String(value).trim().length, 0) / hits
      : 0;
    if (hits) scores.push({ col, hits, averageLength });
  }
  const preferred = scores
    .filter((item) => item.col > 0)
    .sort((a, b) => b.hits - a.hits || a.averageLength - b.averageLength || a.col - b.col)[0];
  return preferred?.col ?? -1;
}

export function journalFromCsvRows(rows, mappingRows = []) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0] || {});
  const findKey = (...patterns) => keys.find((key) => patterns.some((pattern) => normalizeText(key).includes(pattern)));
  const dateKey = findKey("data");
  const classKey = findKey("classificacao", "n da conta", "no da conta", "numero da conta", "conta");
  const descKey = findKey("nome da conta", "descricao");
  const historyKey = findKey("historico");
  const debitKey = findKey("debito");
  const creditKey = findKey("credito");
  const dcKey = findKey("d/c", "dc");
  const valueKey = findKey("valor numerico") || findKey("valor");
  if (!dateKey || !classKey || !descKey || !historyKey) return [];

  const mapping = new Map(mappingRows.map((row) => [row.classificacao, row]));
  return rows.map((row, offset) => {
    const date = row[dateKey];
    const classificacao = cleanAccountCode(row[classKey]);
    const descricao = String(row[descKey] ?? "").trim();
    const historico = String(row[historyKey] ?? "").trim();
    const dc = normalizeText(row[dcKey] || "");
    const value = toNumber(valueKey ? row[valueKey] : 0);
    const debito = debitKey ? toNumber(row[debitKey]) : dc === "d" ? value : 0;
    const credito = creditKey ? toNumber(row[creditKey]) : dc === "c" ? value : 0;
    if (!date || !classificacao || !descricao || !historico || (!debito && !credito)) return null;
    const map = mapping.get(classificacao) || {};
    return {
      linha_origem: String(offset + 2),
      data: excelDate(date),
      classificacao,
      descricao_conta: descricao,
      historico,
      debito,
      credito,
      valor_liquido: debito - credito,
      codigo_gerencial: map.codigo_gerencial || "",
      categoria_gerencial: map.categoria_gerencial || "",
      demonstrativo: map.demonstrativo || "",
      grupo_macro: map.grupo_macro || "",
    };
  }).filter(Boolean);
}

function isCsvFile(file) {
  return String(file?.name || "").toLowerCase().endsWith(".csv") || String(file?.type || "").includes("csv");
}

function numericAccountCode(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(text);
}

function cleanAccountCode(value) {
  return String(value ?? "").trim().replace(/^#N\/D$/i, "");
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  const numeric = raw.replace(/[^\d,.-]/g, "");
  const text = numeric.includes(",") ? numeric.replace(/\./g, "").replace(",", ".") : numeric;
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function excelDate(value) {
  const text = String(value ?? "").trim();
  const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
  if (!/^\d+(\.\d+)?$/.test(text)) return text.slice(0, 10);
  const serial = Number(value);
  if (serial < 30000) return String(value);
  const utc = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(utc).toISOString().slice(0, 10);
}
