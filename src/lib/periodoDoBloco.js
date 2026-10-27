// Período de cada bloco com dados nas apresentações (Número, Gráfico do
// B.I., Demonstrativo sob medida e Meta do B.I.): por padrão o filtro da
// apresentação ("Dados de …" no topo do editor); no menu lateral dá pra
// trocar por só o último mês, o acumulado do ano, os últimos N meses ou um
// período fixo. Tudo menos o fixo é relativo ao filtro — mudar o filtro
// move os blocos junto.
//
// A variação (▲/▼) do Número compara com um período do mesmo tamanho: o
// anterior (filtro de 3 meses → os 3 meses antes), o mesmo do ano anterior
// ou só o último mês contra o mês antes dele.

import { state } from "../data/useStore.js";
import { comparisonPeriod, contextForPeriod, shortPeriod } from "./assistant/context.js";
import { friendlyPeriod, kpiSeries } from "./presentations.js";
import { limitarPeriodo, limiteDoCliente, ultimoDiaDoMes } from "./fechamento.js";
import { isSingleLineFormula, lineLabel, lineValue, treeFor } from "./indicatorFormula.js";
import { directChildren } from "./reportTree.js";

export const PERIODOS_DO_BLOCO = [
  { id: "filtro", rotulo: "Do filtro" },
  { id: "ultimoMes", rotulo: "Último mês" },
  { id: "ano", rotulo: "No ano" },
  { id: "ultimos", rotulo: "Últimos meses" },
  { id: "fixo", rotulo: "Fixo" },
];

export const COMPARACOES = [
  { id: "anterior", rotulo: "Período anterior" },
  { id: "ano", rotulo: "Ano anterior" },
  { id: "mes", rotulo: "Último mês × anterior" },
];

// Blocos que mostram números do B.I. (a Meta só quando o valor vem do B.I.).
export function blocoComDados(block) {
  return block?.kind === "kpi" || block?.kind === "widget" || block?.kind === "demo" || (block?.kind === "meta" && block.source === "kpi");
}

function somarMeses(mes, quantos) {
  const [ano, m] = mes.split("-").map(Number);
  const data = new Date(ano, m - 1 + quantos, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// O período do bloco ({ start, end } "AAAA-MM-DD") a partir do filtro.
export function periodoDoBloco(periodo, filtro) {
  const tipo = periodo?.tipo || "filtro";
  if (tipo === "fixo" && /^\d{4}-\d{2}$/.test(periodo.inicio || "") && /^\d{4}-\d{2}$/.test(periodo.fim || "")) {
    const [inicio, fim] = periodo.inicio <= periodo.fim ? [periodo.inicio, periodo.fim] : [periodo.fim, periodo.inicio];
    return { start: `${inicio}-01`, end: ultimoDiaDoMes(fim) };
  }
  if (!filtro?.start || !filtro?.end || tipo === "filtro" || tipo === "fixo") return { start: filtro?.start || "", end: filtro?.end || "" };
  const mesFim = filtro.end.slice(0, 7);
  let inicio = filtro.start;
  if (tipo === "ultimoMes") inicio = `${mesFim}-01`;
  else if (tipo === "ano") inicio = `${mesFim.slice(0, 4)}-01-01`;
  else if (tipo === "ultimos") inicio = `${somarMeses(mesFim, 1 - Math.max(1, Number(periodo.meses) || 3))}-01`;
  return { start: inicio, end: filtro.end };
}

// O que a variação compara: { atual, base, rotulo } — `atual` é o próprio
// período do bloco, menos em "mes" (o último mês dele).
export function comparacaoDoBloco(tipo, periodo) {
  if (!periodo?.start || !periodo?.end) return null;
  if (tipo === "mes") {
    const mes = periodo.end.slice(0, 7);
    const antes = somarMeses(mes, -1);
    return { atual: { start: `${mes}-01`, end: ultimoDiaDoMes(mes) }, base: { start: `${antes}-01`, end: ultimoDiaDoMes(antes) }, rotulo: "no último mês" };
  }
  const base = comparisonPeriod(periodo, tipo === "ano" ? "yoy" : "anterior");
  return base && { atual: periodo, base: { start: base.start, end: base.end }, rotulo: `vs ${shortPeriod(base.start, base.end)}` };
}

// Variação de um valor contra a base: p.p. pros percentuais, % pro resto.
export function variacaoDoNumero(atual, base, format) {
  if (atual == null || base == null || !Number.isFinite(atual) || !Number.isFinite(base)) return null;
  if (format === "percent") {
    const diff = atual - base;
    return { up: diff >= 0, text: `${Math.abs(diff).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` };
  }
  if (Math.abs(base) < 0.005) return null;
  const pct = ((atual - base) / Math.abs(base)) * 100;
  if (!Number.isFinite(pct)) return null;
  return { up: pct >= 0, text: `${Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` };
}

// Contexto do B.I. de um período, guardado por contexto da apresentação
// (mudou o dado, muda o contexto e o guardado vai junto) — vários blocos
// no mesmo período (ou na mesma comparação) calculam uma vez só.
const guardados = new WeakMap();
export function contextoDoPeriodo(raiz, periodo) {
  if (!raiz || !periodo?.start || !periodo?.end) return null;
  let mapa = guardados.get(raiz);
  if (!mapa) {
    mapa = new Map();
    guardados.set(raiz, mapa);
  }
  const chave = `${periodo.start}|${periodo.end}`;
  if (!mapa.has(chave)) mapa.set(chave, contextForPeriod(periodo.start, periodo.end));
  return mapa.get(chave);
}

// O env do slide (ctx + info) trocado pro período do bloco. Cliente nunca
// passa do mês fechado (lib/fechamento.js), nem num período fixo.
export function envDoBloco(block, env) {
  if (!env?.ctx || !blocoComDados(block) || !block.periodo || block.periodo.tipo === "filtro") return env;
  const filtro = { start: env.info?.start || "", end: env.info?.end || "" };
  const periodo = limitarPeriodo(periodoDoBloco(block.periodo, filtro), limiteDoCliente(state));
  if (!periodo.start || !periodo.end || (periodo.start === filtro.start && periodo.end === filtro.end)) return env;
  const raiz = env.raiz || env.ctx;
  return { ...env, raiz, ctx: contextoDoPeriodo(raiz, periodo), info: { ...env.info, start: periodo.start, end: periodo.end } };
}

// "Julho a setembro de 2026" do bloco (menu lateral e o cartão).
export function rotuloDoPeriodo(periodo, filtro) {
  const { start, end } = periodoDoBloco(periodo, filtro);
  return friendlyPeriod(start, end);
}

// ---------------------------------------------------------------------------
// Comparação aberta ao clicar num Número no modo apresentação
// (ComparisonOverlay em components/slides/PresentOverlays.jsx).

// O número mês a mês num contexto: [{ mes, valor }] (um mês só também).
export function serieDoNumero(definition, ctx) {
  const meses = ctx?.months || [];
  if (!definition || !meses.length) return [];
  if (meses.length === 1) {
    try {
      return [{ mes: meses[0], valor: Number(definition.value(ctx).value) }];
    } catch {
      return [];
    }
  }
  return kpiSeries(definition, ctx).map((valor, index) => ({ mes: meses[index], valor }));
}

// "O que mais mudou": as partes da conta — os subgrupos da linha (fórmula
// de uma linha só) ou os termos da fórmula — com o valor nos dois períodos
// e a diferença, da que mais mudou pra que menos mudou.
export function partesDaComparacao(definition, ctxAtual, ctxBase, limite = 8) {
  const formula = definition?.formula;
  if (!formula || !ctxAtual || !ctxBase) return [];
  let partes = [];
  const nomeDa = (code) => (treeFor(ctxAtual, code) || []).find((row) => row.codigo_gerencial === code)?.categoria_gerencial || lineLabel(code);
  if (isSingleLineFormula(formula)) {
    const code = formula.numerator[0].code;
    const mapa = new Map();
    const juntar = (ctx, campo) =>
      directChildren(treeFor(ctx, code) || [], code).forEach((row) => {
        const item = mapa.get(row.codigo_gerencial) || { rotulo: row.categoria_gerencial || lineLabel(row.codigo_gerencial), atual: 0, base: 0 };
        item[campo] = Number(row.saldo || 0);
        mapa.set(row.codigo_gerencial, item);
      });
    juntar(ctxAtual, "atual");
    juntar(ctxBase, "base");
    partes = [...mapa.values()];
    // Subtotal da DRE (receita líquida, lucro bruto, resultado…) não tem
    // filhos: é a soma das linhas do mesmo nível acima dele.
    const linha = (state.plano || []).find((row) => row.codigo_gerencial === code);
    if (!partes.length && linha && /subtotal/i.test(linha.natureza || "")) {
      partes = state.plano
        .filter((row) => row.demonstrativo === linha.demonstrativo && String(row.nivel) === String(linha.nivel) && row.codigo_gerencial < code && !/subtotal/i.test(row.natureza || ""))
        .map((row) => ({ rotulo: nomeDa(row.codigo_gerencial), atual: lineValue(ctxAtual, row.codigo_gerencial), base: lineValue(ctxBase, row.codigo_gerencial) }));
    }
  } else {
    const termos = [...(formula.numerator || []), ...(formula.kind === "ratio" ? formula.denominator || [] : [])];
    partes = termos.map((termo) => {
      const sinal = termo.sign < 0 ? -1 : 1;
      return { rotulo: `${termo.sign < 0 ? "(-) " : ""}${lineLabel(termo.code)}`, atual: sinal * lineValue(ctxAtual, termo.code), base: sinal * lineValue(ctxBase, termo.code) };
    });
  }
  return partes
    .filter((parte) => Math.abs(parte.atual) > 0.005 || Math.abs(parte.base) > 0.005)
    .map((parte) => ({ ...parte, diff: parte.atual - parte.base }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, limite);
}

// Aba "Evolução" da mesma janela: o número num período mais longo, sem
// comparação — os últimos N meses até o fim do período do bloco (ou tudo
// desde o primeiro mês com lançamento), nunca antes do primeiro mês com dado.
export function periodoDaEvolucao(mesesComDados, fim, quantos) {
  const mesFim = String(fim || "").slice(0, 7);
  const meses = (mesesComDados || []).filter((mes) => mes <= mesFim);
  if (!mesFim || !meses.length) return null;
  let inicio = quantos ? somarMeses(mesFim, 1 - quantos) : meses[0];
  if (inicio < meses[0]) inicio = meses[0];
  return { start: `${inicio}-01`, end: fim };
}

// Número de saldo (Balanço): não faz sentido somar os meses.
export function numeroDeSaldo(definition) {
  const formula = definition?.formula;
  const codigos = [...(formula?.numerator || []), ...(formula?.denominator || [])].map((termo) => String(termo.code));
  return codigos.length > 0 && codigos.every((code) => !code.startsWith("DRE") && !code.startsWith("DEX"));
}

export function acumular(serie) {
  let soma = 0;
  return serie.map((ponto) => {
    soma += Number(ponto.valor || 0);
    return { ...ponto, valor: ponto.valor == null ? null : soma };
  });
}

