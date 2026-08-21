import { buildReportTree, buildDfcDirect, kpis, reportMonths, missingMappingAccounts } from "../data/calculations.js";
import { buildExecutiveDreRows, ebitdaChartData, DRE_RESUMIDA_MAP } from "./executiveDre.js";
import { accumulatedBalanceValue } from "./reportColumns.js";
import { activeGroup } from "./groups.js";
import { buildPerCompanyReports } from "./groupExport.js";

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

  // --- DFC: caixa mensal, cascata do período, composição do operacional ---
  // buildDfcDirect() já resolve tudo (juntar lançamentos compostos, ignorar
  // transferência entre caixas etc.) — os gráficos aqui só leem o resultado,
  // igual a tela de DFC faz.
  const dfc = buildDfcDirect();
  const findDfc = (code) => dfc.find((row) => row.codigo_gerencial === code);
  const dfcCashEnd = findDfc("DFC.CASH.FIM");
  const cashSeries = months.map((month) => ({ month: monthLabel(month), saldo: Number(dfcCashEnd?.monthValues?.[month] || 0) }));

  const cashStart = Number(findDfc("DFC.CASH.INICIO")?.saldo || 0);
  const opCaixa = Number(findDfc("DFC.OP.CAIXA_LIQUIDO")?.saldo || 0);
  const invCaixa = Number(findDfc("DFC.INV.CAIXA_LIQUIDO")?.saldo || 0);
  const finCaixa = Number(findDfc("DFC.FIN.CAIXA_LIQUIDO")?.saldo || 0);
  const cashEnd = Number(dfcCashEnd?.saldo || 0);
  const dfcWaterfall = [
    { name: "Saldo inicial", value: cashStart, isTotal: true },
    { name: "Operacional", value: opCaixa },
    { name: "Investimento", value: invCaixa },
    { name: "Financiamento", value: finCaixa },
    { name: "Saldo final", value: cashEnd, isTotal: true },
  ];

  const dfcOperationalCodes = [
    ["DFC.OP.CLIENTES", "Clientes"],
    ["DFC.OP.FORNECEDORES", "Fornecedores"],
    ["DFC.OP.EMPREGADOS", "Empregados"],
    ["DFC.OP.REC_FIN", "Receitas financeiras"],
    ["DFC.OP.DESP_FIN", "Despesas financeiras"],
    ["DFC.OP.TRIBUTOS", "Tributos"],
    ["DFC.OP.SEGUROS", "Seguros"],
    ["DFC.OP.LUCROS_DIV_RECEBIDOS", "Lucros e dividendos recebidos"],
    ["DFC.OP.OUTROS", "Outros"],
  ];
  const dfcOperationalComposition = dfcOperationalCodes
    .map(([code, name]) => ({ name, value: Math.abs(Number(findDfc(code)?.saldo || 0)) }))
    .filter((item) => item.value > 0.005);

  // --- Balanço no tempo: Ativo x Passivo x PL mês a mês ---
  // Mesmo saldo acumulado (saldo anterior + movimento até o mês) que a tela
  // de Demonstrativos usa no modo "Saldo acumulado" — não o saldo_atual
  // fixo do balancete, senão todo mês mostraria o mesmo valor "de hoje".
  const bpSeries = months.map((month) => ({
    month: monthLabel(month),
    ativo: ativoTotal ? accumulatedBalanceValue(ativoTotal, month, months) : 0,
    passivo: passivoTotal ? accumulatedBalanceValue(passivoTotal, month, months) : 0,
    pl: plTotal ? accumulatedBalanceValue(plTotal, month, months) : 0,
  }));

  // --- Capital de giro (NCG, na definição simples já usada no indicador
  // "Capital de giro" — Ativo circulante − Passivo circulante, não filtrado
  // só pra itens operacionais) mês a mês, mesmo saldo acumulado acima.
  const ncgSeries = months.map((month) => ({
    month: monthLabel(month),
    value:
      (ativoCirculante ? accumulatedBalanceValue(ativoCirculante, month, months) : 0) -
      (passivoCirculante ? accumulatedBalanceValue(passivoCirculante, month, months) : 0),
  }));

  // --- Receita x Custo x Despesa mês a mês + margem líquida sobreposta ---
  const custoRow = findRow(dre, "DRE.04");
  const despesaCodes = ["DRE.06", "DRE.07", "DRE.08", "DRE.09"];
  const despesaRows = despesaCodes.map((code) => findRow(dre, code)).filter(Boolean);
  const expenseSeries = months.map((month) => {
    const receita = Number(revenueRow?.monthValues?.[month] || 0);
    const custo = Number(custoRow?.monthValues?.[month] || 0);
    const despesa = despesaRows.reduce((sum, row) => sum + Number(row.monthValues?.[month] || 0), 0);
    const resultado = Number(resultRow?.monthValues?.[month] || 0);
    return { month: monthLabel(month), receita, custo, despesa, margem: receita ? (resultado / receita) * 100 : 0 };
  });

  // --- Pareto de despesas: maiores linhas de despesa da DRE, maior pro
  // menor. Uma linha "crua" (não formada por fórmula — DRE.01/02/04/06-09/
  // 11/13/14/16) NUNCA tem row.saldo preenchido (só as linhas de fórmula
  // como DRE.03/05/10/12/15/17 têm, via applyDreFormulas) — o valor de
  // verdade mora em monthValues, mesma convenção que kpis() já usa pra
  // ler receita/resultado. periodValue() replica isso aqui. Exclui as
  // linhas de fórmula (são somatórios de outras, contariam a mesma
  // despesa duas vezes) e linhas com filhos sintéticos (mesmo motivo, num
  // plano com mais níveis).
  const DRE_FORMULA_CODES = new Set(["DRE.03", "DRE.05", "DRE.10", "DRE.12", "DRE.15", "DRE.17"]);
  function periodValue(row) {
    if (!row) return 0;
    const values = Object.values(row.monthValues || {});
    return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) : Number(row.saldo || 0);
  }
  const paretoDespesas = dre
    .filter((row) => !DRE_FORMULA_CODES.has(row.codigo_gerencial) && !row.hasSyntheticChildren && periodValue(row) < -0.005)
    .sort((a, b) => periodValue(a) - periodValue(b))
    .slice(0, 8)
    .map((row) => ({ name: row.categoria_gerencial, value: Math.abs(periodValue(row)) }));

  // --- Ponto de equilíbrio ---
  // Convenção simples e explícita (sem uma classificação fixo/variável
  // própria em nenhum lugar do app hoje — breakEvenMode existe no estado
  // mas nunca foi usado por nenhuma tela): Custos diretos (DRE.04) como
  // variável, as 4 linhas de despesas operacionais (DRE.06-09) como fixo.
  // Reaproveita as somas mensais de expenseSeries (já corretas, lidas de
  // monthValues) em vez de repetir a leitura de .saldo que não funciona
  // pra essas linhas cruas. Se isso não bater com a realidade de alguma
  // empresa, é só avisar que eu ajusto o critério.
  const fixedCosts = Math.abs(expenseSeries.reduce((sum, m) => sum + m.despesa, 0));
  const variableCosts = Math.abs(expenseSeries.reduce((sum, m) => sum + m.custo, 0));
  const variableCostRatio = indicators.receita ? variableCosts / indicators.receita : 0;
  const contributionMargin = 1 - variableCostRatio;
  const breakEvenRevenue = contributionMargin > 0.0001 ? fixedCosts / contributionMargin : null;
  const breakEvenSeries = months.map((month) => {
    const receita = Number(revenueRow?.monthValues?.[month] || 0);
    const custoMes = Math.abs(Number(custoRow?.monthValues?.[month] || 0));
    const despesaMes = Math.abs(despesaRows.reduce((sum, row) => sum + Number(row.monthValues?.[month] || 0), 0));
    return { month: monthLabel(month), receita, custoTotal: custoMes + despesaMes };
  });
  const breakEven = { fixedCosts, variableCostRatio, breakEvenRevenue, currentRevenue: indicators.receita, series: breakEvenSeries };

  // --- Comparativo entre empresas do grupo — só existe em modo grupo; a
  // tela mostra uma mensagem quando não há grupo ativo em vez de esconder
  // o widget do catálogo (mesmo padrão dos outros gráficos, que sempre
  // aparecem no catálogo e lidam com "sem dado" no próprio componente).
  // Cada empresa é recalculada com o estado global temporariamente
  // escopado pra ela (ver groupExport.js — mesmo mecanismo do export
  // "Consolidado + Individual"), nunca reaproveitando os números já
  // mesclados do grupo.
  const group = activeGroup();
  const groupComparison = group
    ? buildPerCompanyReports(group, () => {
        const companyDre = buildReportTree("DRE");
        const companyExecutive = buildExecutiveDreRows(companyDre);
        const companyKpis = kpis();
        const companyEbitdaRow = companyExecutive.find((row) => row.codigo_gerencial === "DEX.10");
        return { receita: companyKpis.receita, ebitda: Number(companyEbitdaRow?.saldo || 0), lucro: companyKpis.resultado };
      }).map(({ company, data }) => ({ name: company.name, ...data }))
    : null;

  // --- Radar de indicadores: 4 métricas em escalas bem diferentes (razão,
  // razão, %, %) normalizadas pra 0-100 contra uma referência de mercado
  // comum (não uma meta configurada pela empresa — não existe uma hoje).
  // Faixas usadas: liquidez corrente 0→0, 2,0+→100; endividamento (quanto
  // MENOR melhor) 0→100, 3,0+→0; margem líquida -10%→0, 20%+→100; ROE
  // -10%→0, 30%+→100. É só uma leitura rápida "acima/abaixo da média",
  // não substitui olhar o número real (que aparece no tooltip).
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const scoreUp = (value, min, max) => (value == null ? 0 : clamp01((value - min) / (max - min)) * 100);
  const scoreDown = (value, min, max) => (value == null ? 0 : clamp01((max - value) / (max - min)) * 100);
  const radarIndicators = [
    { indicator: "Liquidez corrente", score: scoreUp(liquidezCorrente, 0, 2), raw: liquidezCorrente, format: "ratio" },
    { indicator: "Endividamento", score: scoreDown(endividamento, 0, 3), raw: endividamento, format: "ratio" },
    { indicator: "Margem líquida", score: scoreUp(margemLiquida, -10, 20), raw: margemLiquida, format: "percent" },
    { indicator: "ROE", score: scoreUp(roe, -10, 30), raw: roe, format: "percent" },
  ];

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
    dfc,
    cashSeries,
    dfcWaterfall,
    dfcOperationalComposition,
    bpSeries,
    ncgSeries,
    expenseSeries,
    paretoDespesas,
    breakEven,
    groupComparison,
    radarIndicators,
    destaques,
    checklist,
    missing,
  };
}
