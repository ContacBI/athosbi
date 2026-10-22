import { state } from "../data/useStore.js";
import { FORMULAS, INPUT_LINES, LINE_ORDER, actualMonths, budgetMatrix, lineName, monthShort, principalBudget, yearMonths } from "./budget.js";
import { contextForPeriod } from "./assistant/context.js";

// Projeção do fechamento do ano: o realizado dos meses já fechados + uma
// estimativa para os meses que faltam, por um de três métodos:
//  - media: média mensal dos últimos meses fechados (3, 6 ou todos);
//  - sazonal: os mesmos meses do ano anterior, corrigidos pelo crescimento
//    da receita bruta deste ano sobre o mesmo período do ano anterior;
//  - orcamento: o orçamento principal do ano nos meses que faltam.
// Projeta as linhas de preenchimento da DRE (as mesmas do orçamento) e
// tira os totais pelas fórmulas da DRE — os números fecham entre si.
// Faixa otimista/pessimista: ± 1 desvio-padrão mensal da linha nos meses
// fechados × √(meses que faltam) — se o ano continuar oscilando como
// oscilou até aqui, ele fecha dentro da faixa em cerca de 2 a cada 3 vezes.
// Caixa: o saldo do fim do último mês fechado + a variação média mensal do
// caixa nos mesmos meses da média (o orçamento não tem caixa).

export const PROJECTION_METHODS = {
  media: { label: "Média dos últimos meses", short: "média recente", by: "pela média recente" },
  sazonal: { label: "Mesma sazonalidade do ano anterior", short: "sazonalidade do ano anterior", by: "pela sazonalidade do ano anterior" },
  orcamento: { label: "Orçamento nos meses que faltam", short: "orçamento", by: "pelo orçamento" },
};

export const PROJECTION_HEADLINE = ["DRE.01", "DRE.03", "DRE.05", "DRE.12", "DRE.17"];

const sum = (values) => values.reduce((total, value) => total + Number(value || 0), 0);

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = sum(values) / values.length;
  return Math.sqrt(sum(values.map((value) => (value - mean) ** 2)) / (values.length - 1));
}

const CASH_CODE = "01.01.01";

// Saldo do caixa no fim de cada mês do contexto do ano.
function cashByMonth(ctx) {
  const row = (ctx?.bp || []).find((item) => item.codigo_gerencial === CASH_CODE);
  if (!row) return null;
  let running = Number(row.saldo_inicial ?? row.saldo_anterior_balancete ?? 0);
  const out = {};
  (ctx.months || []).forEach((month) => {
    running += Number(row.monthValues?.[month] || 0);
    out[month] = running;
  });
  return { start: Number(row.saldo_inicial ?? 0), byMonth: out };
}

// Meses fechados com realizado: com lançamento e antes do mês corrente.
export function closedMonths(ctx, ano, today = new Date()) {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const revenue = actualMonths(ctx, "DRE.01");
  const result = actualMonths(ctx, "DRE.17");
  return yearMonths(ano).filter((month) => month < current && (Number(revenue[month] || 0) || Number(result[month] || 0)));
}

export function projectYear({ ano, ctx, prevCtx = null, budgets = [], method = "media", lookback = 6, today = new Date() }) {
  const months = yearMonths(ano);
  const closed = closedMonths(ctx, ano, today);
  const last = closed[closed.length - 1] || null;
  const remaining = last ? months.filter((month) => month > last) : months;
  const budget = principalBudget(budgets, ano);
  const budgetValues = budget ? budgetMatrix(budget, months) : null;
  const hasBudget = Boolean(budgetValues && remaining.some((month) => INPUT_LINES.some(({ code }) => Number(budgetValues[code]?.[month] || 0))));
  const prevMonths = yearMonths(ano - 1);
  const prevRevenue = prevCtx ? actualMonths(prevCtx, "DRE.01") : {};
  const prevHas = prevCtx && remaining.some((month) => Number(prevRevenue[`${ano - 1}${month.slice(4)}`] || 0));

  // Base da média: os últimos `lookback` meses fechados (0 = todos).
  const base = lookback > 0 ? closed.slice(-lookback) : closed;

  // Crescimento para a sazonalidade: receita bruta deste ano até o último
  // mês fechado ÷ a dos mesmos meses do ano anterior.
  let growth = null;
  if (prevHas && closed.length) {
    const thisYtd = sum(closed.map((month) => actualMonths(ctx, "DRE.01")[month]));
    const prevYtd = sum(closed.map((month) => prevRevenue[`${ano - 1}${month.slice(4)}`]));
    growth = prevYtd > 0 && thisYtd > 0 ? thisYtd / prevYtd : null;
  }

  const available = {
    media: closed.length > 0,
    sazonal: Boolean(prevHas && growth),
    orcamento: hasBudget,
  };
  const unavailable = {
    media: "Ainda não há mês fechado com lançamento neste ano.",
    sazonal: !prevCtx || !prevHas ? `Sem lançamentos de ${ano - 1} nos meses que faltam.` : `Sem receita nos mesmos meses de ${ano - 1} para comparar o crescimento.`,
    orcamento: budget ? "O orçamento deste ano está vazio nos meses que faltam." : `Sem orçamento de ${ano}.`,
  };
  const chosen = available[method] ? method : ["orcamento", "media", "sazonal"].find((key) => available[key]) || null;

  // Linhas de preenchimento: realizado nos meses fechados, projeção nos que
  // faltam.
  const monthly = {};
  INPUT_LINES.forEach(({ code }) => {
    const actual = actualMonths(ctx, code);
    const average = base.length ? sum(base.map((month) => actual[month])) / base.length : 0;
    const prevActual = prevCtx ? actualMonths(prevCtx, code) : {};
    monthly[code] = {};
    months.forEach((month) => {
      if (closed.includes(month)) monthly[code][month] = Number(actual[month] || 0);
      else if (last && month <= last) monthly[code][month] = 0;
      else if (chosen === "orcamento") monthly[code][month] = Number(budgetValues?.[code]?.[month] || 0);
      else if (chosen === "sazonal") monthly[code][month] = Number(prevActual[`${ano - 1}${month.slice(4)}`] || 0) * growth;
      else if (chosen === "media") monthly[code][month] = average;
      else monthly[code][month] = 0;
    });
  });
  FORMULAS.forEach(([target, sources]) => {
    monthly[target] = {};
    months.forEach((month) => {
      monthly[target][month] = sum(sources.map((code) => monthly[code][month]));
    });
  });

  const sqrtRemaining = Math.sqrt(remaining.length);
  const lineOf = (code) => {
    const actual = actualMonths(ctx, code);
    const realizado = sum(closed.map((month) => actual[month]));
    const projetado = sum(remaining.map((month) => monthly[code]?.[month]));
    const provavel = realizado + projetado;
    const margin = remaining.length ? stdDev(closed.map((month) => Number(actual[month] || 0))) * sqrtRemaining : 0;
    const orcado = budgetValues ? sum(months.map((month) => budgetValues[code]?.[month])) : null;
    const anoAnterior = prevCtx ? sum(prevMonths.map((month) => actualMonths(prevCtx, code)[month])) : null;
    return { code, name: lineName(code), realizado, projetado, provavel, otimista: provavel + margin, pessimista: provavel - margin, margin, orcado: hasBudget || budget ? orcado : null, anoAnterior: anoAnterior || null, monthly: monthly[code] || {} };
  };
  const lines = LINE_ORDER.filter((code) => code !== "DRE.11" || Math.abs(lineOf(code).provavel) > 0.5).map(lineOf);
  const byCode = Object.fromEntries(lines.map((line) => [line.code, line]));

  // Caixa.
  let caixa = null;
  const cash = cashByMonth(ctx);
  if (cash && last) {
    const atual = cash.byMonth[last];
    const baseCash = base.length ? base : closed;
    const changes = baseCash.map((month) => {
      const index = months.indexOf(month);
      const before = index === 0 ? cash.start : cash.byMonth[months[index - 1]];
      return cash.byMonth[month] - before;
    });
    const media = changes.length ? sum(changes) / changes.length : 0;
    const provavel = atual + media * remaining.length;
    const margin = stdDev(changes) * sqrtRemaining;
    caixa = { atual, mediaMensal: media, provavel, otimista: provavel + margin, pessimista: provavel - margin, ate: last };
  }

  const series = months.map((month) => ({
    key: month,
    month: monthShort(month),
    realizado: closed.includes(month) ? Number(monthly["DRE.17"][month] || 0) : null,
    projetado: remaining.includes(month) ? Number(monthly["DRE.17"][month] || 0) : null,
  }));
  let running = 0;
  series.forEach((item) => {
    running += Number(item.realizado ?? item.projetado ?? 0);
    item.acumulado = running;
  });

  return {
    ano,
    method: chosen,
    lookback,
    closed,
    remaining,
    last,
    growth,
    available,
    unavailable,
    budget: budget ? { id: budget.id, versao: budget.versao } : null,
    lines,
    receita: byCode["DRE.01"],
    receitaLiquida: byCode["DRE.03"],
    resultado: byCode["DRE.17"],
    caixa,
    series,
    finished: Boolean(last) && !remaining.length,
  };
}

export function compactMoneyPt(value) {
  const abs = Math.abs(Number(value || 0));
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${sign}R$ ${(abs / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
const compact = compactMoneyPt;
const resultWord = (value) => (value >= 0 ? `lucro de ${compact(value)}` : `prejuízo de ${compact(Math.abs(value))}`);

// A leitura em uma frase (tela, card do B.I. e assistente de slides).
export function projectionSentence(projection, { empresa = "" } = {}) {
  if (!projection?.method) return "";
  const { ano, method, lookback, growth, resultado, receita, caixa, last } = projection;
  if (!last) return method === "orcamento" ? `Ainda sem mês fechado em ${ano}: pelo orçamento, o ano fecha com receita bruta de ${compact(receita.provavel)} e ${resultWord(resultado.provavel)}.` : "";
  if (projection.finished) return `${ano} já fechou: receita bruta de ${compact(receita.realizado)} e ${resultWord(resultado.realizado)}.`;
  const how =
    method === "orcamento"
      ? `Somando o realizado até ${monthShort(last)} com o orçamento dos meses que faltam`
      : method === "sazonal"
        ? `Repetindo nos meses que faltam o comportamento de ${ano - 1}${growth ? ` (corrigido pelo crescimento de ${((growth - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0, signDisplay: "always" })}% da receita)` : ""}`
        : `Se o ritmo ${lookback > 0 && projection.closed.length > lookback ? `dos últimos ${lookback} meses` : "do ano"} continuar`;
  const who = empresa ? `${empresa} deve` : "a empresa deve";
  let text = `${how}, ${who} fechar ${ano} com receita bruta de ${compact(receita.provavel)} e ${resultWord(resultado.provavel)}`;
  if (resultado.margin > 0.5) text += ` (entre ${compact(resultado.pessimista)} e ${compact(resultado.otimista)})`;
  text += ".";
  if (resultado.orcado != null && method !== "orcamento" && Math.abs(resultado.orcado) > 0.5) {
    const gap = resultado.provavel - resultado.orcado;
    text += ` Isso fica ${compact(Math.abs(gap))} ${gap >= 0 ? "acima" : "abaixo"} do resultado orçado para o ano.`;
  }
  if (caixa) text += ` O caixa deve terminar o ano perto de ${compact(caixa.provavel)}.`;
  return text;
}

// Versão curta, para tópico de slide: "Projeção para 2026: lucro de R$ 653
// mil (entre R$ 161 mil e R$ 1,1 mi), pela média recente."
export function projectionShort(projection) {
  if (!projection?.method || projection.finished || !projection.last) return "";
  const { ano, method, resultado } = projection;
  const range = resultado.margin > 0.5 ? ` (entre ${compact(resultado.pessimista)} e ${compact(resultado.otimista)})` : "";
  return `Projeção para ${ano}: ${resultWord(resultado.provavel)}${range}, ${PROJECTION_METHODS[method].by}.`;
}

// O método escolhido na aba Projeção fica no cadastro da empresa
// (company.projecao) — o card do B.I. e o assistente usam o mesmo.
export function projectionSettings() {
  const company = state.activeGroupId ? null : (state.companies || []).find((item) => item.id === state.activeCompanyId);
  const saved = company?.projecao || {};
  return { method: PROJECTION_METHODS[saved.method] ? saved.method : "orcamento", lookback: [0, 3, 6].includes(saved.lookback) ? saved.lookback : 6 };
}

// A projeção do ano do período de um contexto do B.I. (calculada uma vez
// por contexto; refaz se o orçamento ou o método mudarem).
const cache = new WeakMap();
export function projecaoDoCtx(ctx, { today = new Date() } = {}) {
  const months = ctx?.months || [];
  if (!months.length) return null;
  const settings = projectionSettings();
  const hit = cache.get(ctx);
  if (hit && hit.list === state.orcamentos && hit.method === settings.method && hit.lookback === settings.lookback) return hit.value;
  const ano = Number(months[months.length - 1].slice(0, 4));
  let value = null;
  try {
    const yearCtx = contextForPeriod(`${ano}-01-01`, `${ano}-12-31`);
    value = projectYear({ ano, ctx: yearCtx, budgets: state.orcamentos || [], method: settings.method, lookback: settings.lookback, today });
    if (!value.method) value = null;
  } catch (error) {
    console.error("Projeção do ano", error);
  }
  cache.set(ctx, { list: state.orcamentos, method: settings.method, lookback: settings.lookback, value });
  return value;
}
