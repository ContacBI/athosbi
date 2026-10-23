import { state } from "../data/useStore.js";
import {
  analyticRowsForLine,
  buildDfcDirect,
  counterpartsForEntry,
  entriesForAccount,
  isCashGerencialCode,
  isResultClosingEntry,
  journalByCompanyAndDate,
} from "../data/calculations.js";
import { accumulatedBalanceValue } from "./reportColumns.js";
import { directChildren } from "./reportTree.js";
import { money } from "./format.js";
import { compactValue } from "./presentations.js";

// "Demonstrativo sob medida" dos slides: a DRE, o Balanço ou a DFC do
// período, começando resumido e com cada linha escolhendo o que mostra —
// aberta até o próximo nível, aberta até as contas do balancete, em
// destaque ou escondida. Só muda o que APARECE: os valores são sempre os
// dos relatórios (os mesmos buildReportTree/analyticRowsForLine/
// buildDfcDirect da tela de Demonstrativos).

export const DEMO_SOURCES = [
  { value: "DRE", label: "DRE" },
  { value: "BP", label: "Balanço" },
  { value: "DFC", label: "DFC" },
];

export const DEMO_TITLES = { DRE: "Demonstração do resultado", BP: "Balanço patrimonial", DFC: "Fluxo de caixa" };

// Detalhe inicial que parece "o resumido" de cada um: DRE nas linhas
// principais, Balanço com Circulante/Não circulante, DFC com as linhas das
// três atividades.
export const DEMO_DEFAULT_DEPTH = { DRE: 0, BP: 1, DFC: 1 };

// A DFC é pesada de montar (contrapartida de cada lançamento de caixa):
// uma vez por contexto de dados.
const dfcCache = new WeakMap();
function dfcRows(ctx) {
  if (!dfcCache.has(ctx)) dfcCache.set(ctx, buildDfcDirect());
  return dfcCache.get(ctx);
}

const analyticCache = new WeakMap();
function analyticRows(ctx, row) {
  let byRow = analyticCache.get(ctx);
  if (!byRow) {
    byRow = new Map();
    analyticCache.set(ctx, byRow);
  }
  if (!byRow.has(row)) byRow.set(row, analyticRowsForLine(row));
  return byRow.get(row);
}

function accountKey(row) {
  const cls = Array.isArray(row.classificacao) ? row.classificacao.join("+") : row.classificacao;
  return `acc:${cls || row.nome_conta || ""}`;
}

// A árvore do demonstrativo: `roots` e `childrenOf(node)`, com as contas
// do balancete (ou as contrapartidas, na DFC) embaixo das linhas finais.
export function demoTree(source, ctx) {
  if (!ctx) return { roots: [], childrenOf: () => [], findByCode: () => null, all: [] };
  const rows = source === "DFC" ? dfcRows(ctx) : source === "BP" ? ctx.bp : ctx.dre;
  const visible = rows.filter((row) => {
    if (row.kind !== "synthetic") return false;
    if (source === "DRE" && row.isExcludedNonOperating && state.hideNonOperatingResults) return false;
    return source === "DFC" || row.hasValue || row.qtd_lancamentos;
  });
  const byCode = new Map(visible.map((row) => [row.codigo_gerencial, row]));
  const sameDre = (a, b) =>
    a && b && Math.abs(Number(a.movimento_periodo || 0) - Number(b.movimento_periodo || 0)) < 0.005 &&
    JSON.stringify(a.monthValues || {}) === JSON.stringify(b.monthValues || {});
  // Mesmo corte da tela de Demonstrativos: "Resultado antes de IRPJ e
  // CSLL" igual ao líquido (empresa sem IR no período) aparece uma vez só.
  const skip = source === "DRE" && sameDre(byCode.get("DRE.16"), byCode.get("DRE.18")) ? new Set(["DRE.16"]) : new Set();
  const synthNode = (row) => ({
    key: row.codigo_gerencial,
    code: row.codigo_gerencial,
    name: row.categoria_gerencial || row.codigo_gerencial,
    kind: "synthetic",
    row,
    isTotal: Boolean(row.isFormula) || Number(row.nivel || 0) <= 1 || row.natureza === "heading" || row.natureza === "subtotal",
    isHeading: row.natureza === "heading",
  });
  const accNode = (row, parent) => ({
    key: accountKey(row),
    code: accountKey(row),
    name: row.nome_conta || row.descricao_conta || row.categoria_gerencial || String(row.classificacao || ""),
    kind: "analytic",
    row,
    parentCode: parent.code,
    isTotal: false,
  });
  const nodes = new Map();
  const nodeFor = (row) => {
    if (!nodes.has(row)) nodes.set(row, synthNode(row));
    return nodes.get(row);
  };
  let roots;
  if (source === "DRE") roots = directChildren(visible, "DRE");
  else roots = visible.filter((row) => Number(row.nivel || 0) <= 1 || !String(row.codigo_gerencial).includes("."));
  if (source === "DFC") roots = visible.filter((row) => !visible.some((other) => other !== row && row.codigo_gerencial.startsWith(`${other.codigo_gerencial}.`)));
  const childCache = new Map();
  function childrenOf(node) {
    if (node.kind !== "synthetic") return [];
    if (childCache.has(node.key)) return childCache.get(node.key);
    const synth = directChildren(visible, node.code).filter((row) => !skip.has(row.codigo_gerencial));
    let kids;
    if (synth.length) kids = synth.map(nodeFor);
    else if (source === "DFC") kids = (node.row.contas || []).map((row) => accNode(row, node));
    else if (node.row.isFormula) kids = [];
    else kids = analyticRows(ctx, node.row).map((row) => accNode(row, node));
    childCache.set(node.key, kids);
    return kids;
  }
  const rootNodes = roots.filter((row) => !skip.has(row.codigo_gerencial)).map(nodeFor);
  return {
    roots: rootNodes,
    childrenOf,
    findByCode: (code) => (byCode.has(code) ? nodeFor(byCode.get(code)) : null),
    all: visible.filter((row) => !skip.has(row.codigo_gerencial)).map(nodeFor),
  };
}

// Linhas-mãe de um código ("01.01.01.02" → "01", "01.01", "01.01.01"),
// sem a raiz "DRE" (que não aparece no bloco).
export function ancestorCodes(code) {
  const parts = String(code).split(".");
  const out = [];
  for (let i = 1; i < parts.length; i += 1) out.push(parts.slice(0, i).join("."));
  return out.filter((item) => item !== "DRE");
}

// ---------------------------------------------------------------------------
// Valores

export function demoColumns(block, ctx) {
  const months = ctx?.months || [];
  const cols = [];
  if (block.showPrevious && block.source === "BP") cols.push({ id: "previous", label: "Saldo anterior" });
  if (block.columns === "meses" || block.columns === "meses_total") months.forEach((month) => cols.push({ id: month, label: monthLabel(month), month: true }));
  if (block.columns !== "meses") cols.push({ id: "total", label: block.source === "BP" ? "Saldo final" : block.source === "DFC" ? "Período" : "Total" });
  return cols;
}

function monthLabel(month) {
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [year, mm] = String(month).split("-");
  return `${names[Number(mm) - 1] || mm}/${String(year).slice(2)}`;
}

export function demoValue(source, row, column, months) {
  if (!row) return 0;
  if (column === "previous") return Number(row.saldo_anterior_balancete || 0);
  if (column === "total") {
    if (source === "BP") return Number(row.saldo_final ?? row.saldo ?? 0);
    if (source === "DFC") return Number(row.saldo || 0);
    return Number(row.movimento_periodo ?? row.saldo ?? 0);
  }
  if (source === "BP") return accumulatedBalanceValue(row, column, months);
  return Number(row.monthValues?.[column] || 0);
}

export function demoSeries(source, row, months) {
  return months.map((month) => demoValue(source, row, month, months));
}

// Base da análise vertical: receita líquida (ou bruta) na DRE, ativo total
// no Balanço.
function verticalBase(source, tree, months, column) {
  const pick = (code) => tree.findByCode(code)?.row;
  const row = source === "BP" ? pick("01") : pick("DRE.03") || pick("DRE.01");
  const value = Math.abs(demoValue(source, row, column, months));
  return value > 0.005 ? value : 0;
}

export function formatDemoValue(value, style) {
  const n = Number(value || 0);
  if (Math.abs(n) < 0.005) return "–";
  if (style === "compact") return compactValue(n, "money");
  if (style === "int") return `${n < 0 ? "-" : ""}R$ ${Math.round(Math.abs(n)).toLocaleString("pt-BR")}`;
  return money(n);
}

// As linhas que o bloco mostra, já na ordem, com profundidade e valores.
// `open` (do bloco ou o da apresentação, que a pessoa vai abrindo) manda em
// cada linha: "one" abre um nível, "all" abre até as contas; `false`
// fecha uma linha que o nível inicial abriria. `withHidden` devolve as
// escondidas também (marcadas), pro painel do editor.
export function demoRows(block, ctx, { open = block.open || {}, withHidden = false } = {}) {
  const source = block.source || "BP";
  const tree = demoTree(source, ctx);
  const months = ctx?.months || [];
  const columns = demoColumns(block, ctx);
  const hidden = new Set(block.hide || []);
  const highlight = new Set(block.highlight || []);
  const depthBase = Number.isFinite(block.depth) ? block.depth : DEMO_DEFAULT_DEPTH[source];
  const bases = block.showPercent && source !== "DFC" ? Object.fromEntries(columns.map((col) => [col.id, verticalBase(source, tree, months, col.id)])) : null;
  const out = [];
  function isZero(node) {
    if (node.isHeading) return false;
    const values = [demoValue(source, node.row, "total", months), ...months.map((m) => demoValue(source, node.row, m, months))];
    if (source === "BP") values.push(demoValue(source, node.row, "previous", months));
    return values.every((value) => Math.abs(value) < 0.005);
  }
  function visit(node, depth, inheritedAll, parentHidden) {
    const isHidden = parentHidden || hidden.has(node.code);
    if (isHidden && !withHidden) return;
    if (block.hideZero !== false && isZero(node)) return;
    const mode = open[node.code];
    const kids = node.kind === "synthetic" ? tree.childrenOf(node) : [];
    const autoOpen = depth < depthBase && mode !== false;
    const expanded = kids.length > 0 && mode !== false && (inheritedAll || autoOpen || mode === "one" || mode === "all");
    const values = {};
    const percents = {};
    columns.forEach((col) => {
      values[col.id] = demoValue(source, node.row, col.id, months);
      if (bases) percents[col.id] = bases[col.id] ? (values[col.id] / bases[col.id]) * 100 : null;
    });
    out.push({
      key: node.key,
      code: node.code,
      name: node.name,
      kind: node.kind,
      depth,
      isTotal: node.isTotal && depth === 0 ? true : Boolean(node.row.isFormula) || node.isHeading,
      isHeading: Boolean(node.isHeading),
      hasChildren: kids.length > 0,
      expanded,
      openMode: mode || (inheritedAll ? "all" : autoOpen ? "auto" : null),
      highlighted: highlight.has(node.code),
      hidden: isHidden,
      values,
      percents: bases ? percents : null,
      series: block.showTrend ? demoSeries(source, node.row, months) : null,
      node,
    });
    if (!expanded) return;
    kids.forEach((child) => visit(child, depth + 1, inheritedAll || mode === "all", isHidden));
  }
  tree.roots.forEach((root) => visit(root, 0, false, false));
  return { rows: out, columns, months, tree, source };
}

// ---------------------------------------------------------------------------
// Razão de uma conta (o "ver razão" do modo apresentação).

// Contrapartida: os lançamentos da Domínio trazem o número do lançamento
// (linha_origem) — num lançamento simples a outra perna tem o mesmo
// número, então a contrapartida é exata. Composto (cada parte com número
// próprio) e diário importado de planilha caem na busca por combinação
// do dia (counterpartsForEntry), a mesma do Diário da conta.
export function counterpartResolver(journal = state.journal) {
  const byOrigin = new Map();
  journal.forEach((entry) => {
    if (!entry.linha_origem) return;
    const key = `${entry.companyId || ""}|${entry.data || ""}|${entry.linha_origem}`;
    const list = byOrigin.get(key);
    if (list) list.push(entry);
    else byOrigin.set(key, [entry]);
  });
  let byDay = null;
  return (entry) => {
    const same = byOrigin.get(`${entry.companyId || ""}|${entry.data || ""}|${entry.linha_origem}`) || [];
    const others = same.filter((item) => item !== entry);
    const closes = others.length > 0 && Math.abs(others.reduce((sum, item) => sum + Number(item.debito || 0) - Number(item.credito || 0), 0) + Number(entry.debito || 0) - Number(entry.credito || 0)) < 0.005;
    if (closes) return others;
    if (!byDay) byDay = journalByCompanyAndDate();
    return counterpartsForEntry(entry, byDay.get(`${entry.companyId || ""}|${entry.data || ""}`));
  };
}

export function ledgerData(request) {
  const { source, row, parentCode } = request;
  const months = request.months || [];
  let entries;
  let sign = 1;
  let opening = 0;
  if (source === "DFC") {
    entries = (row.dfcEntries || []).filter((entry) => isCashGerencialCode(entry.codigo_gerencial));
  } else {
    entries = entriesForAccount(row.classificacao);
    // O lançamento de encerramento ("Apuração de resultado em…") zera as
    // contas de resultado e fica fora da DRE — fora do razão também, senão
    // o total da conta aqui não bate com o valor dela no relatório.
    if (source === "DRE") {
      sign = -1;
      entries = entries.filter((entry) => !isResultClosingEntry(entry));
    }
    if (source === "BP") {
      sign = /^0[23]/.test(String(parentCode || "")) ? -1 : 1;
      opening = Number(row.saldo_inicial ?? row.saldo_anterior_balancete ?? 0);
    }
  }
  const resolve = source === "DFC" ? null : counterpartResolver();
  const sorted = [...entries].sort((a, b) => String(a.data).localeCompare(String(b.data)) || Number(a.linha_origem || 0) - Number(b.linha_origem || 0));
  let running = opening;
  let debits = 0;
  let credits = 0;
  const byMonth = {};
  const lines = sorted.map((entry, index) => {
    const debito = Number(entry.debito || 0);
    const credito = Number(entry.credito || 0);
    const value = sign * (debito - credito);
    running += value;
    debits += debito;
    credits += credito;
    const month = String(entry.data || "").slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + value;
    const counterparts = source === "DFC" ? [] : resolve(entry);
    return {
      id: `${index}`,
      data: entry.data,
      historico: entry.historico || "",
      debito,
      credito,
      value,
      running,
      company: entry.companyName || "",
      account: entry.classificacao,
      accountName: entry.descricao_conta || entry.classificacao || "",
      counterpart: source === "DFC" ? entry.descricao_conta || "" : counterparts.map((item) => item.descricao_conta || item.categoria_gerencial || item.classificacao).join(" · "),
    };
  });
  const usedMonths = months.length ? months : Object.keys(byMonth).sort();
  let balance = opening;
  const monthly = usedMonths.map((month) => {
    balance += byMonth[month] || 0;
    return { month, label: monthLabel(month), value: Math.round((byMonth[month] || 0) * 100) / 100, balance: Math.round(balance * 100) / 100 };
  });
  return {
    lines,
    opening,
    closing: running,
    debits,
    credits,
    total: running - opening,
    monthly,
    isBalance: source === "BP",
  };
}
