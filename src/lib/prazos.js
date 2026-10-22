import { norm } from "./assistant/vocab.js";
import { accumulatedBalanceValue } from "./reportColumns.js";

// Prazos médios de recebimento, estoque e pagamento e o ciclo financeiro.
// A mesma conta do assistente de slides (analysis.js usa daqui): saldo
// médio da conta no balanço (começo + fim ÷ 2) dividido pelo movimento do
// período (receita bruta, custo ou compras) × dias do período.

// Prazo de estoque acima disso (2 anos) quase sempre é custo mal apurado
// na DRE (CMV zerado ou só no fim do ano) — o card mostra o aviso.
export const PME_LIMIT = 720;

// Linhas (do mesmo nível ou abaixo de `prefixes`) cujo nome bate com
// `pattern`, sem contar filha de uma linha que já casou.
export function topMatches(rows, prefixes, pattern) {
  const hits = (rows || []).filter((row) => prefixes.some((prefix) => row.codigo_gerencial === prefix || row.codigo_gerencial.startsWith(`${prefix}.`)) && pattern.test(norm(row.categoria_gerencial)));
  return hits.filter((row) => !hits.some((other) => other !== row && row.codigo_gerencial.startsWith(`${other.codigo_gerencial}.`)));
}

function periodValue(row) {
  if (!row) return 0;
  const values = Object.values(row.monthValues || {});
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) : Number(row.saldo || 0);
}

export function periodDays(period = {}, months = []) {
  if (period.start && period.end) {
    const ms = new Date(`${period.end}T00:00:00`) - new Date(`${period.start}T00:00:00`);
    if (ms > 0) return Math.round(ms / 86400000) + 1;
  }
  return Math.max(1, months.length) * 30;
}

// As linhas de cada base: clientes, estoques, fornecedores e compras.
function baseRows(ctx) {
  const bpByCode = new Map((ctx.bp || []).map((row) => [row.codigo_gerencial, row]));
  return {
    clientes: topMatches(ctx.bp, ["01.01"], /\bclientes?\b|duplicatas a receber|contas a receber/),
    estoques: bpByCode.has("01.01.03") ? [bpByCode.get("01.01.03")] : topMatches(ctx.bp, ["01.01"], /estoque/),
    fornecedores: bpByCode.has("02.01.01") ? [bpByCode.get("02.01.01")] : topMatches(ctx.bp, ["02.01"], /fornecedor/),
    compras: topMatches(ctx.dre, ["DRE.04"], /compras?\b/),
  };
}

const sumBp = (rows) => rows.reduce((acc, row) => ({ end: acc.end + Number(row.saldo || 0), start: acc.start + Number(row.saldo_inicial || 0) }), { end: 0, start: 0 });
const average = (item) => (item.start + item.end) / 2;

function compute({ clientes, estoques, fornecedores, receitaBruta, custos, compras, days }) {
  const pmr = receitaBruta > 0 ? (average(clientes) / receitaBruta) * days : null;
  const pmeRaw = Math.abs(custos) > 0.5 ? (average(estoques) / Math.abs(custos)) * days : null;
  const pme = pmeRaw != null && pmeRaw <= PME_LIMIT ? pmeRaw : null;
  const pmpBase = compras > 0.5 ? compras : Math.abs(custos);
  const pmp = pmpBase > 0.5 ? (average(fornecedores) / pmpBase) * days : null;
  const cicloOperacional = pmr != null ? pmr + (pme || 0) : null;
  const ciclo = pmr != null && pmp != null ? pmr + (pme || 0) - pmp : null;
  // Estoque existe mas o custo não deixa calcular o prazo dele: o ciclo sai
  // sem o estoque (o card avisa).
  const cicloSemEstoque = pmeRaw != null && pme == null;
  return { pmr, pme, pmeRaw, pmp, pmpBase, pmpPorCompras: compras > 0.5, ciclo, cicloOperacional, cicloSemEstoque };
}

export function prazosMedios(ctx, period = {}) {
  if (!ctx) return null;
  const months = ctx.months || [];
  const days = periodDays(period, months);
  const rows = baseRows(ctx);
  const dre = (code) => periodValue((ctx.dre || []).find((row) => row.codigo_gerencial === code));
  const clientes = sumBp(rows.clientes);
  const estoques = sumBp(rows.estoques);
  const fornecedores = sumBp(rows.fornecedores);
  const receitaBruta = dre("DRE.01");
  const custos = dre("DRE.04");
  const compras = Math.abs(rows.compras.reduce((sum, row) => sum + periodValue(row), 0));
  return { days, clientes, estoques, fornecedores, receitaBruta, custos, compras, ...compute({ clientes, estoques, fornecedores, receitaBruta, custos, compras, days }) };
}

// Mês a mês: saldo médio do mês (fim do mês anterior + fim do mês) sobre o
// movimento do mês — pro gráfico de evolução.
export function prazosSeries(ctx) {
  if (!ctx) return [];
  const months = ctx.months || [];
  const rows = baseRows(ctx);
  const dreRow = (code) => (ctx.dre || []).find((row) => row.codigo_gerencial === code);
  const balanceAt = (list, month) => list.reduce((sum, row) => sum + accumulatedBalanceValue(row, month, months), 0);
  const openingOf = (list) => list.reduce((sum, row) => sum + Number(row.saldo_anterior_balancete ?? row.saldo_inicial ?? 0), 0);
  return months.map((month, index) => {
    const [year, mm] = month.split("-").map(Number);
    const days = new Date(year, mm, 0).getDate();
    const prev = index > 0 ? months[index - 1] : null;
    const pair = (list) => ({ start: prev ? balanceAt(list, prev) : openingOf(list), end: balanceAt(list, month) });
    const receitaBruta = Number(dreRow("DRE.01")?.monthValues?.[month] || 0);
    const custos = Number(dreRow("DRE.04")?.monthValues?.[month] || 0);
    const compras = Math.abs(rows.compras.reduce((sum, row) => sum + Number(row.monthValues?.[month] || 0), 0));
    const result = compute({ clientes: pair(rows.clientes), estoques: pair(rows.estoques), fornecedores: pair(rows.fornecedores), receitaBruta, custos, compras, days });
    const [, m] = month.split("-");
    return { month, label: `${m}/${String(year).slice(2)}`, ...result };
  });
}

// O período exato do ctx (do 1º dia do primeiro mês ao último dia do último
// mês) — o mesmo que o assistente usa pra contar os dias.
export function ctxPeriod(ctx) {
  const months = ctx?.months || [];
  if (!months.length) return {};
  const last = months[months.length - 1];
  const [year, month] = last.split("-").map(Number);
  return { start: `${months[0]}-01`, end: `${last}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}` };
}

const cache = new WeakMap();
// Prazos do período do ctx, calculados uma vez por ctx (os cards pedem
// valor, legenda e detalhe separados).
export function prazosDoCtx(ctx) {
  if (!ctx) return null;
  if (!cache.has(ctx)) cache.set(ctx, prazosMedios(ctx, ctxPeriod(ctx)));
  return cache.get(ctx);
}
