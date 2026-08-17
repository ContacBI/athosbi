import { buildReportTree, kpis, reportMonths, missingMappingAccounts } from "../data/calculations.js";
import { buildExecutiveDreRows, ebitdaChartData, DRE_RESUMIDA_MAP } from "./executiveDre.js";

export function monthLabel(month) {
  const [year, mm] = String(month || "").split("-");
  return year && mm ? `${mm}/${year.slice(2)}` : month;
}

function findRow(tree, code) {
  return tree.find((row) => row.codigo_gerencial === code);
}

// Computes every number any dashboard widget could possibly need, once —
// so a 30-widget grid does one pass over the ledger instead of thirty.
export function buildDashboardContext() {
  const dre = buildReportTree("DRE");
  const bp = buildReportTree("BP");
  const months = reportMonths();
  const indicators = kpis();
  const executive = buildExecutiveDreRows(dre);
  const dreResumida = buildExecutiveDreRows(dre, DRE_RESUMIDA_MAP);

  const grossProfitRow = findRow(dre, "DRE.05");
  const margemBruta = indicators.receita && grossProfitRow ? (Number(grossProfitRow.saldo || 0) / indicators.receita) * 100 : 0;
  const margemLiquida = indicators.receita ? (indicators.resultado / indicators.receita) * 100 : 0;

  const ebitdaRow = executive.find((row) => row.codigo_gerencial === "DEX.10");
  const margemEbitdaRow = executive.find((row) => row.codigo_gerencial === "DEX.11");
  const ebitda = Number(ebitdaRow?.saldo || 0);
  const margemEbitda = Number(margemEbitdaRow?.saldo || 0);

  const ativoCirculante = findRow(bp, "01.01");
  const passivoCirculante = findRow(bp, "02.01");
  const ativoTotal = findRow(bp, "01");
  const passivoTotal = findRow(bp, "02");
  const plTotal = findRow(bp, "03");

  const liquidezCorrente =
    ativoCirculante && passivoCirculante && Number(passivoCirculante.saldo || 0) !== 0
      ? Number(ativoCirculante.saldo || 0) / Math.abs(Number(passivoCirculante.saldo || 0))
      : null;
  const liquidezGeral =
    ativoTotal && passivoTotal && Number(passivoTotal.saldo || 0) !== 0
      ? Number(ativoTotal.saldo || 0) / Math.abs(Number(passivoTotal.saldo || 0))
      : null;
  const endividamento =
    plTotal && passivoTotal && Number(plTotal.saldo || 0) !== 0
      ? Math.abs(Number(passivoTotal.saldo || 0)) / Math.abs(Number(plTotal.saldo || 0))
      : null;

  // Rentabilidade e eficiência — cruzam DRE com Balanço.
  const operatingResult = Number(findRow(dre, "DRE.12")?.saldo || 0);
  const roe = plTotal && Number(plTotal.saldo || 0) !== 0 ? (indicators.resultado / Math.abs(Number(plTotal.saldo || 0))) * 100 : 0;
  const roa = indicators.totalAtivo ? (indicators.resultado / Math.abs(indicators.totalAtivo)) * 100 : 0;
  const margemOperacional = indicators.receita ? (operatingResult / indicators.receita) * 100 : 0;
  const giroAtivo = indicators.totalAtivo ? indicators.receita / Math.abs(indicators.totalAtivo) : 0;
  const capitalGiro = Number(ativoCirculante?.saldo || 0) - Number(passivoCirculante?.saldo || 0);
  const composicaoEndividamento =
    passivoTotal && Number(passivoTotal.saldo || 0) !== 0
      ? (Number(passivoCirculante?.saldo || 0) / Math.abs(Number(passivoTotal.saldo || 0))) * 100
      : 0;

  const revenueRow = findRow(dre, "DRE.03");
  const resultRow = findRow(dre, "DRE.17") || findRow(dre, "DRE.12");
  const series = months.map((month) => ({
    month: monthLabel(month),
    receita: Number(revenueRow?.monthValues?.[month] || 0),
    resultado: Number(resultRow?.monthValues?.[month] || 0),
  }));

  const destaques = dre
    .filter((row) => row.hasValue && Number(row.nivel || 0) >= 2)
    .sort((a, b) => Math.abs(Number(b.saldo || 0)) - Math.abs(Number(a.saldo || 0)))
    .slice(0, 6);

  const missing = missingMappingAccounts();
  const checklist = [
    { label: "Balanço fechando", done: Math.abs(indicators.diferencaBalanco) < 1 },
    { label: "Todas as contas mapeadas no de/para", done: missing.length === 0 },
  ];

  const ebitdaSeries = ebitdaChartData(executive, months, monthLabel);

  return {
    dre,
    bp,
    executive,
    dreResumida,
    months,
    indicators,
    margemBruta,
    margemLiquida,
    margemEbitda,
    ebitda,
    liquidezCorrente,
    liquidezGeral,
    endividamento,
    roe,
    roa,
    margemOperacional,
    giroAtivo,
    capitalGiro,
    composicaoEndividamento,
    series,
    ebitdaSeries,
    destaques,
    checklist,
    missing,
  };
}
