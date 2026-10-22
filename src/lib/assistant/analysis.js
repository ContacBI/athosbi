// O "analista" do assistente de apresentação: lê a DRE, o Balanço e a DFC
// do período (o mesmo contexto que o B.I. usa — ver dashboardData.js) e
// escreve, assunto por assunto, o que um consultor diria olhando os números:
// título do slide, a frase principal, os tópicos, as anotações do
// apresentador, os alertas (com o que fazer) e os pontos positivos.
// Tudo por regra — nada sai da empresa, nada é pago.

import { GLOSSARY } from "./vocab.js";
import { sentenceCase } from "../planCase.js";
import { ACCENTS, restoreAccents } from "../accents.js";
import { budgetFor } from "../budget.js";
import { buildCashBridge, bridgeSentence } from "../cashBridge.js";
import { prazosMedios, topMatches } from "../prazos.js";

const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// ---------------------------------------------------------------------------
// Formatação

const nf = (value, digits) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmtMoney(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < -0.5 ? "-" : "";
  if (abs >= 1e9) return `${sign}R$ ${nf(abs / 1e9, 2)} bi`;
  if (abs >= 1e6) return `${sign}R$ ${nf(abs / 1e6, 2)} mi`;
  if (abs >= 1e4) return `${sign}R$ ${nf(abs / 1e3, 1)} mil`;
  return `${sign}R$ ${nf(abs, 0)}`;
}

export const fmtPct = (value, digits = 1) => `${nf(value, digits)}%`;
const fmtSigned = (value, digits = 1) => `${value > 0 ? "+" : ""}${nf(value, digits)}%`;
const fmtPp = (value) => `${value > 0 ? "+" : ""}${nf(value, 1)} p.p.`;
const fmtRatio = (value) => nf(value, 2);
const fmtDays = (value) => `${Math.round(value)} dias`;

export function monthName(key, withYear = true) {
  const [year, month] = String(key || "").split("-");
  const name = MONTHS_FULL[Number(month) - 1] || key;
  return withYear && year ? `${name}/${year.slice(2)}` : name;
}

export function lineName(name) {
  return sentenceCase(restoreAccents(name));
}

// Conta do balancete ("BANCO ITAU") → "Banco Itau": nome próprio, cada
// palavra com maiúscula (menos as pequenas), siglas como estão.
const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "s/a"]);
export function accountName(name) {
  return String(name || "")
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (/^[a-z]{1,3}$/.test(word) && /^(sa|ltda|me|epp|cef|bb|itau|btg|xp)$/.test(word) && word.length <= 3) return word.toUpperCase();
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      const fixed = ACCENTS[word] || word;
      return fixed.charAt(0).toUpperCase() + fixed.slice(1);
    })
    .join(" ");
}

// O nome no meio da frase: "a maior é viagens e hospedagens" (siglas ficam).
const inSentence = (name) => {
  const text = lineName(name);
  return /^[A-Z]{2,}\b/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
};

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// "R$ 397,9 mil (34% da receita)"
const share = (part, total) => (total ? (Math.abs(part) / Math.abs(total)) * 100 : 0);
const change = (now, before) => (before ? ((now - before) / Math.abs(before)) * 100 : null);

// ---------------------------------------------------------------------------
// Leitura das linhas

function periodValue(row) {
  if (!row) return 0;
  const values = Object.values(row.monthValues || {});
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) : Number(row.saldo || 0);
}

function indexRows(rows) {
  return new Map((rows || []).map((row) => [row.codigo_gerencial, row]));
}

function childrenOf(rows, code) {
  const depth = code.split(".").length + 1;
  return (rows || []).filter((row) => row.codigo_gerencial.startsWith(`${code}.`) && row.codigo_gerencial.split(".").length === depth);
}

function leavesUnder(rows, codes) {
  return (rows || []).filter((row) => !row.hasSyntheticChildren && row.kind !== "analytic" && codes.some((code) => row.codigo_gerencial.startsWith(`${code}.`)));
}

// Linhas cujo nome casa com o padrão, ficando só com a mais alta de cada
// ramo (a filha de uma linha que já casou não conta duas vezes). Fica em
// lib/prazos.js (os cards de prazo médio do B.I. usam a mesma).

function monthlyStats(values, months) {
  const n = values.length;
  if (n < 2) return null;
  let best = 0;
  let worst = 0;
  values.forEach((value, index) => {
    if (value > values[best]) best = index;
    if (value < values[worst]) worst = index;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  const avg = total / n;
  const third = Math.max(1, Math.floor(n / 3));
  const avgOf = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const head = avgOf(values.slice(0, third));
  const tail = avgOf(values.slice(n - third));
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / n);
  return {
    n,
    third,
    avg,
    total,
    best: { month: months[best], value: values[best] },
    worst: { month: months[worst], value: values[worst] },
    head,
    tail,
    trend: head ? ((tail - head) / Math.abs(head)) * 100 : null,
    cv: avg ? sd / Math.abs(avg) : null,
    negatives: values.filter((value) => value < -0.5).length,
    positives: values.filter((value) => value > 0.5).length,
    first: values[0],
    last: values[n - 1],
    lastVsAvg: avg ? ((values[n - 1] - avg) / Math.abs(avg)) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Os números do período, num objeto só.

export function buildFacts(ctx, period = {}) {
  if (!ctx) return null;
  const dreIdx = indexRows(ctx.dre);
  const bpIdx = indexRows(ctx.bp);
  const dfcIdx = indexRows(ctx.dfc);
  const months = ctx.months || [];
  const dre = (code) => periodValue(dreIdx.get(code));
  const dreMonthly = (code) => months.map((month) => Number(dreIdx.get(code)?.monthValues?.[month] || 0));
  const bp = (code) => {
    const row = bpIdx.get(code);
    return { end: Number(row?.saldo || 0), start: Number(row?.saldo_inicial || 0), name: row?.categoria_gerencial || "", exists: Boolean(row) };
  };
  const dfc = (code) => Number(dfcIdx.get(code)?.saldo || 0);
  const exec = (code) => Number((ctx.executive || []).find((row) => row.codigo_gerencial === code)?.saldo || 0);
  const sumBp = (rows) => rows.reduce((acc, row) => ({ end: acc.end + Number(row.saldo || 0), start: acc.start + Number(row.saldo_inicial || 0) }), { end: 0, start: 0 });

  const days = (() => {
    if (period.start && period.end) {
      const ms = new Date(`${period.end}T00:00:00`) - new Date(`${period.start}T00:00:00`);
      if (ms > 0) return Math.round(ms / 86400000) + 1;
    }
    return Math.max(1, months.length) * 30;
  })();

  const receitaBruta = dre("DRE.01");
  const deducoes = dre("DRE.02");
  const receitaLiquida = dre("DRE.03");
  const custos = dre("DRE.04");
  const lucroBruto = dre("DRE.05");
  const despComerciais = dre("DRE.06");
  const despAdm = dre("DRE.07");
  const tribOp = dre("DRE.08");
  const outrasOp = dre("DRE.09");
  const despesasOp = despComerciais + despAdm + tribOp + outrasOp;
  const resultadoOp = dre("DRE.12");
  const resultadoFin = dre("DRE.13");
  const naoOp = dre("DRE.14");
  const lair = dre("DRE.15");
  const irpj = dre("DRE.16");
  const lucro = dre("DRE.17") || lair + irpj;
  const recFin = exec("DEX.13");
  const despFin = exec("DEX.14");
  const deprec = exec("DEX.09");
  const ebitda = Number(ctx.ebitda || 0);

  // Prazos médios (saldo médio do começo e do fim do período) — lib/prazos.js,
  // a mesma conta dos cards do B.I.
  const { clientes, estoques, fornecedores, compras, pmr, pme, pmeRaw, pmp } = prazosMedios(ctx, { start: period.start, end: period.end });

  const caixa = bp("01.01.01");
  const dividaCp = bp("02.01.02");
  const dividaLp = bp("02.02.01");
  const dividaBruta = Math.abs(dividaCp.end) + Math.abs(dividaLp.end);
  const dividaBrutaInicio = Math.abs(dividaCp.start) + Math.abs(dividaLp.start);
  const annual = months.length ? 12 / months.length : 1;
  const ebitdaAnual = ebitda * annual;

  const ac = bp("01.01");
  const pc = bp("02.01");
  const pnc = bp("02.02");
  const ativo = bp("01");
  const passivo = bp("02");
  const pl = bp("03");
  const anc = bp("01.02");

  const distribRows = topMatches(ctx.bp, ["02"], /distribu|dividendos|lucros a pagar/);
  const distribuicoesPagar = sumBp(distribRows);

  const pessoalRows = topMatches(ctx.dre, ["DRE.04", "DRE.06", "DRE.07"], /pessoal|folha|mao de obra|remuneracao|salarios/);
  const pessoal = pessoalRows.reduce((sum, row) => sum + periodValue(row), 0);
  const proLabore = topMatches(ctx.dre, ["DRE.04", "DRE.06", "DRE.07"], /pro.?labore|retirada/).reduce((sum, row) => sum + periodValue(row), 0);

  // Impostos: os da receita (sem as devoluções/cancelamentos que também
  // moram nas deduções), os operacionais e IRPJ/CSLL.
  const cancelRows = topMatches(ctx.dre, ["DRE.02"], /cancel|devolu|desconto|abatimento/);
  const cancelamentos = cancelRows.reduce((sum, row) => sum + periodValue(row), 0);
  const impostosReceita = deducoes - cancelamentos;
  const tribOpRows = topMatches(ctx.dre, ["DRE.08"], /tribut|impost|taxa|iptu|ipva/);
  const tributosOperacionais = tribOpRows.reduce((sum, row) => sum + periodValue(row), 0);
  const impostos = impostosReceita + tributosOperacionais + irpj;
  const taxLeaves = leavesUnder(ctx.dre, ["DRE.02", "DRE.08", "DRE.16"])
    .filter((row) => periodValue(row) < -0.5 && !cancelRows.some((cancel) => row.codigo_gerencial.startsWith(`${cancel.codigo_gerencial}.`)))
    .sort((a, b) => periodValue(a) - periodValue(b));

  const expenseLeaves = leavesUnder(ctx.dre, ["DRE.06", "DRE.07", "DRE.08", "DRE.09"])
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: periodValue(row) }))
    .filter((item) => item.value < -0.5)
    .sort((a, b) => a.value - b.value);
  const expenseGroups = ["DRE.06", "DRE.07", "DRE.08", "DRE.09"]
    .flatMap((code) => childrenOf(ctx.dre, code))
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: periodValue(row) }))
    .filter((item) => item.value < -0.5)
    .sort((a, b) => a.value - b.value);
  // Custos por grupo (CMV, CSP…), não por linha: estoque inicial e final
  // são linhas enormes que se anulam e confundiriam o ranking.
  const costGroups = childrenOf(ctx.dre, "DRE.04")
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: periodValue(row) }))
    .filter((item) => item.value < -0.5)
    .sort((a, b) => a.value - b.value);
  const revenueLines = childrenOf(ctx.dre, "DRE.01")
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: periodValue(row) }))
    .filter((item) => item.value > 0.5)
    .sort((a, b) => b.value - a.value);

  // Os grupos do balanço que mais mudaram no período.
  const bpMoves = (ctx.bp || [])
    .filter((row) => Number(row.nivel || 0) === 3 && !row.codigo_gerencial.startsWith("03"))
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), start: Number(row.saldo_inicial || 0), end: Number(row.saldo || 0) }))
    .map((item) => ({ ...item, delta: item.end - item.start }))
    .filter((item) => Math.abs(item.delta) > 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const pcGroups = childrenOf(ctx.bp, "02.01")
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: Number(row.saldo || 0) }))
    .filter((item) => item.value > 0.5)
    .sort((a, b) => b.value - a.value);
  const caixaParts = childrenOf(ctx.bp, "01.01.01")
    .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: Number(row.saldo || 0) }))
    .filter((item) => Math.abs(item.value) > 0.5)
    .sort((a, b) => b.value - a.value);

  const despesaMensal = (Math.abs(custos) + Math.abs(despesasOp)) / Math.max(1, months.length);
  const cashMonths = (ctx.cashSeries || []).map((item) => item.saldo);

  const monthly = {
    receita: monthlyStats(dreMonthly("DRE.03"), months),
    lucro: monthlyStats(dreMonthly("DRE.17").some((value) => value) ? dreMonthly("DRE.17") : (ctx.series || []).map((item) => item.resultado), months),
    ebitda: monthlyStats((ctx.ebitdaSeries || []).map((item) => item.ebitda), months),
    despesas: monthlyStats((ctx.expenseSeries || []).map((item) => Math.abs(item.despesa)), months),
    custos: monthlyStats((ctx.expenseSeries || []).map((item) => Math.abs(item.custo)), months),
    margem: monthlyStats((ctx.marginsSeries || []).map((item) => item.margemLiquida), months),
    caixa: monthlyStats(cashMonths, months),
  };

  const breakEven = ctx.breakEven || {};
  const pe = breakEven.breakEvenRevenue;
  const margemSeguranca = pe != null && receitaLiquida > 0 ? ((receitaLiquida - pe) / receitaLiquida) * 100 : null;

  const indicators = ctx.indicators || {};
  const empty = !indicators.entries && !receitaBruta && !lucro;

  return {
    empty,
    months,
    days,
    annual,
    entries: Number(indicators.entries || 0),
    diferencaBalanco: Number(indicators.diferencaBalanco || 0),
    missing: (ctx.missing || []).length,
    receitaBruta,
    deducoes,
    receitaLiquida,
    custos,
    lucroBruto,
    despComerciais,
    despAdm,
    tribOp,
    outrasOp,
    despesasOp,
    resultadoOp,
    resultadoFin,
    naoOp,
    lair,
    irpj,
    lucro,
    recFin,
    despFin,
    deprec,
    ebitda,
    ebitdaAnual,
    margemBruta: Number(ctx.margemBruta || 0),
    margemLiquida: Number(ctx.margemLiquida || 0),
    margemEbitda: Number(ctx.margemEbitda || 0),
    margemOperacional: Number(ctx.margemOperacional || 0),
    roe: Number(ctx.roe || 0),
    roa: Number(ctx.roa || 0),
    giroAtivo: Number(ctx.giroAtivo || 0),
    liquidezCorrente: ctx.liquidezCorrente,
    liquidezGeral: ctx.liquidezGeral,
    liquidezSeca: pc.end ? (ac.end - estoques.end) / Math.abs(pc.end) : null,
    liquidezImediata: pc.end ? caixa.end / Math.abs(pc.end) : null,
    endividamento: ctx.endividamento,
    composicaoEndividamento: Number(ctx.composicaoEndividamento || 0),
    capitalGiro: Number(ctx.capitalGiro || 0),
    capitalGiroInicio: ac.start - pc.start,
    ativo,
    ac,
    anc,
    passivo,
    pc,
    pnc,
    pl,
    caixa,
    clientes,
    estoques,
    fornecedores,
    imobilizado: bp("01.02.03"),
    intangivel: bp("01.02.04"),
    rlp: bp("01.02.01"),
    capitalSocial: bp("03.01"),
    resultadosAcumulados: bp("03.02"),
    dividaCp,
    dividaLp,
    dividaBruta,
    dividaBrutaInicio,
    dividaLiquida: dividaBruta - caixa.end,
    dividaEbitda: ebitdaAnual > 0.5 ? (dividaBruta - caixa.end) / ebitdaAnual : null,
    distribuicoesPagar,
    compras,
    pmr,
    pme,
    pmeRaw,
    pmp,
    ciclo: pmr != null && pmp != null ? pmr + (pme || 0) - pmp : null,
    pessoal,
    pessoalCodes: pessoalRows.map((row) => row.codigo_gerencial),
    proLabore,
    impostosReceita,
    cancelamentos,
    tributosOperacionais,
    impostos,
    cargaTributaria: receitaBruta > 0 ? share(impostos, receitaBruta) : null,
    taxLeaves: taxLeaves.map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: periodValue(row) })),
    expenseLeaves,
    expenseGroups,
    costGroups,
    revenueLines,
    bpMoves,
    pcGroups,
    caixaParts,
    despesaMensal,
    cobertura: despesaMensal > 0.5 ? caixa.end / despesaMensal : null,
    dfc: {
      inicio: dfc("DFC.CASH.INICIO"),
      fim: dfc("DFC.CASH.FIM"),
      variacao: dfc("DFC.CASH.VARIACAO") || dfc("DFC.CASH.FIM") - dfc("DFC.CASH.INICIO"),
      op: dfc("DFC.OP.CAIXA_LIQUIDO"),
      inv: dfc("DFC.INV.CAIXA_LIQUIDO"),
      fin: dfc("DFC.FIN.CAIXA_LIQUIDO"),
      clientes: dfc("DFC.OP.CLIENTES"),
      fornecedores: dfc("DFC.OP.FORNECEDORES"),
      empregados: dfc("DFC.OP.EMPREGADOS"),
      tributos: dfc("DFC.OP.TRIBUTOS"),
      outros: dfc("DFC.OP.OUTROS"),
      recFin: dfc("DFC.OP.REC_FIN"),
      despFin: dfc("DFC.OP.DESP_FIN"),
      imobilizado: dfc("DFC.INV.IMOBILIZADO"),
      vendaAtivos: dfc("DFC.INV.VENDA_ATIVOS"),
      tomados: dfc("DFC.FIN.EMPRESTIMOS_TOMADOS"),
      pagos: dfc("DFC.FIN.EMPRESTIMOS_PAGOS"),
      lucrosPagos: dfc("DFC.FIN.LUCROS_DIV_PAGOS"),
      capital: dfc("DFC.FIN.CAPITAL"),
      lines: (ctx.dfc || [])
        .filter((row) => Number(row.nivel || 0) === 2 && !/CAIXA_|_LIQUIDO|CAIXA_ANTES/.test(row.codigo_gerencial) && Math.abs(Number(row.saldo || 0)) > 0.5)
        .map((row) => ({ code: row.codigo_gerencial, name: lineName(row.categoria_gerencial), value: Number(row.saldo || 0) })),
    },
    breakEven: { pe, fixos: Number(breakEven.fixedCosts || 0), variavel: Number(breakEven.variableCostRatio || 0), margemSeguranca },
    monthly,
    group: ctx.groupComparison || null,
    budget: budgetFor(ctx),
    bridge: buildCashBridge(ctx),
  };
}

// ---------------------------------------------------------------------------
// Comparação com outro período (ano anterior ou período imediatamente antes).

function compareFacts(f, p) {
  if (!f || !p || p.empty) return null;
  const metric = (label, now, before, kind = "money", goodWhenUp = true) => {
    const delta = kind === "percent" || kind === "ratio" ? now - before : change(now, before);
    return { label, now, before, delta, kind, goodWhenUp, better: delta == null ? null : goodWhenUp ? delta > 0 : delta < 0 };
  };
  return {
    receita: metric("Receita líquida", f.receitaLiquida, p.receitaLiquida),
    receitaBruta: metric("Receita bruta", f.receitaBruta, p.receitaBruta),
    lucroBruto: metric("Lucro bruto", f.lucroBruto, p.lucroBruto),
    despesas: metric("Despesas operacionais", Math.abs(f.despesasOp), Math.abs(p.despesasOp), "money", false),
    custos: metric("Custos", Math.abs(f.custos), Math.abs(p.custos), "money", false),
    ebitda: metric("EBITDA", f.ebitda, p.ebitda),
    lucro: metric("Resultado líquido", f.lucro, p.lucro),
    margemBruta: metric("Margem bruta", f.margemBruta, p.margemBruta, "percent"),
    margemEbitda: metric("Margem EBITDA", f.margemEbitda, p.margemEbitda, "percent"),
    margemLiquida: metric("Margem líquida", f.margemLiquida, p.margemLiquida, "percent"),
    caixa: metric("Caixa no fim", f.caixa.end, p.caixa.end),
    divida: metric("Dívida financeira", f.dividaBruta, p.dividaBruta, "money", false),
    liquidez: f.liquidezCorrente != null && p.liquidezCorrente != null ? metric("Liquidez corrente", f.liquidezCorrente, p.liquidezCorrente, "ratio") : null,
  };
}

export function fmtDelta(metric) {
  if (!metric || metric.delta == null) return "";
  if (metric.kind === "percent") return fmtPp(metric.delta);
  if (metric.kind === "ratio") return `${metric.delta > 0 ? "+" : ""}${fmtRatio(metric.delta)}`;
  // Percentual não faz sentido quando o sinal virou (prejuízo → lucro) ou
  // quando a base era quase zero ("+23.185%").
  if (metric.before < -0.5 && metric.now > 0.5) return "saiu do negativo";
  if (metric.before > 0.5 && metric.now < -0.5) return "ficou negativo";
  if (metric.delta > 300) return `${nf(metric.now / metric.before, 1)}x`;
  return fmtSigned(metric.delta);
}

function fmtMetric(metric, value) {
  if (metric.kind === "percent") return fmtPct(value);
  if (metric.kind === "ratio") return fmtRatio(value);
  return fmtMoney(value);
}

// ---------------------------------------------------------------------------
// Alertas e pontos positivos — cada regra olha um número e diz o que fazer.

function buildAlerts(f, cmp, label) {
  const alerts = [];
  const add = (id, topic, severity, title, text, action) => alerts.push({ id, topic, severity, title, text, action });

  if (Math.abs(f.diferencaBalanco) >= 1) add("balanco_nao_fecha", "balanco", 3, "Balanço não fecha", `Ativo e passivo + PL têm diferença de ${fmtMoney(f.diferencaBalanco)} — vale conferir antes de apresentar.`, "Conferir com a contabilidade a diferença do balanço antes da reunião");
  if (f.missing > 0) add("sem_depara", "balanco", 2, "Contas sem De/Para", `${f.missing} conta${f.missing === 1 ? "" : "s"} ainda sem De/Para — os números podem estar incompletos.`, "Completar o De/Para das contas pendentes");

  if (f.lucro < -0.5) add("prejuizo", "resultado", 3, "Prejuízo no período", `Resultado de ${fmtMoney(f.lucro)} em ${label}${f.receitaLiquida ? ` (${fmtPct(f.margemLiquida)} da receita)` : ""}.`, "Rever preços e as despesas que mais pesam para voltar ao lucro");
  else if (f.receitaLiquida > 0 && f.margemLiquida < 3) add("margem_apertada", "margens", 2, "Margem apertada", `De cada R$ 100 vendidos sobraram só R$ ${nf(Math.max(0, f.margemLiquida), 2)}.`, "Atacar custos e despesas para abrir margem");

  if (f.ebitda < -0.5) add("ebitda_negativo", "ebitda", 3, "Operação não se paga", `EBITDA negativo de ${fmtMoney(f.ebitda)}: a operação consumiu recursos antes de juros e impostos.`, "Plano de corte de despesas e revisão de preços com metas mensais");

  if (f.liquidezCorrente != null && f.liquidezCorrente < 1) add("liquidez_baixa", "liquidez", f.liquidezCorrente < 0.8 ? 3 : 2, "Liquidez abaixo de 1", `Para cada R$ 1 que vence no curto prazo há R$ ${fmtRatio(f.liquidezCorrente)} de ativos de curto prazo.`, "Alongar as obrigações de curto prazo e reforçar o capital de giro");
  if (f.capitalGiro < -0.5) add("capital_giro_negativo", "capitalGiro", 2, "Capital de giro negativo", `O passivo circulante supera o ativo circulante em ${fmtMoney(Math.abs(f.capitalGiro))}.`, "Renegociar prazos e evitar novas saídas de caixa de curto prazo");
  if (f.endividamento != null && f.endividamento > 2 && f.pl.end > 0.5) add("endividamento_alto", "endividamento", f.endividamento > 3 ? 3 : 2, "Endividamento elevado", `O passivo é ${fmtRatio(f.endividamento)}x o patrimônio líquido.`, "Reduzir o passivo e reforçar o patrimônio (reter lucros)");
  if (f.composicaoEndividamento > 80 && f.passivo.end > 0.5) add("divida_curto_prazo", "endividamento", 2, "Obrigações concentradas no curto prazo", `${fmtPct(f.composicaoEndividamento, 0)} das obrigações vencem em até 12 meses.`, "Alongar o perfil das obrigações (trocar curto por longo prazo)");
  if (f.dividaEbitda != null && f.dividaEbitda > 3) add("divida_ebitda", "endividamento", f.dividaEbitda > 4 ? 3 : 2, "Dívida alta para a geração de caixa", `A dívida líquida equivale a ${nf(f.dividaEbitda, 1)} anos de EBITDA.`, "Priorizar amortização e evitar novas dívidas");
  if (f.ebitda > 0.5 && Math.abs(f.despFin) > 0.3 * f.ebitda) add("juros_pesados", "financeiro", 2, "Juros pesando no resultado", `Despesas financeiras consomem ${fmtPct(share(f.despFin, f.ebitda), 0)} do EBITDA.`, "Renegociar taxas e trocar dívidas caras");

  const cashChange = change(f.caixa.end, f.caixa.start);
  if (f.caixa.start > 0.5 && cashChange != null && cashChange < -15) add("caixa_caiu", "caixa", cashChange < -35 ? 3 : 2, "Caixa caiu no período", `De ${fmtMoney(f.caixa.start)} para ${fmtMoney(f.caixa.end)} (${fmtSigned(cashChange, 0)}).`, "Montar um fluxo de caixa semanal das próximas 13 semanas");
  if (f.lucro > 0.5 && f.dfc.op < -0.5) add("lucro_sem_caixa", "fluxo", 3, "Lucro não virou caixa", `A DRE mostra lucro de ${fmtMoney(f.lucro)}, mas a operação consumiu ${fmtMoney(Math.abs(f.dfc.op))} de caixa.`, "Investigar o que prendeu o caixa (estoques, recebimentos e outros pagamentos)");
  if (f.dfc.op < -0.5 && f.caixa.end > 0.5) {
    const burn = Math.abs(f.dfc.op + Math.min(0, f.dfc.inv)) / Math.max(1, f.months.length);
    const runway = burn > 0.5 ? f.caixa.end / burn : null;
    if (runway != null && runway < 6) add("folego_curto", "caixa", runway < 3 ? 3 : 2, "Fôlego de caixa curto", `No ritmo do período, o caixa atual dura cerca de ${nf(runway, 1)} meses.`, "Cortar saídas não essenciais e antecipar recebimentos");
  }

  const estChange = change(f.estoques.end, f.estoques.start);
  if (estChange != null && estChange > 30 && f.estoques.end > 0.05 * Math.abs(f.ativo.end)) add("estoque_subiu", "estoques", 2, "Estoques subiram", `De ${fmtMoney(f.estoques.start)} para ${fmtMoney(f.estoques.end)} (${fmtSigned(estChange, 0)}) — dinheiro parado na prateleira.`, "Rever compras e girar o estoque parado");
  if (f.pmr != null && f.pmr > 60) add("prazo_recebimento", "recebiveis", f.pmr > 90 ? 2 : 1, "Prazo de recebimento longo", `Os clientes levam em média ${fmtDays(f.pmr)} para pagar.`, "Rever a política de crédito e cobrança");
  if (f.pmr != null && f.pmp != null && f.pmr > f.pmp + 15) add("descasamento_prazos", "capitalGiro", 1, "Recebe depois de pagar", `Recebe em ${fmtDays(f.pmr)} e paga em ${fmtDays(f.pmp)}: a empresa financia o cliente.`, "Negociar prazos maiores com fornecedores ou menores com clientes");
  if (f.pmeRaw != null && f.pme == null && f.estoques.end > 0.5) add("pme_estranho", "estoques", 1, "Estoque alto para o custo apurado", `O estoque equivale a mais de 2 anos do custo registrado na DRE — vale conferir a apuração do CMV.`, "Conferir com a contabilidade o custo das mercadorias vendidas");

  const rec = f.monthly.receita;
  if (rec && rec.trend != null && rec.trend < -10 && rec.n >= 3) add("receita_caindo", "receita", rec.trend < -25 ? 3 : 2, "Receita em queda", `${capitalize(lastMonths(rec.third)[0])} ${rec.third === 1 ? "ficou" : "ficaram"} ${fmtSigned(rec.trend, 0)} em relação ${lastMonths(rec.third)[1]}.`, "Plano comercial para recuperar vendas (clientes, preço, mix)");
  const desp = f.monthly.despesas;
  if (rec && desp && rec.trend != null && desp.trend != null && desp.trend > rec.trend + 10 && desp.trend > 5) add("despesa_cresce", "despesas", 2, "Despesas crescendo mais que a receita", `Despesas ${fmtSigned(desp.trend, 0)} contra receita ${fmtSigned(rec.trend, 0)} (média dos últimos meses x primeiros).`, "Congelar despesas novas e revisar contratos");
  const luc = f.monthly.lucro;
  if (luc && luc.n >= 3 && luc.negatives >= Math.ceil(luc.n / 2) && f.lucro > 0.5) add("lucro_oscila", "sazonalidade", 2, "Resultado oscilando", `${luc.negatives} de ${luc.n} meses fecharam no prejuízo, mesmo com lucro no acumulado.`, "Entender os meses negativos (sazonalidade ou lançamentos pontuais)");
  else if (luc && luc.n >= 3 && luc.negatives >= Math.ceil(luc.n / 2)) add("meses_negativos", "sazonalidade", 2, "Muitos meses no prejuízo", `${luc.negatives} de ${luc.n} meses fecharam no prejuízo.`, "Acompanhar o resultado mês a mês com metas");

  if (f.revenueLines.length > 1 && share(f.revenueLines[0].value, f.receitaBruta) > 80) add("receita_concentrada", "composicaoReceita", 1, "Receita concentrada", `${f.revenueLines[0].name} responde por ${fmtPct(share(f.revenueLines[0].value, f.receitaBruta), 0)} da receita bruta.`, "Avaliar como diversificar as fontes de receita");
  if (f.breakEven.pe != null && f.receitaLiquida > 0.5) {
    if (f.receitaLiquida < f.breakEven.pe) add("abaixo_equilibrio", "equilibrio", 3, "Abaixo do ponto de equilíbrio", `Faturou ${fmtMoney(f.receitaLiquida)}; precisava de ${fmtMoney(f.breakEven.pe)} para empatar.`, "Aumentar vendas ou reduzir a estrutura fixa");
    else if (f.breakEven.margemSeguranca != null && f.breakEven.margemSeguranca < 10) add("margem_seguranca", "equilibrio", 2, "Pouca folga sobre o ponto de equilíbrio", `A receita está só ${fmtPct(f.breakEven.margemSeguranca, 0)} acima do mínimo para empatar.`, "Proteger a margem: preço e custos fixos");
  }
  if (f.lucro > 0.5 && f.naoOp + Math.max(0, f.resultadoFin) > 0.5 * f.lucro && f.resultadoOp < f.lucro * 0.6) add("lucro_fora_operacao", "resultado", 1, "Parte do lucro veio de fora da operação", `Resultado financeiro e não operacional somam ${fmtMoney(f.naoOp + f.resultadoFin)} do lucro de ${fmtMoney(f.lucro)}.`, "Separar o que é recorrente do que é pontual na leitura do resultado");
  if (f.pl.end < -0.5) add("pl_negativo", "pl", 3, "Patrimônio líquido negativo", `O PL está em ${fmtMoney(f.pl.end)}: as dívidas superam os bens.`, "Plano de recomposição do patrimônio (aporte ou retenção de lucros)");
  const topExpense = f.expenseLeaves[0];
  if (topExpense && share(topExpense.value, f.despesasOp) > 25) add("despesa_concentrada", "pareto", 1, `${topExpense.name} pesa muito`, `Sozinha, responde por ${fmtPct(share(topExpense.value, f.despesasOp), 0)} das despesas operacionais (${fmtMoney(Math.abs(topExpense.value))}).`, `Revisar ${inSentence(topExpense.name)} (contratos, política e necessidade)`);
  const distrib = f.distribuicoesPagar.end;
  if (distrib > 0.5 && f.pc.end > 0.5 && share(distrib, f.pc.end) > 40) add("distribuicoes_pagar", "distribuicao", 2, "Distribuições a pagar pesam no curto prazo", `${fmtMoney(distrib)} de lucros a pagar — ${fmtPct(share(distrib, f.pc.end), 0)} do passivo circulante.`, "Combinar com os sócios um calendário de pagamento das distribuições");

  const bud = f.budget;
  if (bud) {
    const budgetLabel = `${bud.versao} ${bud.ano}`;
    if (bud.receita.orcado > 0.5 && bud.receita.pct != null && bud.receita.pct < -10) add("orc_receita", "metas", bud.receita.pct < -25 ? 3 : 2, "Receita abaixo do orçado", `Receita líquida de ${fmtMoney(bud.receita.realizado)} contra ${fmtMoney(bud.receita.orcado)} orçados (${fmtPct(bud.receita.reach, 0)} do orçamento ${budgetLabel}).`, "Rever as metas comerciais e o que travou as vendas");
    if (Math.abs(bud.despesas.orcado) > 0.5 && bud.despesas.pct != null && bud.despesas.pct < -10) add("orc_despesas", "metas", 2, "Despesas acima do orçado", `Despesas operacionais de ${fmtMoney(Math.abs(bud.despesas.realizado))} contra ${fmtMoney(Math.abs(bud.despesas.orcado))} orçados (${fmtPct(bud.despesas.reach, 0)} do orçamento).`, "Revisar as linhas que mais estouraram o orçamento");
    if (Math.abs(bud.resultado.orcado) > 0.5 && bud.resultado.diff < -0.5 && bud.resultado.pct != null && bud.resultado.pct < -10) add("orc_resultado", "metas", 2, "Resultado abaixo do orçado", `Resultado de ${fmtMoney(bud.resultado.realizado)} contra ${fmtMoney(bud.resultado.orcado)} orçados.`, "Plano para recuperar o resultado do orçamento no restante do ano");
  }

  if (cmp) {
    if (cmp.receita.delta != null && cmp.receita.delta < -10) add("cmp_receita", "comparativo", 2, "Receita menor que no período de comparação", `Receita líquida ${fmtDelta(cmp.receita)} contra o período de comparação.`, "Entender a queda por cliente/produto");
    if (cmp.lucro.before > 0.5 && cmp.lucro.now < cmp.lucro.before * 0.8) add("cmp_lucro", "comparativo", 2, "Lucro menor que no período de comparação", `De ${fmtMoney(cmp.lucro.before)} para ${fmtMoney(cmp.lucro.now)}.`, "Comparar linha a linha o que mudou na DRE");
    if (cmp.margemLiquida.delta != null && cmp.margemLiquida.delta < -3) add("cmp_margem", "comparativo", 2, "Margem caiu", `Margem líquida ${fmtDelta(cmp.margemLiquida)} contra o período de comparação.`, "Rever preços e custos que subiram");
    if (cmp.despesas.delta != null && cmp.receita.delta != null && cmp.despesas.delta > cmp.receita.delta + 10) add("cmp_despesas", "comparativo", 2, "Despesas cresceram mais que a receita", `Despesas ${fmtDelta(cmp.despesas)} contra receita ${fmtDelta(cmp.receita)}.`, "Revisar o orçamento de despesas");
  }
  return alerts.sort((a, b) => b.severity - a.severity);
}

function buildPositives(f, cmp) {
  const items = [];
  const add = (id, topic, title, text) => items.push({ id, topic, title, text });
  if (f.lucro > 0.5 && f.margemLiquida >= 10) add("lucro", "resultado", "Lucro com boa margem", `Resultado de ${fmtMoney(f.lucro)}, ${fmtPct(f.margemLiquida)} da receita.`);
  else if (f.lucro > 0.5) add("lucro", "resultado", "Período no lucro", `Resultado positivo de ${fmtMoney(f.lucro)}.`);
  if (f.margemEbitda >= 15 && f.ebitda > 0.5) add("ebitda", "ebitda", "Operação gera caixa", `EBITDA de ${fmtMoney(f.ebitda)} (margem de ${fmtPct(f.margemEbitda)}).`);
  if (f.margemBruta >= 40 && f.receitaLiquida > 0.5) add("margem_bruta", "margens", "Margem bruta forte", `Depois dos custos diretos sobram ${fmtPct(f.margemBruta, 0)} da receita.`);
  const rec = f.monthly.receita;
  if (rec && rec.trend != null && rec.trend > 10 && rec.n >= 3) add("receita_cresce", "receita", "Receita em alta", `${capitalize(lastMonths(rec.third)[0])} ${rec.third === 1 ? "veio" : "vieram"} ${fmtSigned(rec.trend, 0)} em relação ${lastMonths(rec.third)[1]}.`);
  const cashChange = change(f.caixa.end, f.caixa.start);
  if (cashChange != null && cashChange > 10 && f.caixa.start > 0.5) add("caixa_subiu", "caixa", "Caixa cresceu", `De ${fmtMoney(f.caixa.start)} para ${fmtMoney(f.caixa.end)} (${fmtSigned(cashChange, 0)}).`);
  if (f.liquidezCorrente != null && f.liquidezCorrente >= 1.5) add("liquidez", "liquidez", "Folga no curto prazo", `Liquidez corrente de ${fmtRatio(f.liquidezCorrente)}.`);
  if (f.endividamento != null && f.endividamento < 1 && f.pl.end > 0.5) add("endividamento", "endividamento", "Endividamento baixo", `O passivo é ${fmtRatio(f.endividamento)}x o patrimônio.`);
  if (f.caixa.end > f.dividaBruta && f.caixa.end > 0.5) add("caixa_liquido", "endividamento", "Caixa maior que a dívida financeira", f.dividaBruta > 0.5 ? `Caixa de ${fmtMoney(f.caixa.end)} contra ${fmtMoney(f.dividaBruta)} de empréstimos e financiamentos.` : `Sem empréstimos relevantes e ${fmtMoney(f.caixa.end)} em caixa.`);
  if (f.dfc.op > 0.5 && f.lucro > 0.5 && f.dfc.op >= 0.8 * f.lucro) add("conversao", "fluxo", "Lucro virando caixa", `A operação gerou ${fmtMoney(f.dfc.op)} de caixa no período.`);
  if (f.resultadoFin > 0.5) add("financeiro", "financeiro", "Resultado financeiro positivo", `Rendimentos superaram juros e tarifas em ${fmtMoney(f.resultadoFin)}.`);
  if (f.pmr != null && f.pmr <= 30) add("pmr", "recebiveis", "Recebimento rápido", `Clientes pagam em média em ${fmtDays(f.pmr)}.`);
  if (f.breakEven.margemSeguranca != null && f.breakEven.margemSeguranca >= 25) add("equilibrio", "equilibrio", "Folga sobre o ponto de equilíbrio", `A receita está ${fmtPct(f.breakEven.margemSeguranca, 0)} acima do mínimo para empatar.`);
  if (f.roe >= 15 * (f.months.length / 12) && f.pl.end > 0.5) add("roe", "indicadores", "Bom retorno para os sócios", `ROE de ${fmtPct(f.roe)} no período.`);
  const luc = f.monthly.lucro;
  if (luc && luc.n >= 3 && luc.best.value > 0.5 && luc.best.month === f.months[f.months.length - 1]) add("melhor_mes", "sazonalidade", "Fechou no melhor mês", `${capitalize(monthName(luc.best.month))} teve o maior lucro do período (${fmtMoney(luc.best.value)}).`);
  if (f.pl.end > f.pl.start * 1.1 && f.pl.start > 0.5) add("pl_cresceu", "pl", "Patrimônio cresceu", `PL foi de ${fmtMoney(f.pl.start)} para ${fmtMoney(f.pl.end)}.`);
  const bud = f.budget;
  if (bud) {
    if (bud.receita.orcado > 0.5 && bud.receita.diff >= -0.5) add("orc_receita", "metas", "Receita dentro do orçado", `${fmtPct(bud.receita.reach, 0)} da receita orçada (${fmtMoney(bud.receita.realizado)} de ${fmtMoney(bud.receita.orcado)}).`);
    if (Math.abs(bud.despesas.orcado) > 0.5 && bud.despesas.diff >= -0.5) add("orc_despesas", "metas", "Despesas dentro do orçado", `Gastou ${fmtPct(bud.despesas.reach, 0)} do orçado em despesas operacionais.`);
    if (Math.abs(bud.resultado.orcado) > 0.5 && bud.resultado.diff >= -0.5 && bud.resultado.realizado > 0.5) add("orc_resultado", "metas", "Resultado acima do orçado", `${fmtMoney(bud.resultado.realizado)} contra ${fmtMoney(bud.resultado.orcado)} orçados.`);
  }
  if (cmp) {
    if (cmp.receita.delta != null && cmp.receita.delta > 5) add("cmp_receita", "comparativo", "Receita acima do período de comparação", `Receita líquida ${fmtDelta(cmp.receita)}.`);
    if (cmp.lucro.now > cmp.lucro.before + 0.5 && cmp.lucro.now > 0.5) add("cmp_lucro", "comparativo", "Lucro maior que no período de comparação", `De ${fmtMoney(cmp.lucro.before)} para ${fmtMoney(cmp.lucro.now)}.`);
    if (cmp.margemLiquida.delta != null && cmp.margemLiquida.delta > 2) add("cmp_margem", "comparativo", "Margem melhorou", `Margem líquida ${fmtDelta(cmp.margemLiquida)}.`);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Seções: uma por assunto. Cada uma devolve o título (curto, cabe numa
// linha), a frase principal, os tópicos (do mais importante pro menos), a
// anotação do apresentador e o que mostrar (indicadores, gráfico, tabela).

function lastMonths(third) {
  return third === 1 ? ["o último mês", "ao primeiro"] : [`os últimos ${third} meses`, "aos primeiros"];
}

function trendText(stats, noun) {
  if (!stats || stats.trend == null || stats.n < 3) return "";
  if (Math.abs(stats.trend) < 5) return `${capitalize(noun)} estável ao longo do período`;
  const [recent, early] = lastMonths(stats.third);
  return `${capitalize(noun)} ${stats.trend > 0 ? "em alta" : "em queda"}: ${recent} ${fmtSigned(stats.trend, 0)} em relação ${early}`;
}

function cmpBullet(metric, prevLabel) {
  if (!metric || metric.delta == null) return "";
  return `${metric.label}: ${fmtMetric(metric, metric.now)} contra ${fmtMetric(metric, metric.before)} em ${prevLabel} (${fmtDelta(metric)})`;
}

function didactic(tones, key) {
  return tones.includes("didatico") && GLOSSARY[key] ? GLOSSARY[key] : "";
}

function sectionBuilders(f, cmp, opts) {
  const { label, prevLabel, tones } = opts;
  const rec = f.monthly.receita;
  const luc = f.monthly.lucro;
  const per100 = (value) => `R$ ${nf(Math.max(0, value), 0)}`;
  const statusOf = (good, bad) => (bad ? "alerta" : good ? "bom" : "neutro");

  return {
    visao: () => {
      const bullets = [
        f.receitaLiquida ? `Receita líquida de ${fmtMoney(f.receitaLiquida)}${rec ? ` — média de ${fmtMoney(rec.avg)} por mês` : ""}` : "",
        `${f.lucro >= 0 ? "Lucro" : "Prejuízo"} de ${fmtMoney(Math.abs(f.lucro))}${f.receitaLiquida ? ` (${fmtPct(f.margemLiquida)} da receita)` : ""}`,
        f.ebitda ? `EBITDA de ${fmtMoney(f.ebitda)}, margem de ${fmtPct(f.margemEbitda)}` : "",
        `Caixa de ${fmtMoney(f.caixa.end)} no fim do período${f.caixa.start ? (Math.abs(change(f.caixa.end, f.caixa.start) || 0) < 1 ? " (estável)" : ` (${fmtSigned(change(f.caixa.end, f.caixa.start) || 0, 0)} no período)`) : ""}`,
        cmp ? cmpBullet(cmp.receita, prevLabel) : "",
      ].filter(Boolean);
      return {
        title: "Os números do período",
        status: statusOf(f.lucro > 0, f.lucro < 0),
        bullets,
        note: `Abra pelo quadro geral: quanto entrou (receita), quanto sobrou (resultado), quanto a operação gerou (EBITDA) e quanto ficou no caixa. ${didactic(tones, "ebitda")}`,
      };
    },

    receita: () => {
      const dedPct = share(f.deducoes, f.receitaBruta);
      const bullets = [
        `Receita bruta de ${fmtMoney(f.receitaBruta)}; líquida de ${fmtMoney(f.receitaLiquida)} depois de ${fmtPct(dedPct, 0)} de impostos e deduções`,
        rec ? `Melhor mês: ${monthName(rec.best.month)} (${fmtMoney(rec.best.value)}); mais fraco: ${monthName(rec.worst.month)} (${fmtMoney(rec.worst.value)})` : "",
        rec ? `Média de ${fmtMoney(rec.avg)} por mês` : "",
        trendText(rec, "receita"),
        rec && rec.cv != null && rec.cv > 0.35 ? `Receita oscila bastante de um mês para o outro (variação típica de ${fmtPct(rec.cv * 100, 0)} em torno da média)` : "",
        cmp ? cmpBullet(cmp.receita, prevLabel) : "",
      ].filter(Boolean);
      const title = rec && rec.trend != null && rec.n >= 3 && Math.abs(rec.trend) >= 10 ? `Receita ${rec.trend > 0 ? "em alta" : "em queda"} no período` : `Receita líquida de ${fmtMoney(f.receitaLiquida)}`;
      return {
        title,
        message: rec ? `${capitalize(monthName(rec.best.month, false))} foi o melhor mês; ${monthName(rec.worst.month, false)} o mais fraco.` : "",
        status: statusOf(rec?.trend > 10, rec?.trend < -10),
        bullets,
        note: `Receita bruta é tudo o que foi faturado; a líquida é o que fica depois dos impostos sobre vendas, devoluções e cancelamentos. ${rec ? `No período, a receita líquida somou ${fmtMoney(f.receitaLiquida)} em ${rec.n} meses.` : ""}`,
      };
    },

    composicaoReceita: () => {
      const lines = f.revenueLines.slice(0, 5);
      const top = lines[0];
      return {
        title: top ? `${top.name}: ${fmtPct(share(top.value, f.receitaBruta), 0)} da receita` : "De onde vem a receita",
        status: top && share(top.value, f.receitaBruta) > 80 ? "atencao" : "neutro",
        bullets: lines.map((line) => `${line.name}: ${fmtMoney(line.value)} (${fmtPct(share(line.value, f.receitaBruta), 0)})`),
        note: "Mostra quais linhas de receita sustentam o faturamento. Concentração alta numa só fonte aumenta o risco se ela cair.",
      };
    },

    deducoes: () => {
      const leaves = f.taxLeaves.filter((row) => row.code.startsWith("DRE.02")).slice(0, 4);
      return {
        title: `Deduções levam ${fmtPct(share(f.deducoes, f.receitaBruta), 0)} da receita bruta`,
        status: "neutro",
        bullets: [
          `Impostos sobre vendas: ${fmtMoney(Math.abs(f.impostosReceita))} (${fmtPct(share(f.impostosReceita, f.receitaBruta), 1)} da bruta)`,
          f.cancelamentos ? `Devoluções e cancelamentos: ${fmtMoney(Math.abs(f.cancelamentos))} (${fmtPct(share(f.cancelamentos, f.receitaBruta), 1)})` : "",
          ...leaves.map((row) => `${row.name}: ${fmtMoney(Math.abs(row.value))}`),
        ].filter(Boolean),
        note: "As deduções explicam a diferença entre o que foi faturado (receita bruta) e o que de fato fica para a empresa (receita líquida).",
      };
    },

    custos: () => {
      const custoPct = share(f.custos, f.receitaLiquida);
      const custosStats = f.monthly.custos;
      return {
        title: `Custos consomem ${fmtPct(custoPct, 0)} da receita`,
        message: `Margem bruta de ${fmtPct(f.margemBruta)}: de cada R$ 100 vendidos, sobram ${per100(f.margemBruta)} depois dos custos diretos.`,
        status: statusOf(f.margemBruta >= 40, f.margemBruta < 15),
        bullets: [
          `Custos diretos de ${fmtMoney(Math.abs(f.custos))} no período`,
          `Lucro bruto de ${fmtMoney(f.lucroBruto)} (margem bruta de ${fmtPct(f.margemBruta)})`,
          ...f.costGroups.slice(0, 3).map((item) => `${item.name}: ${fmtMoney(Math.abs(item.value))}`),
          custosStats && rec && custosStats.trend != null && rec.trend != null && custosStats.trend > rec.trend + 10 ? `Custos subindo mais rápido que a receita (${fmtSigned(custosStats.trend, 0)} x ${fmtSigned(rec.trend, 0)})` : "",
          cmp ? cmpBullet(cmp.margemBruta, prevLabel) : "",
        ].filter(Boolean),
        note: `Custos diretos são o que se gasta para entregar o produto ou serviço (mercadoria, produção, terceiros da operação). ${didactic(tones, "margemBruta")}`,
      };
    },

    despesas: () => {
      const despPct = share(f.despesasOp, f.receitaLiquida);
      const groups = f.expenseGroups.slice(0, 4);
      const desp = f.monthly.despesas;
      return {
        title: `Despesas de ${fmtMoney(Math.abs(f.despesasOp))} (${fmtPct(despPct, 0)} da receita)`,
        message: groups[0] ? `${groups[0].name} é o maior grupo: ${fmtPct(share(groups[0].value, f.despesasOp), 0)} das despesas.` : "",
        status: statusOf(despPct < 30, despPct > 60 || (desp?.trend > 15 && rec?.trend < desp?.trend)),
        bullets: [
          ...groups.map((item) => `${item.name}: ${fmtMoney(Math.abs(item.value))} (${fmtPct(share(item.value, f.despesasOp), 0)})`),
          desp ? `Média de ${fmtMoney(desp.avg)} por mês; pico em ${monthName(desp.best.month)} (${fmtMoney(desp.best.value)})` : "",
          trendText(desp, "despesas"),
          cmp ? cmpBullet(cmp.despesas, prevLabel) : "",
        ].filter(Boolean),
        note: "Despesas operacionais são a estrutura da empresa: administrativo, comercial, ocupação, serviços, tributos operacionais. Mostre os maiores grupos e onde dá para agir.",
      };
    },

    pessoal: () => {
      const pct = share(f.pessoal, f.receitaLiquida);
      return {
        title: f.pessoal ? `Pessoal custa ${fmtPct(pct, 0)} da receita` : "Pessoal e folha",
        status: statusOf(pct < 25, pct > 45),
        bullets: [
          f.pessoal ? `Gasto com pessoal de ${fmtMoney(Math.abs(f.pessoal))} no período (${fmtMoney(Math.abs(f.pessoal) / Math.max(1, f.months.length))} por mês)` : "Não encontrei linhas de pessoal no plano gerencial",
          f.pessoal && f.despesasOp ? `${fmtPct(share(f.pessoal, f.despesasOp + f.custos), 0)} de tudo que se gasta (custos + despesas)` : "",
          f.proLabore ? `Pró-labore: ${fmtMoney(Math.abs(f.proLabore))}` : "",
        ].filter(Boolean),
        note: "Inclui salários, encargos (INSS, FGTS), férias, 13º e benefícios. Comparar com a receita mostra se a estrutura de pessoal está do tamanho do negócio.",
      };
    },

    pareto: () => {
      const top = f.expenseLeaves.slice(0, 8);
      const top5 = f.expenseLeaves.slice(0, 5).reduce((sum, item) => sum + item.value, 0);
      return {
        title: top.length ? `5 linhas somam ${fmtPct(share(top5, f.despesasOp), 0)} das despesas` : "Maiores despesas",
        message: top[0] ? `A maior é ${inSentence(top[0].name)}: ${fmtMoney(Math.abs(top[0].value))}.` : "",
        status: top[0] && share(top[0].value, f.despesasOp) > 25 ? "atencao" : "neutro",
        bullets: top.slice(0, 6).map((item) => `${item.name}: ${fmtMoney(Math.abs(item.value))} (${fmtPct(share(item.value, f.despesasOp), 0)})`),
        chartData: top.length ? `Despesa;Valor\n${top.map((item) => `${item.name.replace(/;/g, ",")};${Math.round(Math.abs(item.value))}`).join("\n")}` : "",
        note: "Ranking das linhas de despesa operacional, da maior para a menor. Normalmente poucas linhas concentram a maior parte — é ali que um corte faz diferença.",
      };
    },

    margens: () => ({
      title: `Margem líquida de ${fmtPct(f.margemLiquida)}`,
      message: `De cada R$ 100 vendidos: ${per100(f.margemBruta)} depois dos custos, ${per100(f.margemEbitda)} de EBITDA e ${per100(f.margemLiquida)} de lucro.`,
      status: statusOf(f.margemLiquida >= 10, f.margemLiquida < 3),
      bullets: [
        `Margem bruta: ${fmtPct(f.margemBruta)}`,
        `Margem operacional: ${fmtPct(f.margemOperacional)}`,
        `Margem EBITDA: ${fmtPct(f.margemEbitda)}`,
        `Margem líquida: ${fmtPct(f.margemLiquida)}`,
        f.monthly.margem && Math.abs(f.monthly.margem.best.value) <= 100 && Math.abs(f.monthly.margem.worst.value) <= 100
          ? `Melhor mês em margem: ${monthName(f.monthly.margem.best.month)} (${fmtPct(f.monthly.margem.best.value)}); pior: ${monthName(f.monthly.margem.worst.month)} (${fmtPct(f.monthly.margem.worst.value)})`
          : "",
        cmp ? cmpBullet(cmp.margemLiquida, prevLabel) : "",
      ].filter(Boolean),
      note: `${didactic(tones, "margemLiquida") || "As margens mostram quanto sobra da receita em cada etapa: depois dos custos, da estrutura e de tudo."}`,
    }),

    resultado: () => {
      const bullets = [
        `Lucro bruto de ${fmtMoney(f.lucroBruto)} sobre receita líquida de ${fmtMoney(f.receitaLiquida)}`,
        `Resultado operacional de ${fmtMoney(f.resultadoOp)}`,
        f.resultadoFin ? `Resultado financeiro de ${fmtMoney(f.resultadoFin)}` : "",
        Math.abs(f.naoOp) > 0.5 ? `Não operacional de ${fmtMoney(f.naoOp)}` : "",
        Math.abs(f.irpj) > 0.5 ? `IRPJ/CSLL de ${fmtMoney(f.irpj)}` : "",
        `${f.lucro >= 0 ? "Lucro" : "Prejuízo"} líquido de ${fmtMoney(f.lucro)} (${fmtPct(f.margemLiquida)} da receita)`,
        luc && luc.n >= 2 ? `${luc.positives} de ${luc.n} meses no lucro; melhor: ${monthName(luc.best.month)} (${fmtMoney(luc.best.value)}), pior: ${monthName(luc.worst.month)} (${fmtMoney(luc.worst.value)})` : "",
        cmp ? cmpBullet(cmp.lucro, prevLabel) : "",
      ].filter(Boolean);
      return {
        title: `${f.lucro >= 0 ? "Lucro" : "Prejuízo"} de ${fmtMoney(Math.abs(f.lucro))} no período`,
        message: `Margem líquida de ${fmtPct(f.margemLiquida)}${luc && luc.negatives ? `, com ${luc.negatives} ${luc.negatives === 1 ? "mês" : "meses"} no vermelho` : ""}.`,
        status: statusOf(f.lucro > 0 && f.margemLiquida >= 5, f.lucro < 0),
        bullets,
        note: "A cascata mostra o caminho do faturamento até o lucro: o que cada etapa (custos, despesas, financeiro, impostos) tirou ou somou.",
      };
    },

    ebitda: () => {
      const eb = f.monthly.ebitda;
      return {
        title: `EBITDA de ${fmtMoney(f.ebitda)}`,
        message: `Margem EBITDA de ${fmtPct(f.margemEbitda)} — ${f.ebitda >= 0 ? "a operação se paga e gera recursos" : "a operação não está se pagando"}.`,
        status: statusOf(f.margemEbitda >= 15, f.ebitda < 0),
        bullets: [
          `Resultado operacional (EBIT) de ${fmtMoney(f.resultadoOp)} + depreciação de ${fmtMoney(f.deprec)}`,
          `Margem EBITDA de ${fmtPct(f.margemEbitda)}`,
          eb ? `Melhor mês: ${monthName(eb.best.month)} (${fmtMoney(eb.best.value)}); pior: ${monthName(eb.worst.month)} (${fmtMoney(eb.worst.value)})` : "",
          f.months.length < 12 && f.ebitda > 0 ? `No ritmo do período, ${fmtMoney(f.ebitdaAnual)} em 12 meses` : "",
          f.dividaEbitda != null ? (f.dividaLiquida < 0 ? "Sem dívida líquida: o caixa é maior que os empréstimos" : `Dívida líquida de ${nf(f.dividaEbitda, 1)}x o EBITDA anualizado`) : "",
          cmp ? cmpBullet(cmp.ebitda, prevLabel) : "",
        ].filter(Boolean),
        note: GLOSSARY.ebitda,
      };
    },

    financeiro: () => ({
      title: `Resultado financeiro de ${fmtMoney(f.resultadoFin)}`,
      status: statusOf(f.resultadoFin > 0, f.ebitda > 0 && Math.abs(f.despFin) > 0.3 * f.ebitda),
      bullets: [
        `Receitas financeiras: ${fmtMoney(f.recFin)} (rendimentos, juros recebidos, descontos obtidos)`,
        `Despesas financeiras: ${fmtMoney(Math.abs(f.despFin))} (juros, tarifas, IOF)`,
        f.ebitda > 0.5 ? `Despesas financeiras equivalem a ${fmtPct(share(f.despFin, f.ebitda), 0)} do EBITDA` : "",
        f.dividaBruta > 0.5 ? `Dívida financeira de ${fmtMoney(f.dividaBruta)} no fim do período` : "",
      ].filter(Boolean),
      note: "Mostra quanto o dinheiro aplicado rendeu e quanto custaram juros e tarifas. Quando os juros pesam muito, vale renegociar as dívidas.",
    }),

    tributos: () => {
      const leaves = f.taxLeaves.slice(0, 5);
      return {
        title: f.cargaTributaria != null ? `Impostos: ${fmtPct(f.cargaTributaria, 1)} da receita bruta` : "Impostos do período",
        status: "neutro",
        bullets: [
          `Total de impostos no período: ${fmtMoney(Math.abs(f.impostos))}`,
          `Sobre vendas: ${fmtMoney(Math.abs(f.impostosReceita))}`,
          f.tributosOperacionais ? `Tributos operacionais (IPTU, taxas…): ${fmtMoney(Math.abs(f.tributosOperacionais))}` : "",
          Math.abs(f.irpj) > 0.5 ? `IRPJ e CSLL: ${fmtMoney(Math.abs(f.irpj))}` : "",
          ...leaves.map((row) => `${row.name}: ${fmtMoney(Math.abs(row.value))}`),
        ].filter(Boolean),
        note: "Carga tributária = impostos sobre vendas, tributos operacionais e IRPJ/CSLL sobre a receita bruta. A Reforma Tributária (CBS/IBS) muda essa conta a partir de 2027 — vale simular no módulo da Reforma.",
      };
    },

    caixa: () => {
      const delta = f.caixa.end - f.caixa.start;
      const cs = f.monthly.caixa;
      return {
        title: `Caixa de ${fmtMoney(f.caixa.end)} no fim do período`,
        message: f.caixa.start ? (Math.abs(change(f.caixa.end, f.caixa.start) || 0) < 1 ? `Praticamente estável: era ${fmtMoney(f.caixa.start)} no início.` : `${delta >= 0 ? "Aumento" : "Redução"} de ${fmtMoney(Math.abs(delta))} desde o início (${fmtSigned(change(f.caixa.end, f.caixa.start) || 0, 0)}).`) : "",
        status: statusOf((change(f.caixa.end, f.caixa.start) || 0) > 5, f.caixa.start > 0 && (change(f.caixa.end, f.caixa.start) || 0) < -15),
        bullets: [
          f.caixa.start ? `Começou em ${fmtMoney(f.caixa.start)} e terminou em ${fmtMoney(f.caixa.end)}` : `Saldo final de ${fmtMoney(f.caixa.end)}`,
          ...f.caixaParts.slice(0, 3).map((item) => `${item.name}: ${fmtMoney(item.value)} (${fmtPct(share(item.value, f.caixa.end), 0)})`),
          f.cobertura != null ? `Cobre cerca de ${nf(f.cobertura, 1)} meses de custos e despesas` : "",
          cs ? `Maior saldo em ${monthName(cs.best.month)} (${fmtMoney(cs.best.value)}); menor em ${monthName(cs.worst.month)} (${fmtMoney(cs.worst.value)})` : "",
          cmp ? cmpBullet(cmp.caixa, prevLabel) : "",
        ].filter(Boolean),
        note: "Caixa e equivalentes = bancos + aplicações de resgate imediato. A cobertura mostra por quantos meses o saldo pagaria custos e despesas se nada entrasse.",
      };
    },

    fluxo: () => {
      const d = f.dfc;
      const b = f.bridge;
      const inflows = d.lines.filter((item) => item.value > 0).sort((a, b2) => b2.value - a.value);
      const outflows = d.lines.filter((item) => item.value < 0).sort((a, b2) => a.value - b2.value);
      const moves = b ? b.items.filter((item) => item.type === "step" && item.id !== "depreciacao" && item.id !== "diferenca").sort((x, y) => Math.abs(y.value) - Math.abs(x.value)).slice(0, 3) : [];
      return {
        title: b ? (b.variacao >= 0 ? `Caixa subiu ${fmtMoney(b.variacao)} no período` : `Caixa caiu ${fmtMoney(Math.abs(b.variacao))} no período`) : d.op >= 0 ? `Operação gerou ${fmtMoney(d.op)} de caixa` : `Operação consumiu ${fmtMoney(Math.abs(d.op))} de caixa`,
        message: b ? bridgeSentence(b).split(". ")[0] + "." : `Saldo foi de ${fmtMoney(d.inicio)} para ${fmtMoney(d.fim)} (${d.variacao >= 0 ? "+" : ""}${fmtMoney(d.variacao)}).`,
        status: statusOf((b ? b.variacao : d.op) > 0, (b ? b.variacao : d.op) < 0 && f.lucro > 0),
        bullets: [
          ...(b
            ? [
                `${f.lucro >= 0 ? "Lucro" : "Prejuízo"} de ${fmtMoney(Math.abs(b.lucro))} + depreciação de ${fmtMoney(b.depreciacao)} (não sai do caixa)`,
                `Caixa da operação, depois do capital de giro: ${fmtMoney(b.operacional)}`,
                ...moves.map((item) => `${item.name}: ${item.value >= 0 ? "+" : ""}${fmtMoney(item.value)}`),
                `Caixa de ${fmtMoney(b.caixaInicio)} para ${fmtMoney(b.caixaFim)}`,
              ]
            : [`Operacional: ${fmtMoney(d.op)}`, `Investimentos: ${fmtMoney(d.inv)}`, `Financiamentos: ${fmtMoney(d.fin)}`]),
          inflows[0] && !b ? `Maior entrada: ${inSentence(inflows[0].name)} (${fmtMoney(inflows[0].value)})` : "",
          outflows[0] && !b ? `Maior saída: ${inSentence(outflows[0].name)} (${fmtMoney(Math.abs(outflows[0].value))})` : "",
        ].filter(Boolean),
        note: `${GLOSSARY.dfc} A ponte parte do lucro e mostra, etapa por etapa, o que prendeu ou liberou caixa (clientes, estoques, fornecedores, investimentos, empréstimos e distribuições) até chegar à variação do caixa — fecha exatamente com o saldo.`,
      };
    },

    endividamento: () => {
      const pcTop = f.pcGroups.slice(0, 3);
      return {
        title: f.pl.end <= 0.5 ? "Patrimônio líquido negativo" : f.endividamento == null ? "Endividamento" : f.endividamento > 10 ? `Passivo de ${fmtMoney(f.passivo.end)} para PL de ${fmtMoney(f.pl.end)}` : `Passivo de ${fmtRatio(f.endividamento)}x o patrimônio`,
        message: f.dividaBruta > 0.5 ? `Dívida financeira (empréstimos e financiamentos) de ${fmtMoney(f.dividaBruta)}; ${f.dividaLiquida < 0 ? `o caixa cobre tudo e sobram ${fmtMoney(Math.abs(f.dividaLiquida))}` : `dívida líquida de ${fmtMoney(f.dividaLiquida)}`}.` : "Sem empréstimos e financiamentos relevantes no balanço.",
        status: statusOf(f.pl.end > 0.5 && f.endividamento != null && f.endividamento < 1, f.pl.end <= 0.5 || (f.endividamento != null && f.endividamento > 2)),
        bullets: [
          f.pl.end <= 0.5 ? `PL de ${fmtMoney(f.pl.end)}: as obrigações superam os bens da empresa` : "",
          `Passivo total de ${fmtMoney(f.passivo.end)}: ${fmtPct(f.composicaoEndividamento, 0)} no curto prazo`,
          f.dividaBruta > 0.5 ? `Empréstimos e financiamentos: ${fmtMoney(Math.abs(f.dividaCp.end))} no curto e ${fmtMoney(Math.abs(f.dividaLp.end))} no longo prazo` : "",
          Math.abs(f.dividaBruta - f.dividaBrutaInicio) > 0.5 ? `Dívida financeira foi de ${fmtMoney(f.dividaBrutaInicio)} para ${fmtMoney(f.dividaBruta)} no período` : "",
          ...pcTop.map((item) => `${item.name}: ${fmtMoney(item.value)} (${fmtPct(share(item.value, f.pc.end), 0)} do passivo circulante)`),
          f.dividaEbitda != null && f.dividaLiquida > 0 ? `Dívida líquida / EBITDA anual: ${nf(f.dividaEbitda, 1)}x` : "",
          cmp ? cmpBullet(cmp.divida, prevLabel) : "",
        ].filter(Boolean),
        note: `${GLOSSARY.endividamento} Dívida líquida = empréstimos e financiamentos menos o caixa. Dívida líquida/EBITDA mostra em quantos anos a operação pagaria a dívida (até 2–3x é confortável para os bancos).`,
      };
    },

    liquidez: () => ({
      title: f.liquidezCorrente != null ? `Liquidez corrente de ${fmtRatio(f.liquidezCorrente)}` : "Liquidez",
      message: f.liquidezCorrente != null ? `Para cada R$ 1 que vence em até 12 meses, há R$ ${fmtRatio(f.liquidezCorrente)} a receber ou em caixa no mesmo prazo.` : "",
      status: statusOf(f.liquidezCorrente >= 1.5, f.liquidezCorrente != null && f.liquidezCorrente < 1),
      bullets: [
        f.liquidezCorrente != null ? `Corrente: ${fmtRatio(f.liquidezCorrente)} (ativo circulante ÷ passivo circulante)` : "",
        f.liquidezSeca != null ? `Seca: ${fmtRatio(f.liquidezSeca)} (sem contar estoques)` : "",
        f.liquidezImediata != null ? `Imediata: ${fmtRatio(f.liquidezImediata)} (só o caixa)` : "",
        f.liquidezGeral != null ? `Geral: ${fmtRatio(f.liquidezGeral)} (todo o ativo ÷ todo o passivo)` : "",
        cmp?.liquidez ? cmpBullet(cmp.liquidez, prevLabel) : "",
      ].filter(Boolean),
      note: GLOSSARY.liquidez,
    }),

    capitalGiro: () => ({
      title: `Capital de giro ${f.capitalGiro >= 0 ? "positivo" : "negativo"}: ${fmtMoney(f.capitalGiro)}`,
      message: f.ciclo != null ? `Ciclo financeiro de ${fmtDays(f.ciclo)}: ${f.ciclo > 0 ? "a empresa paga antes de receber" : "a empresa recebe antes de pagar"}.` : "",
      status: statusOf(f.capitalGiro > 0, f.capitalGiro < 0),
      bullets: [
        `Ativo circulante ${fmtMoney(f.ac.end)} − passivo circulante ${fmtMoney(f.pc.end)}`,
        `No início do período era ${fmtMoney(f.capitalGiroInicio)}`,
        f.pmr != null ? `Prazo médio de recebimento: ${fmtDays(f.pmr)}` : "",
        f.pme != null ? `Prazo médio de estoque: ${fmtDays(f.pme)}` : "",
        f.pmp != null ? `Prazo médio de pagamento: ${fmtDays(f.pmp)}` : "",
        f.ciclo != null ? `Ciclo financeiro: ${fmtDays(f.ciclo)}${f.pme == null ? " (sem o prazo de estoque)" : ""}` : "",
      ].filter(Boolean),
      table: [
        "Prazo;Dias",
        f.pmr != null ? `Recebimento (PMR);${Math.round(f.pmr)}` : "",
        f.pme != null ? `Estoque (PME);${Math.round(f.pme)}` : "",
        f.pmp != null ? `Pagamento (PMP);${Math.round(f.pmp)}` : "",
        f.ciclo != null ? `Ciclo financeiro;${Math.round(f.ciclo)}` : "",
      ].filter(Boolean).join("\n"),
      note: `${GLOSSARY.capitalGiro} ${GLOSSARY.ciclo}`,
    }),

    recebiveis: () => ({
      title: `Clientes a receber: ${fmtMoney(f.clientes.end)}`,
      status: statusOf(f.pmr != null && f.pmr <= 30, f.pmr != null && f.pmr > 60),
      bullets: [
        `Saldo foi de ${fmtMoney(f.clientes.start)} para ${fmtMoney(f.clientes.end)}`,
        f.pmr != null ? `Prazo médio de recebimento: ${fmtDays(f.pmr)}` : "",
        f.ac.end ? `${fmtPct(share(f.clientes.end, f.ac.end), 0)} do ativo circulante` : "",
        f.dfc.clientes ? `Recebido de clientes no período: ${fmtMoney(f.dfc.clientes)}` : "",
      ].filter(Boolean),
      note: "Recebíveis são vendas já feitas que ainda não viraram dinheiro. Quanto maior o prazo, mais capital de giro a empresa precisa.",
    }),

    fornecedores: () => ({
      title: `Fornecedores a pagar: ${fmtMoney(f.fornecedores.end)}`,
      status: "neutro",
      bullets: [
        `Saldo foi de ${fmtMoney(f.fornecedores.start)} para ${fmtMoney(f.fornecedores.end)}`,
        f.pmp != null ? `Prazo médio de pagamento: ${fmtDays(f.pmp)}` : "",
        f.compras ? `Compras no período: ${fmtMoney(f.compras)}` : "",
        f.dfc.fornecedores ? `Pago a fornecedores no período: ${fmtMoney(Math.abs(f.dfc.fornecedores))}` : "",
        f.pmr != null && f.pmp != null ? `Recebe em ${fmtDays(f.pmr)} e paga em ${fmtDays(f.pmp)}` : "",
      ].filter(Boolean),
      note: "Prazo com fornecedores é uma fonte de financiamento sem juros: pagar mais tarde (sem atrasar) alivia o caixa.",
    }),

    estoques: () => {
      const delta = change(f.estoques.end, f.estoques.start);
      return {
        title: `Estoques de ${fmtMoney(f.estoques.end)}`,
        message: delta != null ? `${delta >= 0 ? "Alta" : "Queda"} de ${fmtPct(Math.abs(delta), 0)} no período.` : "",
        status: statusOf(false, delta != null && delta > 30),
        bullets: [
          `Saldo foi de ${fmtMoney(f.estoques.start)} para ${fmtMoney(f.estoques.end)}`,
          f.ac.end ? `${fmtPct(share(f.estoques.end, f.ac.end), 0)} do ativo circulante` : "",
          f.pme != null ? `Prazo médio de estoque: ${fmtDays(f.pme)}` : f.pmeRaw != null ? "Estoque muito alto para o custo apurado na DRE — conferir o CMV" : "",
          f.compras ? `Compras de ${fmtMoney(f.compras)} contra custo de ${fmtMoney(Math.abs(f.custos))}` : "",
        ].filter(Boolean),
        note: "Estoque é dinheiro parado até virar venda. Crescimento sem aumento de vendas costuma prender caixa.",
      };
    },

    investimentos: () => ({
      title: `Imobilizado de ${fmtMoney(f.imobilizado.end)}`,
      status: "neutro",
      bullets: [
        `Imobilizado foi de ${fmtMoney(f.imobilizado.start)} para ${fmtMoney(f.imobilizado.end)}`,
        f.dfc.imobilizado ? `Compras de imobilizado no período: ${fmtMoney(Math.abs(f.dfc.imobilizado))}` : "",
        f.dfc.vendaAtivos ? `Venda de ativos: ${fmtMoney(f.dfc.vendaAtivos)}` : "",
        f.deprec ? `Depreciação do período: ${fmtMoney(f.deprec)}` : "",
        f.intangivel.end ? `Intangível: ${fmtMoney(f.intangivel.end)}` : "",
        Math.abs(f.rlp.end - f.rlp.start) > 0.5 ? `Realizável a longo prazo foi de ${fmtMoney(f.rlp.start)} para ${fmtMoney(f.rlp.end)}` : "",
      ].filter(Boolean),
      note: "Investimentos em máquinas, veículos, imóveis e sistemas. A depreciação espalha esse custo pelos anos de uso.",
    }),

    balanco: () => {
      const moves = f.bpMoves.slice(0, 4);
      return {
        title: `Ativo de ${fmtMoney(f.ativo.end)}; PL de ${fmtMoney(f.pl.end)}`,
        message: moves[0] ? `Maior mudança: ${inSentence(moves[0].name)} (${moves[0].delta >= 0 ? "+" : ""}${fmtMoney(moves[0].delta)}).` : "",
        status: statusOf(f.pl.end > 0 && f.endividamento != null && f.endividamento < 1.5, f.pl.end < 0 || Math.abs(f.diferencaBalanco) >= 1),
        bullets: [
          `Ativo circulante ${fmtMoney(f.ac.end)} e não circulante ${fmtMoney(f.anc.end)}`,
          `Passivo circulante ${fmtMoney(f.pc.end)} e não circulante ${fmtMoney(f.pnc.end)}`,
          `Patrimônio líquido de ${fmtMoney(f.pl.end)} (${fmtPct(share(f.pl.end, f.ativo.end), 0)} do ativo)`,
          ...moves.map((item) => `${item.name}: ${fmtMoney(item.start)} → ${fmtMoney(item.end)}`),
        ].filter(Boolean),
        note: `O balanço é a foto no fim do período: o que a empresa tem (ativo), o que deve (passivo) e o que é dos sócios (PL). ${GLOSSARY.pl}`,
      };
    },

    pl: () => ({
      title: `Patrimônio líquido de ${fmtMoney(f.pl.end)}`,
      message: f.pl.start ? `Era ${fmtMoney(f.pl.start)} no início do período.` : "",
      status: statusOf(f.pl.end > f.pl.start, f.pl.end < 0),
      bullets: [
        `Capital social e reservas: ${fmtMoney(f.capitalSocial.end)}`,
        `Resultados acumulados: ${fmtMoney(f.resultadosAcumulados.end)}`,
        `ROE do período: ${fmtPct(f.roe)}`,
        f.ativo.end ? `O PL financia ${fmtPct(share(f.pl.end, f.ativo.end), 0)} do ativo` : "",
      ].filter(Boolean),
      note: `${GLOSSARY.pl} ${GLOSSARY.roe}`,
    }),

    distribuicao: () => {
      const reserva = f.despesaMensal * 3;
      const livre = f.caixa.end - reserva;
      return {
        title: `Lucro de ${fmtMoney(f.lucro)} disponível para decisão`,
        message: f.capitalGiro < 0 || (f.liquidezCorrente != null && f.liquidezCorrente < 1) ? "Com o capital de giro apertado, distribuir exige cautela." : "Caixa e capital de giro permitem discutir a distribuição.",
        status: statusOf(f.lucro > 0 && f.capitalGiro > 0, f.lucro <= 0 || f.capitalGiro < 0),
        bullets: [
          `Resultado do período: ${fmtMoney(f.lucro)}`,
          `Caixa no fim: ${fmtMoney(f.caixa.end)}; reserva sugerida de 3 meses de gastos: ${fmtMoney(reserva)}`,
          livre > 0 ? `Caixa acima da reserva: ${fmtMoney(livre)}` : `O caixa está abaixo da reserva sugerida em ${fmtMoney(Math.abs(livre))}`,
          f.distribuicoesPagar.end > 0.5 ? `Distribuições já aprovadas a pagar: ${fmtMoney(f.distribuicoesPagar.end)}` : "",
          f.dfc.lucrosPagos ? `Lucros pagos no período: ${fmtMoney(Math.abs(f.dfc.lucrosPagos))}` : "",
        ].filter(Boolean),
        note: "Referência prática: manter em caixa ao menos 3 meses de custos e despesas antes de distribuir. Distribuições já aprovadas (a pagar) também contam como compromisso de curto prazo.",
      };
    },

    indicadores: () => ({
      title: `ROE de ${fmtPct(f.roe)} no período`,
      status: statusOf(f.roe > 10, f.roe < 0),
      bullets: [
        `ROE (retorno sobre o patrimônio): ${fmtPct(f.roe)}`,
        `ROA (retorno sobre o ativo): ${fmtPct(f.roa)}`,
        `Giro do ativo: ${fmtRatio(f.giroAtivo)}`,
        `Margem operacional: ${fmtPct(f.margemOperacional)}`,
        f.liquidezCorrente != null ? `Liquidez corrente: ${fmtRatio(f.liquidezCorrente)}` : "",
        f.endividamento != null ? `Endividamento: ${fmtRatio(f.endividamento)}x o PL` : "",
      ].filter(Boolean),
      note: `${GLOSSARY.roe} O radar compara liquidez, endividamento, margem e ROE com referências de mercado (quanto mais para fora, melhor).`,
    }),

    equilibrio: () => {
      const be = f.breakEven;
      return {
        title: be.pe != null ? `Ponto de equilíbrio: ${fmtMoney(be.pe)}` : "Ponto de equilíbrio",
        message: be.pe != null && f.receitaLiquida ? (f.receitaLiquida >= be.pe ? `A receita ficou ${fmtPct(be.margemSeguranca || 0, 0)} acima do mínimo para empatar.` : `Faltaram ${fmtMoney(be.pe - f.receitaLiquida)} para empatar.`) : "",
        status: statusOf(be.margemSeguranca != null && be.margemSeguranca >= 25, be.pe != null && f.receitaLiquida < be.pe),
        bullets: [
          be.pe != null ? `Receita mínima para empatar no período: ${fmtMoney(be.pe)} (${fmtMoney(be.pe / Math.max(1, f.months.length))} por mês)` : "",
          `Receita realizada: ${fmtMoney(f.receitaLiquida)}`,
          `Gastos fixos (despesas operacionais): ${fmtMoney(be.fixos)}`,
          `Custos variáveis: ${fmtPct(be.variavel * 100, 0)} da receita`,
          be.margemSeguranca != null ? `Margem de segurança: ${fmtPct(be.margemSeguranca, 0)}` : "",
        ].filter(Boolean),
        note: GLOSSARY.equilibrio,
      };
    },

    sazonalidade: () => {
      const eb = f.monthly.lucro;
      return {
        title: "Mês a mês: receita e resultado",
        message: rec ? `Receita entre ${fmtMoney(rec.worst.value)} e ${fmtMoney(rec.best.value)} por mês.` : "",
        status: eb && eb.negatives >= Math.ceil(eb.n / 2) ? "atencao" : "neutro",
        bullets: [
          rec ? `Receita: melhor mês ${monthName(rec.best.month)}, mais fraco ${monthName(rec.worst.month)}` : "",
          eb ? `Resultado: melhor mês ${monthName(eb.best.month)} (${fmtMoney(eb.best.value)}), pior ${monthName(eb.worst.month)} (${fmtMoney(eb.worst.value)})` : "",
          eb ? `${eb.positives} de ${eb.n} meses fecharam no lucro` : "",
          trendText(rec, "receita"),
          rec && rec.lastVsAvg != null ? `Último mês ${fmtSigned(rec.lastVsAvg, 0)} em relação à média do período` : "",
        ].filter(Boolean),
        note: "A evolução mensal mostra sazonalidade (meses fortes e fracos que se repetem) e lançamentos pontuais que distorcem um mês específico.",
      };
    },

    comparativo: () => {
      if (!cmp) return { title: "Comparação com outro período", status: "neutro", bullets: [], missing: true, note: "" };
      const metrics = [cmp.receita, cmp.lucroBruto, cmp.despesas, cmp.ebitda, cmp.lucro, cmp.caixa].filter(Boolean);
      const better = metrics.filter((metric) => metric.better).length;
      return {
        title: `${label} x ${prevLabel}`,
        message: `${better} de ${metrics.length} indicadores melhoraram.`,
        status: statusOf(better > metrics.length / 2, better < metrics.length / 3),
        bullets: [cmp.receita, cmp.ebitda, cmp.lucro, cmp.margemLiquida, cmp.despesas, cmp.caixa].map((metric) => cmpBullet(metric, prevLabel)).filter(Boolean),
        table: [`Indicador;${prevLabel};${label};Variação`, ...[cmp.receita, cmp.lucroBruto, cmp.despesas, cmp.ebitda, cmp.lucro, cmp.margemLiquida, cmp.caixa].map((metric) => `${metric.label};${fmtMetric(metric, metric.before)};${fmtMetric(metric, metric.now)};${fmtDelta(metric) || "—"}`)].join("\n"),
        chartData: [`Indicador;${prevLabel};${label}`, ...[cmp.receita, cmp.lucroBruto, cmp.ebitda, cmp.lucro].map((metric) => `${metric.label};${Math.round(metric.before)};${Math.round(metric.now)}`)].join("\n"),
        note: `Comparação de ${label} com ${prevLabel}, mesmos critérios do B.I. Variações em p.p. (pontos percentuais) nas margens.`,
      };
    },

    metas: () => {
      const bud = f.budget;
      if (!bud) return { title: "Metas", status: "neutro", bullets: [], missing: true, note: "" };
      const reachText = (item) => (item.reach == null ? "—" : fmtPct(item.reach, 0));
      const worstLines = bud.lines.filter((line) => !line.formula && line.diff < -0.5).sort((a, b) => a.diff - b.diff).slice(0, 2);
      const bestLines = bud.lines.filter((line) => !line.formula && line.diff > 0.5).sort((a, b) => b.diff - a.diff).slice(0, 1);
      // Percentual só faz sentido com orçado positivo e de tamanho razoável
      // ("1.201% do orçado" num mês com resultado orçado pequeno confunde).
      const r = bud.resultado;
      const title = r.orcado > 0.5 && r.reach != null && r.reach >= 0 && r.reach <= 300 ? `Resultado em ${reachText(r)} do orçado` : `Resultado ${fmtMoney(Math.abs(r.diff))} ${r.diff >= 0 ? "acima" : "abaixo"} do orçado`;
      return {
        title,
        message: `Orçamento ${bud.versao} ${bud.ano}: receita em ${reachText(bud.receita)} e despesas em ${reachText(bud.despesas)} do previsto.`,
        status: statusOf(bud.resultado.tone === "bom", bud.resultado.tone === "ruim" || bud.receita.tone === "ruim"),
        bullets: [
          `Receita líquida: ${fmtMoney(bud.receita.realizado)} de ${fmtMoney(bud.receita.orcado)} orçados (${reachText(bud.receita)})`,
          `Despesas operacionais: ${fmtMoney(Math.abs(bud.despesas.realizado))} de ${fmtMoney(Math.abs(bud.despesas.orcado))} (${reachText(bud.despesas)})`,
          `Resultado: ${fmtMoney(bud.resultado.realizado)} contra ${fmtMoney(bud.resultado.orcado)} orçados`,
          ...worstLines.map((line) => `Pior desvio: ${inSentence(line.name)} (${fmtMoney(line.diff)})`),
          ...bestLines.map((line) => `Melhor desvio: ${inSentence(line.name)} (+${fmtMoney(line.diff).replace("-", "")})`),
        ],
        note: `Comparação com o orçamento "${bud.versao}" de ${bud.ano}, nos meses do período. Diferença positiva é boa em todas as linhas (nas despesas, significa gastar menos que o previsto).`,
      };
    },

    grupo: () => {
      const companies = (f.group || []).filter((item) => item.receita || item.lucro);
      if (!companies.length) return { title: "Empresas do grupo", status: "neutro", bullets: [], missing: true, note: "" };
      const byRevenue = [...companies].sort((a, b) => b.receita - a.receita);
      const byProfit = [...companies].sort((a, b) => b.lucro - a.lucro);
      return {
        title: `${byRevenue[0].name} lidera a receita do grupo`,
        status: "neutro",
        bullets: [
          ...byRevenue.slice(0, 5).map((item) => `${item.name}: receita ${fmtMoney(item.receita)}, ${item.lucro >= 0 ? "lucro" : "prejuízo"} ${fmtMoney(Math.abs(item.lucro))}`),
          byProfit[0] ? `Maior lucro: ${byProfit[0].name} (${fmtMoney(byProfit[0].lucro)})` : "",
        ].filter(Boolean),
        note: "Cada empresa calculada separadamente, com os mesmos critérios do consolidado.",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Próximos passos: as ações dos alertas mais graves primeiro, depois as de
// rotina.

function buildActions(alerts, f) {
  const seen = new Set();
  const actions = [];
  alerts.forEach((alert) => {
    if (!alert.action || seen.has(alert.action)) return;
    seen.add(alert.action);
    actions.push(alert.action);
  });
  const routine = [
    f.lucro > 0.5 ? "Definir com os sócios quanto do lucro reter e quanto distribuir" : "",
    "Acompanhar receita, margem e caixa todo mês",
    "Revisar as maiores despesas com cada responsável",
    "Agendar a próxima reunião de resultados",
  ].filter(Boolean);
  routine.forEach((item) => {
    if (!seen.has(item)) actions.push(item);
  });
  return actions;
}

function buildConclusion(f, alerts, positives) {
  const strongest = positives[0];
  // O resultado já está na frase; o "ponto de atenção" é o próximo da fila.
  const said = f.lucro < -0.5 ? ["prejuizo", "margem_apertada"] : [];
  const worst = alerts.find((alert) => alert.severity >= 2 && !["balanco_nao_fecha", "sem_depara", ...said].includes(alert.id));
  const parts = [];
  if (f.lucro > 0.5) parts.push(`Período no lucro (${fmtMoney(f.lucro)}, ${fmtPct(f.margemLiquida)} da receita)`);
  else if (f.lucro < -0.5) parts.push(`Período no prejuízo (${fmtMoney(f.lucro)})`);
  else if (strongest) parts.push(strongest.title);
  if (worst) parts.push(`o ponto de atenção é ${worst.title.toLowerCase()}`);
  const headline = parts.length ? `${capitalize(parts.join("; "))}.` : "Período sem movimento relevante.";
  const focus = worst?.action || (strongest ? "Manter o ritmo e acompanhar mês a mês" : "Acompanhar mês a mês");
  return { headline, focus, quote: worst ? `${capitalize(worst.title.toLowerCase())}: a prioridade agora é ${focus.charAt(0).toLowerCase()}${focus.slice(1)}.` : `${headline} ${focus}.` };
}

// ---------------------------------------------------------------------------
// Uma linha ou conta citada no pedido ("evidenciar caixa e equivalentes",
// "o banco itaú"): os números dela pro slide "Em destaque".

export function lineFacts(ctx, line, f) {
  const rows = line.source === "BP" ? ctx?.bp : ctx?.dre;
  const row = (rows || []).find((item) => item.codigo_gerencial === line.code);
  if (!row) return null;
  const months = ctx.months || [];
  const parentCode = line.code.split(".").slice(0, -1).join(".");
  const parent = (rows || []).find((item) => item.codigo_gerencial === parentCode);
  const kids = childrenOf(rows, line.code);
  if (line.kind === "account") {
    const conta = (row.contas || []).find((item) => String(item.classificacao) === String(line.classificacao));
    if (!conta) return null;
    const name = accountName(conta.nome_conta);
    if (line.source === "BP") {
      const start = Number(conta.saldo_anterior || 0);
      const end = Number(conta.saldo_atual || 0);
      return {
        title: `Em destaque: ${name}`,
        message: `Saldo de ${fmtMoney(end)} no fim do período${start ? ` (era ${fmtMoney(start)})` : ""}.`,
        bullets: [
          `Conta ${conta.classificacao}, dentro de ${inSentence(row.categoria_gerencial)}`,
          `Saldo inicial ${fmtMoney(start)} → final ${fmtMoney(end)}`,
          Number(row.saldo || 0) ? `${fmtPct(share(end, row.saldo), 0)} de ${inSentence(row.categoria_gerencial)}` : "",
          conta.debito || conta.credito ? `Movimentou ${fmtMoney(conta.debito)} a débito e ${fmtMoney(conta.credito)} a crédito` : "",
        ].filter(Boolean),
      };
    }
    return {
      title: `Em destaque: ${name}`,
      message: `Conta ${conta.classificacao}, em ${inSentence(row.categoria_gerencial)}.`,
      bullets: [`Linha gerencial: ${lineName(row.categoria_gerencial)} (${fmtMoney(Math.abs(periodValue(row)))} no período)`, conta.debito || conta.credito ? `Débitos de ${fmtMoney(conta.debito)} e créditos de ${fmtMoney(conta.credito)}` : ""].filter(Boolean),
    };
  }
  const name = lineName(row.categoria_gerencial);
  if (line.source === "BP") {
    const start = Number(row.saldo_inicial || 0);
    const end = Number(row.saldo || 0);
    const delta = change(end, start);
    const topKids = kids
      .map((kid) => ({ name: lineName(kid.categoria_gerencial), value: Number(kid.saldo || 0) }))
      .filter((kid) => Math.abs(kid.value) > 0.5)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);
    return {
      title: `Em destaque: ${name}`,
      message: `${fmtMoney(end)} no fim do período${start ? ` — ${delta != null && Math.abs(delta) >= 1 ? `${fmtSigned(delta, 0)} desde o início` : "estável no período"}` : ""}.`,
      bullets: [
        `Saldo inicial ${fmtMoney(start)} → final ${fmtMoney(end)}`,
        parent && Number(parent.saldo || 0) ? `${fmtPct(share(end, parent.saldo), 0)} de ${inSentence(parent.categoria_gerencial)}` : "",
        f?.ativo?.end && line.code.startsWith("01") ? `${fmtPct(share(end, f.ativo.end), 0)} do ativo total` : "",
        ...topKids.map((kid) => `${kid.name}: ${fmtMoney(kid.value)}`),
      ].filter(Boolean),
    };
  }
  const value = periodValue(row);
  const values = months.map((month) => Number(row.monthValues?.[month] || 0));
  const stats = monthlyStats(values.map((item) => Math.abs(item)), months);
  const topKids = kids
    .map((kid) => ({ name: lineName(kid.categoria_gerencial), value: periodValue(kid) }))
    .filter((kid) => Math.abs(kid.value) > 0.5)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3);
  return {
    title: `Em destaque: ${name}`,
    message: `${fmtMoney(Math.abs(value))} no período${f?.receitaLiquida ? ` (${fmtPct(share(value, f.receitaLiquida), 1)} da receita líquida)` : ""}.`,
    bullets: [
      stats ? `Média de ${fmtMoney(stats.avg)} por mês; maior em ${monthName(stats.best.month)} (${fmtMoney(stats.best.value)})` : "",
      trendText(stats, "valor"),
      ...topKids.map((kid) => `${kid.name}: ${fmtMoney(Math.abs(kid.value))}`),
    ].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Entrada: ctx do período (e, se houver, o do período de comparação).

export function analyze(ctx, { period = {}, label = "", prevCtx = null, prevPeriod = {}, prevLabel = "", tones = [], lines = [] } = {}) {
  const facts = buildFacts(ctx, period);
  if (!facts) return null;
  const prevFacts = prevCtx ? buildFacts(prevCtx, prevPeriod) : null;
  const cmp = compareFacts(facts, prevFacts);
  const alerts = buildAlerts(facts, cmp, label);
  const positives = buildPositives(facts, cmp);
  const builders = sectionBuilders(facts, cmp, { label, prevLabel, tones });
  const sections = {};
  Object.keys(builders).forEach((id) => {
    try {
      sections[id] = { id, ...builders[id]() };
    } catch (error) {
      console.error(`assistente: falha ao analisar ${id}`, error);
      sections[id] = { id, title: "", bullets: [], status: "neutro", note: "", missing: true };
    }
  });
  const lineInfo = {};
  lines.forEach((line) => {
    try {
      const info = lineFacts(ctx, line, facts);
      if (info) lineInfo[`${line.kind}:${line.code}:${line.classificacao || ""}`] = info;
    } catch (error) {
      console.error("assistente: falha ao analisar a linha", line, error);
    }
  });
  return {
    facts,
    prevFacts,
    lineInfo,
    comparison: cmp,
    comparisonMissing: Boolean(prevCtx) && !cmp,
    alerts,
    positives,
    actions: buildActions(alerts, facts),
    conclusion: buildConclusion(facts, alerts, positives),
    sections,
  };
}
