import * as XLSX from "xlsx";
import { state } from "../data/useStore.js";
import { fetchBasePlano } from "./planoStore.js";
import { effectivePlano } from "./planosPadrao.js";

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

// As cores das planilhas do portal (excelVisual.js): quanto mais sintética
// a linha, mais destaque — nível 1 com a faixa clara e o fio laranja,
// sintéticas em negrito, as analíticas (as contas-folha, as únicas que
// recebem De/Para) em cinza, sem destaque nenhum.
function isAnalyticRow(row) {
  return normalize(row.natureza || "Analitica") === "analitica";
}

// Um .xlsx de verdade (via exceljs — o xlsx/SheetJS usado na leitura, mais
// abaixo, perde toda a formatação na versão gratuita) pra ser trabalhado,
// não só lido: filtro, cabeçalho fixo, larguras boas, destaque por nível e
// cada linha agrupada no nível dela (o +/− do Excel recolhe a árvore igual à
// tela). A importação lê a 1ª linha como títulos (parsePlanoExcelFile) —
// por isso aqui não vai o cabeçalho com a logo dos relatórios. Uma 2ª aba
// explica o que cada coluna aceita.
//
// Compartilhada entre o Plano gerencial global (exportPlanoExcel) e
// qualquer Plano padrão específico (exportPlanoPadraoExcel) — a única
// diferença de verdade é QUAIS linhas entram (global puro vs. global +
// extras de um plano) e o nome da aba/arquivo.
async function buildPlanoWorkbook(rows, sheetName) {
  const { COR, argb } = await import("./exportVisual.js");
  const { fio, fonte, impressao, linhaDeTitulos, novaPasta, preenchido } = await import("./excelVisual.js");
  const workbook = novaPasta();
  const sheet = workbook.addWorksheet(sheetName, {
    properties: { tabColor: { argb: argb(COR.acento) }, outlineProperties: { summaryBelow: false, summaryRight: false } },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });

  sheet.columns = [
    { key: "codigo", width: 16 },
    { key: "demonstrativo", width: 15 },
    { key: "grupo", width: 22 },
    { key: "nome", width: 52 },
    { key: "nivel", width: 8 },
    { key: "natureza", width: 12 },
    { key: "aceita", width: 15 },
    { key: "observacao", width: 34 },
  ];
  linhaDeTitulos(sheet, 1, ["Código", "Demonstrativo", "Grupo", "Nome", "Nível", "Natureza", "Aceita De/Para", "Observação"], { alinhar: (i) => (i === 4 ? "center" : "left") });

  let maiorNivel = 0;
  rows.forEach((row) => {
    const nivel = Number(row.nivel || 1);
    const excelRow = sheet.addRow({
      codigo: row.codigo_gerencial,
      demonstrativo: row.demonstrativo,
      grupo: row.grupo_macro,
      nome: row.nome,
      nivel,
      // A handful of base rows shipped with no natureza set at all (a gap in
      // the original CSV, not something meant to stay blank) — default them
      // to Analitica on the way out so the sheet never hands back a value
      // the importer would then reject on an untouched re-upload.
      natureza: row.natureza || "Analitica",
      aceita: row.aceita_depara,
      observacao: row.observacao || "",
    });
    const analitica = isAnalyticRow(row);
    const destaque = !analitica && nivel <= 1;
    excelRow.height = 18;
    excelRow.eachCell({ includeEmpty: true }, (cell, coluna) => {
      cell.border = fio;
      cell.font = fonte({ bold: !analitica, color: { argb: argb(analitica ? COR.tinta2 : COR.tinta) } });
      // O recuo do nome é só visual (alinhamento), o texto continua o mesmo.
      cell.alignment = { vertical: "middle", horizontal: coluna === 5 ? "center" : "left", indent: coluna === 4 ? Math.min(6, nivel - 1) * 2 : 0 };
      if (destaque) cell.fill = preenchido(COR.acentoSuave);
    });
    if (destaque) excelRow.getCell(1).border = { ...fio, left: { style: "thick", color: { argb: argb(COR.acento) } } };
    excelRow.outlineLevel = Math.min(6, Math.max(0, nivel - 1));
    maiorNivel = Math.max(maiorNivel, excelRow.outlineLevel);
  });
  // Um nível acima do mais fundo: senão o ExcelJS grava as linhas mais
  // fundas como "recolhidas" e a planilha abre fechada.
  sheet.properties.outlineLevelRow = maiorNivel + 1;

  sheet.autoFilter = { from: "A1", to: `H${rows.length + 1}` };
  impressao(sheet, { empresa: sheetName, paisagem: true, linhaDoCabecalho: 1 });

  const legend = workbook.addWorksheet("Como preencher", { views: [{ showGridLines: false }] });
  legend.columns = [
    { key: "campo", width: 28 },
    { key: "explicacao", width: 100 },
  ];
  linhaDeTitulos(legend, 1, ["Campo", "O que aceita"], { alinhar: () => "left" });
  [
    ["Código", "Segmentos separados por ponto (ex.: 01.01.05). O código pai (01.01) precisa existir em alguma outra linha da planilha."],
    ["Demonstrativo", "DRE ou BP"],
    [
      "Natureza",
      "Sintetica (subcategoria, pode ter contas dentro), Analitica (conta-folha — essa é a que aceita De/Para) ou Subtotal (linha calculada da DRE, tipo \"Lucro bruto\" — não mexe)",
    ],
    ["Aceita De/Para", "sim ou nao — normalmente sim só nas Analíticas"],
    ["Nível", "Recalculado sozinho a partir do código ao importar — pode deixar como está ou nem preencher."],
    ["Pra adicionar uma conta nova", "Copie uma linha parecida, troque o código pro próximo disponível dentro do mesmo pai, e o nome."],
  ].forEach((entry) => {
    const linha = legend.addRow(entry);
    linha.eachCell((cell, coluna) => {
      cell.font = fonte({ bold: coluna === 1 });
      cell.alignment = { vertical: "top", wrapText: true, indent: 1 };
      cell.border = fio;
    });
  });

  return workbook;
}

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportPlanoExcel() {
  const workbook = await buildPlanoWorkbook(sortForExport(state.planoGlobal), "Plano gerencial");
  await downloadWorkbook(workbook, `plano_gerencial_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const slugify = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Mesma planilha, mas pra UM plano padrão específico: global + as contas
// extras dele (ver effectivePlano em planosPadrao.js) — é exatamente a
// árvore que quem usa esse plano enxerga no De/Para e nos relatórios.
export async function exportPlanoPadraoExcel(plano) {
  const rows = sortForExport(effectivePlano(plano.id));
  // Nome de aba do Excel não aceita : \ / ? * [ ] e tem limite de 31
  // caracteres — nome de plano padrão é texto livre, então sanitiza antes
  // de usar como título da aba (o nome de verdade continua no arquivo).
  const sheetName = plano.nome.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Plano padrão";
  const workbook = await buildPlanoWorkbook(rows, sheetName);
  await downloadWorkbook(workbook, `plano_padrao_${slugify(plano.nome)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
