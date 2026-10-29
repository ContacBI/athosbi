// Orçamento x Realizado (página /empresa/orcamento, cards do B.I. e slide
// do assistente). O orçamento mora no próprio registro da empresa (ou do
// grupo), igual às apresentações: `orcamentos` — uma lista de versões por
// ano, com uma "principal" por ano (a usada nas comparações).
//
// Os valores ficam com o MESMO sinal da DRE (receita positiva, custo e
// despesa negativos), então os totais saem pelas mesmas fórmulas da DRE e
// "realizado ≥ orçado" é sempre o lado bom — inclusive nas despesas
// (−90 ≥ −100 = gastou menos que o previsto).

import { state } from "../data/useStore.js";
import { planNameCase } from "./planCase.js";
import { restoreAccents } from "./accents.js";

// Linhas que a pessoa preenche (nível 2 da DRE gerencial) e o sentido
// natural de cada uma: 1 = entra positivo (receita), -1 = entra como
// gasto (digita positivo, guarda negativo), 0 = pode ser + ou − (digita
// com sinal).
export const INPUT_LINES = [
  { code: "DRE.01", sign: 1 },
  { code: "DRE.02", sign: -1 },
  { code: "DRE.04", sign: -1 },
  { code: "DRE.06", sign: -1 },
  { code: "DRE.07", sign: -1 },
  { code: "DRE.08", sign: -1 },
  { code: "DRE.09", sign: -1 },
  { code: "DRE.10", sign: 0 },
  { code: "DRE.12", sign: -1 },
  { code: "DRE.14", sign: 0 },
  { code: "DRE.15", sign: 0 },
  { code: "DRE.17", sign: -1 },
];

// Totais, na ordem da DRE (iguais aos de applyDreFormulaValues em
// calculations.js).
export const FORMULAS = [
  ["DRE.03", ["DRE.01", "DRE.02"]],
  ["DRE.05", ["DRE.03", "DRE.04"]],
  ["DRE.11", ["DRE.05", "DRE.06", "DRE.07", "DRE.08", "DRE.09", "DRE.10"]],
  ["DRE.13", ["DRE.11", "DRE.12"]],
  ["DRE.16", ["DRE.13", "DRE.14", "DRE.15"]],
  ["DRE.18", ["DRE.16", "DRE.17"]],
];

// A ordem em que as linhas aparecem (DRE.11 fica de fora: com a
// depreciação destacada vazia ele repete o DRE.13).
export const LINE_ORDER = ["DRE.01", "DRE.02", "DRE.03", "DRE.04", "DRE.05", "DRE.06", "DRE.07", "DRE.08", "DRE.09", "DRE.10", "DRE.12", "DRE.13", "DRE.14", "DRE.15", "DRE.16", "DRE.17", "DRE.18"];

const FALLBACK_NAMES = {
  "DRE.01": "Receita bruta",
  "DRE.02": "Deduções da receita",
  "DRE.03": "Receita líquida",
  "DRE.04": "Custos diretos",
  "DRE.05": "Lucro bruto",
  "DRE.06": "Despesas comerciais",
  "DRE.07": "Despesas administrativas",
  "DRE.08": "Tributos e provisões operacionais",
  "DRE.09": "Despesas indedutíveis",
  "DRE.10": "Outros resultados operacionais",
  "DRE.11": "Resultado operacional",
  "DRE.12": "Depreciação e amortização destacada",
  "DRE.13": "Resultado operacional",
  "DRE.14": "Resultado financeiro",
  "DRE.15": "Resultados não operacionais",
  "DRE.16": "Resultado antes de IRPJ e CSLL",
  "DRE.17": "IRPJ e CSLL",
  "DRE.18": "Resultado líquido",
};

export const FORMULA_CODES = new Set(FORMULAS.map(([code]) => code));
const SIGN_BY_TOP = Object.fromEntries(INPUT_LINES.map((line) => [line.code, line.sign]));

export function topCode(code) {
  return String(code || "").split(".").slice(0, 2).join(".");
}

export function signOf(code) {
  return SIGN_BY_TOP[topCode(code)] ?? 0;
}

export function lineName(code) {
  const row = (state.plano || []).find((item) => item.codigo_gerencial === code);
  return planNameCase(restoreAccents(row?.categoria_gerencial || row?.nome || FALLBACK_NAMES[code] || code));
}

// Filhas diretas de uma linha no plano efetivo (pra orçar no detalhe).
export function childLines(code) {
  const depth = code.split(".").length + 1;
  return (state.plano || [])
    .filter((row) => row.demonstrativo === "DRE" && String(row.codigo_gerencial).startsWith(`${code}.`) && String(row.codigo_gerencial).split(".").length === depth)
    .map((row) => ({ code: row.codigo_gerencial, name: planNameCase(restoreAccents(row.categoria_gerencial || row.nome || row.codigo_gerencial)) }))
    .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
}

export function yearMonths(ano) {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthShort(key) {
  const [year, month] = String(key).split("-");
  return `${MONTH_NAMES[Number(month) - 1]}/${String(year).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Versões

export function newBudget(ano, versao = "Original") {
  const now = new Date().toISOString();
  return { id: `orc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ano: Number(ano), versao, principal: true, criadoEm: now, atualizadoEm: now, atualizadoPor: state.userEmail || "", valores: {}, abertas: [] };
}

export function budgetsOfYear(list, ano) {
  return (list || []).filter((budget) => Number(budget.ano) === Number(ano));
}

export function principalBudget(list, ano) {
  const ofYear = budgetsOfYear(list, ano);
  return ofYear.find((budget) => budget.principal) || ofYear[ofYear.length - 1] || null;
}

// ---------------------------------------------------------------------------
// Valores

// Valor orçado de uma linha num mês: a própria linha, ou a soma das filhas
// quando ela está "aberta" (orçada no detalhe).
function inputValue(budget, code, month) {
  if ((budget.abertas || []).includes(code)) {
    return childLines(code).reduce((sum, child) => sum + Number(budget.valores?.[child.code]?.[month] || 0), 0);
  }
  return Number(budget.valores?.[code]?.[month] || 0);
}

// Todas as linhas (de preenchimento e totais) mês a mês: { code: { mes: v } }.
export function budgetMatrix(budget, months) {
  const out = {};
  if (!budget) return out;
  months.forEach((month) => {
    const values = new Map();
    INPUT_LINES.forEach(({ code }) => values.set(code, inputValue(budget, code, month)));
    FORMULAS.forEach(([target, sources]) => values.set(target, sources.reduce((sum, code) => sum + Number(values.get(code) || 0), 0)));
    values.forEach((value, code) => {
      out[code] = out[code] || {};
      out[code][month] = value;
    });
    (budget.abertas || []).forEach((parent) =>
      childLines(parent).forEach((child) => {
        out[child.code] = out[child.code] || {};
        out[child.code][month] = Number(budget.valores?.[child.code]?.[month] || 0);
      })
    );
  });
  return out;
}

export function sumMonths(row, months) {
  return months.reduce((sum, month) => sum + Number(row?.[month] || 0), 0);
}

export function hasAnyValue(budget) {
  return Object.values(budget?.valores || {}).some((months) => Object.values(months || {}).some((value) => Number(value)));
}

// Realizado de uma linha (DRE do contexto do B.I.) mês a mês.
export function actualMonths(ctx, code) {
  const row = (ctx?.dre || []).find((item) => item.codigo_gerencial === code);
  return row?.monthValues || {};
}

// Meses do ano que já têm lançamento (o "realizado até aqui").
export function monthsWithActuals(ctx, ano) {
  const revenue = actualMonths(ctx, "DRE.01");
  const result = actualMonths(ctx, "DRE.18");
  return yearMonths(ano).filter((month) => Number(revenue[month] || 0) || Number(result[month] || 0));
}

// Desvio e semáforo. realizado ≥ orçado é favorável em qualquer linha (ver
// o comentário do topo sobre os sinais).
export function deviation(budgeted, actual) {
  const diff = actual - budgeted;
  const pct = budgeted ? (diff / Math.abs(budgeted)) * 100 : null;
  const reach = budgeted ? (actual / budgeted) * 100 : null;
  let tone = "neutro";
  if (Math.abs(budgeted) > 0.5 || Math.abs(actual) > 0.5) {
    // Centavos e arredondamento (até 0,5% do orçado) não contam como desvio.
    if (diff >= -Math.max(0.5, Math.abs(budgeted) * 0.005)) tone = "bom";
    else if (pct != null && pct >= -10) tone = "atencao";
    else tone = "ruim";
  }
  return { diff, pct, reach, tone };
}

// ---------------------------------------------------------------------------
// Montar o orçamento a partir do realizado.

// mode: "ano_anterior" (mesmo mês do ano anterior), "media" (média mensal
// dos meses com realizado de `baseCtx`), "ultimo" (repete o último mês com
// realizado). `pct` reajusta tudo (ex.: 10 = +10%). Só as linhas de
// preenchimento (e as filhas das abertas).
export function fillFromActuals(budget, baseCtx, { mode, pct = 0, months }) {
  const factor = 1 + Number(pct || 0) / 100;
  const codes = [];
  INPUT_LINES.forEach(({ code }) => {
    if ((budget.abertas || []).includes(code)) childLines(code).forEach((child) => codes.push(child.code));
    else codes.push(code);
  });
  const valores = {};
  // Só meses fechados: o mês corrente ainda está pela metade e puxaria a
  // média pra baixo.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const baseMonths = (baseCtx?.months || []).filter((month) => {
    const revenue = Number(actualMonths(baseCtx, "DRE.01")[month] || 0);
    const result = Number(actualMonths(baseCtx, "DRE.18")[month] || 0);
    return (revenue || result) && month < currentMonth;
  });
  codes.forEach((code) => {
    const actual = actualMonths(baseCtx, code);
    const avg = baseMonths.length ? baseMonths.reduce((sum, month) => sum + Number(actual[month] || 0), 0) / baseMonths.length : 0;
    const last = baseMonths.length ? Number(actual[baseMonths[baseMonths.length - 1]] || 0) : 0;
    valores[code] = {};
    months.forEach((month) => {
      let value = 0;
      if (mode === "ano_anterior") {
        const previous = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
        value = Number(actual[previous] || 0);
      } else if (mode === "ultimo") value = last;
      else value = avg;
      valores[code][month] = Math.round(value * factor);
    });
  });
  return { ...budget, valores: { ...budget.valores, ...valores }, atualizadoEm: new Date().toISOString(), atualizadoPor: state.userEmail || "" };
}

// ---------------------------------------------------------------------------
// O que o B.I. e o assistente usam: o orçamento principal do ano do
// período, só nos meses do período.

export function budgetContext(ctx, list = state.orcamentos) {
  const months = ctx?.months || [];
  if (!months.length || !(list || []).length) return null;
  const ano = Number(months[months.length - 1].slice(0, 4));
  const budget = principalBudget(list, ano);
  if (!budget || !hasAnyValue(budget)) return null;
  const inYear = months.filter((month) => Number(month.slice(0, 4)) === ano);
  const matrix = budgetMatrix(budget, inYear);
  const actualTotal = (code) => sumMonths(actualMonths(ctx, code), inYear);
  const budgetTotal = (code) => sumMonths(matrix[code], inYear);
  const lines = LINE_ORDER.filter((code) => code !== "DRE.12" || Math.abs(budgetTotal(code)) > 0.5 || Math.abs(actualTotal(code)) > 0.5).map((code) => {
    const orcado = budgetTotal(code);
    const realizado = actualTotal(code);
    return { code, name: lineName(code), formula: FORMULA_CODES.has(code), orcado, realizado, ...deviation(orcado, realizado) };
  });
  const despesasCodes = ["DRE.06", "DRE.07", "DRE.08", "DRE.09", "DRE.10"];
  const despesas = { orcado: despesasCodes.reduce((sum, code) => sum + budgetTotal(code), 0), realizado: despesasCodes.reduce((sum, code) => sum + actualTotal(code), 0) };
  return {
    id: budget.id,
    ano,
    versao: budget.versao,
    months: inYear,
    matrix,
    lines,
    receita: { orcado: budgetTotal("DRE.03"), realizado: actualTotal("DRE.03"), ...deviation(budgetTotal("DRE.03"), actualTotal("DRE.03")) },
    receitaBruta: { orcado: budgetTotal("DRE.01"), realizado: actualTotal("DRE.01"), ...deviation(budgetTotal("DRE.01"), actualTotal("DRE.01")) },
    despesas: { ...despesas, ...deviation(despesas.orcado, despesas.realizado) },
    resultado: { orcado: budgetTotal("DRE.18"), realizado: actualTotal("DRE.18"), ...deviation(budgetTotal("DRE.18"), actualTotal("DRE.18")) },
    series: inYear.map((month) => ({
      month: monthShort(month),
      receitaOrcado: Number(matrix["DRE.03"]?.[month] || 0),
      receitaRealizado: Number(actualMonths(ctx, "DRE.03")[month] || 0),
      despesasOrcado: Math.abs(despesasCodes.reduce((sum, code) => sum + Number(matrix[code]?.[month] || 0), 0)),
      despesasRealizado: Math.abs(despesasCodes.reduce((sum, code) => sum + Number(actualMonths(ctx, code)[month] || 0), 0)),
      resultadoOrcado: Number(matrix["DRE.18"]?.[month] || 0),
      resultadoRealizado: Number(actualMonths(ctx, "DRE.18")[month] || 0),
    })),
  };
}

// O orçamento do contexto do B.I., calculado uma vez por contexto e por
// versão da lista (editar o orçamento troca a lista → recalcula).
const budgetCache = new WeakMap();
export function budgetFor(ctx) {
  if (!ctx) return null;
  const hit = budgetCache.get(ctx);
  if (hit && hit.list === state.orcamentos && hit.plano === state.plano) return hit.value;
  const value = budgetContext(ctx, state.orcamentos);
  budgetCache.set(ctx, { list: state.orcamentos, plano: state.plano, value });
  return value;
}

// ---------------------------------------------------------------------------
// Planilha (Excel): baixar o modelo com os valores e importar de volta.
// Valores de gasto vão positivos, como na tela.

// No padrão das planilhas do portal (excelVisual.js), sem mudar o que a
// importação lê: a linha de títulos começa com "Código" e os meses ficam
// nas colunas D a O. O Total é fórmula — soma sozinho enquanto a pessoa
// preenche.
export async function exportBudgetXlsx(budget, empresa) {
  const { COR, argb } = await import("./exportVisual.js");
  const { cabecalhoDaPlanilha, fio, fonte, impressao, linhaDeTitulos, novaPasta, preenchido } = await import("./excelVisual.js");
  const workbook = novaPasta();
  const months = yearMonths(budget.ano);
  const sheet = workbook.addWorksheet(`Orçamento ${budget.ano}`, {
    properties: { tabColor: { argb: argb(COR.acento) } },
    views: [{ state: "frozen", xSplit: 3, ySplit: 6, showGridLines: false, activeCell: "D7" }],
  });
  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 10;
  for (let i = 4; i <= 16; i += 1) sheet.getColumn(i).width = 13;
  await cabecalhoDaPlanilha(workbook, sheet, {
    titulo: `Orçamento ${budget.ano}`,
    empresa: empresa || "Orçamento",
    detalhes: [`Versão ${budget.versao}`, "Preencha os valores do mês (gastos em positivo)", "Não mude a coluna Código", "Linhas de total são calculadas sozinhas"],
    ultima: 16,
  });
  linhaDeTitulos(sheet, 6, ["Código", "Linha", "Tipo", ...months.map(monthShort), "Total"], { alinhar: (i) => (i < 3 ? "left" : "right"), destacar: (i) => i === 15 });
  const rows = [];
  INPUT_LINES.forEach(({ code, sign }) => {
    const opened = (budget.abertas || []).includes(code);
    const lines = opened ? childLines(code).map((child) => ({ ...child, sign })) : [{ code, name: lineName(code), sign }];
    lines.forEach((line) => rows.push(line));
  });
  rows.forEach((line, index) => {
    const numero = 7 + index;
    const display = (value) => (line.sign === -1 ? -Number(value || 0) : Number(value || 0));
    const row = sheet.getRow(numero);
    row.values = [line.code, line.name, line.sign === -1 ? "gasto" : line.sign === 1 ? "receita" : "+/−", ...months.map((month) => display(budget.valores?.[line.code]?.[month])), { formula: `SUM(D${numero}:O${numero})` }];
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, coluna) => {
      cell.border = fio;
      cell.alignment = { vertical: "middle", horizontal: coluna >= 4 ? "right" : "left", indent: coluna <= 2 ? 1 : 0 };
      cell.font = fonte({ size: coluna === 3 ? 9 : 10, color: { argb: argb(coluna === 1 || coluna === 3 ? COR.tinta3 : COR.tinta) } });
      if (coluna >= 4) cell.numFmt = '#,##0;-#,##0;"–"';
    });
    const total = row.getCell(16);
    total.font = fonte({ bold: true });
    total.fill = preenchido(COR.coluna);
  });
  impressao(sheet, { empresa, paisagem: true });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function parseCell(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "result" in value) return Number(value.result || 0);
  const text = String(value).replace(/R\$|\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

// Devolve { valores, abertas, linhas: n, ignoradas: [códigos] } pra
// mesclar no orçamento.
export async function importBudgetXlsx(file, budget) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("A planilha está vazia.");
  const months = yearMonths(budget.ano);
  const known = new Map();
  INPUT_LINES.forEach(({ code }) => {
    known.set(code, { parent: null });
    childLines(code).forEach((child) => known.set(child.code, { parent: code }));
  });
  let headerRow = 0;
  sheet.eachRow((row, number) => {
    if (!headerRow && String(row.getCell(1).value || "").trim().toLowerCase() === "código") headerRow = number;
  });
  if (!headerRow) throw new Error('Não achei a linha de cabeçalho ("Código") — use a planilha baixada pelo app.');
  const valores = {};
  const abertas = new Set(budget.abertas || []);
  const ignored = [];
  let count = 0;
  sheet.eachRow((row, number) => {
    if (number <= headerRow) return;
    const code = String(row.getCell(1).value || "").trim();
    if (!code) return;
    if (!known.has(code) || FORMULA_CODES.has(code)) {
      ignored.push(code);
      return;
    }
    const sign = signOf(code);
    valores[code] = {};
    months.forEach((month, i) => {
      const typed = parseCell(row.getCell(4 + i).value);
      valores[code][month] = sign === -1 ? -Math.abs(typed) : typed;
    });
    const { parent } = known.get(code);
    if (parent) abertas.add(parent);
    count += 1;
  });
  return { valores, abertas: [...abertas], linhas: count, ignoradas: ignored };
}
