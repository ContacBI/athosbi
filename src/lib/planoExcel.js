import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { state } from "../data/useStore.js";
import { fetchBasePlano } from "./planoStore.js";

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Depth-first, parent-then-children order — same order the tree view in
// Parâmetros → Sistema shows, so the spreadsheet reads naturally instead of
// however the rows happen to sit in the array.
function sortForExport(rows) {
  const byCode = new Map(rows.map((row) => [row.codigo_gerencial, row]));
  const byParent = new Map();
  rows.forEach((row) => {
    const parts = row.codigo_gerencial.split(".");
    const parentCode = parts.slice(0, -1).join(".");
    const key = parts.length > 1 && byCode.has(parentCode) ? parentCode : "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  });
  byParent.forEach((list) => list.sort((a, b) => a.codigo_gerencial.localeCompare(b.codigo_gerencial, "pt-BR", { numeric: true })));
  const ordered = [];
  function visit(code) {
    (byParent.get(code) || []).forEach((row) => {
      ordered.push(row);
      visit(row.codigo_gerencial);
    });
  }
  visit("__root__");
  return ordered;
}

// Same color language as the accounting reports (reportExcel.js /
// reportPdf.js): the more synthetic a line is, the stronger the highlight —
// level 1 gets the strongest tint, fading out through level 4+. Analítica
// rows (the account-folhas — the only ones that actually take a De/Para)
// stay completely plain, no fill, no bold, so they read as "blank" against
// the highlighted structure above them.
const LEVEL_STYLE = {
  1: { fill: "FFD9F99D", border: "FF4D7C0F" },
  2: { fill: "FFECFCCB", border: "FF65A30D" },
  3: { fill: "FFEEF7DE", border: "FF84A874" },
  4: { fill: "FFF2F7E9", border: "FF9CB68F" },
};

function styleForRow(row) {
  const isAnalytic = normalize(row.natureza || "Analitica") === "analitica";
  if (isAnalytic) return null;
  const level = Math.min(4, Math.max(1, Number(row.nivel || 1)));
  return LEVEL_STYLE[level];
}

// A real .xlsx (not the HTML-disguised-as-.xls trick used elsewhere in the
// app, and via exceljs rather than the xlsx/SheetJS package used for
// parsing below — the free tier of that one silently drops all cell
// styling) — this one's meant to be worked in, not just glanced at:
// autofilter, a frozen header row, sensible column widths, color/bold
// emphasis that scales with how synthetic each line is, and every row
// grouped at its hierarchy level so Excel's own +/- outline controls can
// collapse it the same way the tree view does. A second sheet spells out
// what each column expects, since there's no cell-level dropdown
// validation available either way.
export async function exportPlanoExcel() {
  const rows = sortForExport(state.plano);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plano gerencial", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Código", key: "codigo", width: 16 },
    { header: "Demonstrativo", key: "demonstrativo", width: 14 },
    { header: "Grupo", key: "grupo", width: 22 },
    { header: "Nome", key: "nome", width: 48 },
    { header: "Nível", key: "nivel", width: 8 },
    { header: "Natureza", key: "natureza", width: 12 },
    { header: "Aceita De/Para", key: "aceita", width: 14 },
    { header: "Observação", key: "observacao", width: 32 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF152033" } };
  headerRow.alignment = { vertical: "middle" };

  rows.forEach((row) => {
    const excelRow = sheet.addRow({
      codigo: row.codigo_gerencial,
      demonstrativo: row.demonstrativo,
      grupo: row.grupo_macro,
      // No manual indentation — the Nível column, the color scale below, and
      // Excel's own outline controls already carry the hierarchy, so the
      // text itself stays normally aligned instead of padded with spaces.
      nome: row.nome,
      nivel: Number(row.nivel || 1),
      // A handful of base rows shipped with no natureza set at all (a gap in
      // the original CSV, not something meant to stay blank) — default them
      // to Analitica on the way out so the sheet never hands back a value
      // the importer would then reject on an untouched re-upload.
      natureza: row.natureza || "Analitica",
      aceita: row.aceita_depara,
      observacao: row.observacao || "",
    });

    const style = styleForRow(row);
    if (style) {
      excelRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
        cell.border = { top: { style: "thin", color: { argb: style.border } } };
      });
    }

    excelRow.outlineLevel = Math.min(7, Math.max(0, Number(row.nivel || 1) - 1));
  });

  sheet.autoFilter = { from: "A1", to: `H${rows.length + 1}` };

  const legend = workbook.addWorksheet("Como preencher");
  legend.columns = [
    { header: "Campo", key: "campo", width: 20 },
    { header: "O que aceita", key: "explicacao", width: 90 },
  ];
  legend.getRow(1).font = { bold: true };
  [
    ["Código", "Segmentos separados por ponto (ex.: 01.01.05). O código pai (01.01) precisa existir em alguma outra linha da planilha."],
    ["Demonstrativo", "DRE ou BP"],
    [
      "Natureza",
      "Sintetica (subcategoria, pode ter contas dentro), Analitica (conta-folha — essa é a que aceita De/Para) ou Subtotal (linha calculada da DRE, tipo \"Lucro bruto\" — não mexe)",
    ],
    ["Aceita De/Para", "sim ou nao — normalmente sim só nas Analíticas"],
    ["Nível", "Recalculado sozinho a partir do código ao importar — pode deixar como está ou nem preencher."],
    ["", ""],
    ["Pra adicionar uma conta nova", "Copie uma linha parecida, troque o código pro próximo disponível dentro do mesmo pai, e o nome."],
  ].forEach((entry) => legend.addRow(entry));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plano_gerencial_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const YES_VALUES = new Set(["sim", "s", "yes", "y", "true", "1"]);

function normalizeYesNo(value) {
  return YES_VALUES.has(normalize(value)) ? "sim" : "nao";
}

function findColumn(header, labels) {
  return header.findIndex((cell) => labels.some((label) => cell.includes(normalize(label))));
}

// Reads any sheet shaped like the one exportPlanoExcel() produces (matches
// columns by name, not position, so reordering columns in Excel doesn't
// break it) and validates it thoroughly before ever touching the app's
// data — a bad upload should never be able to leave the plano half-broken.
export async function parsePlanoExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.find((name) => normalize(name) !== normalize("Como preencher")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { errors: ["Não encontrei nenhuma planilha nesse arquivo."] };

  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (raw.length < 2) return { errors: ["A planilha está vazia."] };

  const header = raw[0].map((cell) => normalize(cell));
  const idx = {
    codigo: findColumn(header, ["codigo"]),
    demonstrativo: findColumn(header, ["demonstrativo"]),
    grupo: findColumn(header, ["grupo"]),
    nome: findColumn(header, ["nome"]),
    natureza: findColumn(header, ["natureza"]),
    aceita: findColumn(header, ["aceita"]),
    observacao: findColumn(header, ["observ"]),
  };
  if (idx.codigo === -1 || idx.nome === -1 || idx.demonstrativo === -1) {
    return { errors: ['A planilha precisa ter pelo menos as colunas "Código", "Demonstrativo" e "Nome".'] };
  }

  const parsed = raw
    .slice(1)
    .map((cells, index) => ({
      rowNumber: index + 2,
      codigo_gerencial: String(cells[idx.codigo] ?? "").trim(),
      demonstrativo: String(cells[idx.demonstrativo] ?? "").trim().toUpperCase(),
      grupo_macro: idx.grupo >= 0 ? String(cells[idx.grupo] ?? "").trim() : "",
      nome: String(cells[idx.nome] ?? "").trim(),
      natureza: idx.natureza >= 0 ? String(cells[idx.natureza] ?? "").trim() : "",
      aceita_depara: idx.aceita >= 0 ? normalizeYesNo(cells[idx.aceita]) : "nao",
      observacao: idx.observacao >= 0 ? String(cells[idx.observacao] ?? "").trim() : "",
    }))
    .filter((row) => row.codigo_gerencial || row.nome);

  const errors = [];
  const seenAt = new Map();
  parsed.forEach((row) => {
    if (!row.codigo_gerencial) errors.push(`Linha ${row.rowNumber}: sem código.`);
    if (!row.nome) errors.push(`Linha ${row.rowNumber}: sem nome.`);
    if (row.demonstrativo !== "DRE" && row.demonstrativo !== "BP") {
      errors.push(`Linha ${row.rowNumber} (${row.codigo_gerencial || "sem código"}): demonstrativo "${row.demonstrativo}" inválido — use DRE ou BP.`);
    }
    if (!["sintetica", "analitica", "subtotal"].includes(normalize(row.natureza))) {
      errors.push(`Linha ${row.rowNumber} (${row.codigo_gerencial || "sem código"}): natureza "${row.natureza}" inválida — use Sintetica, Analitica ou Subtotal.`);
    }
    if (row.codigo_gerencial) {
      if (seenAt.has(row.codigo_gerencial)) {
        errors.push(`Código repetido "${row.codigo_gerencial}" nas linhas ${seenAt.get(row.codigo_gerencial)} e ${row.rowNumber}.`);
      }
      seenAt.set(row.codigo_gerencial, row.rowNumber);
    }
  });

  const codes = new Set(parsed.map((row) => row.codigo_gerencial));
  parsed.forEach((row) => {
    const parts = row.codigo_gerencial.split(".");
    if (parts.length <= 1) return;
    const parentCode = parts.slice(0, -1).join(".");
    if (!codes.has(parentCode)) {
      errors.push(`Linha ${row.rowNumber} (${row.codigo_gerencial}): o código pai "${parentCode}" não existe nessa planilha.`);
    }
  });

  if (errors.length) return { errors: errors.slice(0, 30) };

  const base = await fetchBasePlano();
  const baseCodes = new Set(base.map((row) => row.codigo_gerencial));
  const rows = parsed.map((row) => ({
    codigo_gerencial: row.codigo_gerencial,
    demonstrativo: row.demonstrativo,
    grupo_macro: row.grupo_macro,
    nome: row.nome,
    // Always recomputed from the code's own segment count — never trusted
    // from the sheet — so it can't drift out of sync with the hierarchy.
    nivel: String(row.codigo_gerencial.split(".").length),
    natureza:
      normalize(row.natureza) === "sintetica" ? "Sintetica" : normalize(row.natureza) === "subtotal" ? "Subtotal" : "Analitica",
    aceita_depara: row.aceita_depara,
    observacao: row.observacao,
    sinal_padrao: "Neutro",
    dfc_numero: "",
    dfc_codigo: "",
    dfc_descricao: "",
    ...(baseCodes.has(row.codigo_gerencial) ? {} : { custom: true }),
  }));

  return { rows, errors: [] };
}
