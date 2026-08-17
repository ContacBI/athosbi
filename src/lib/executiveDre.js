// Faithful port of the legacy portal's "DRE Executiva" mapping — a fixed,
// flat, investor-style rollup of the same managerial DRE tree, plus the
// derived EBITDA and EBITDA-margin lines.
export const EXECUTIVE_DRE_MAP = [
  { code: "DEX.01", name: "Receita Bruta", sources: ["DRE.01"] },
  { code: "DEX.02", name: "(-) Tributos e deduções sobre a Receita", sources: ["DRE.02"] },
  { code: "DEX.03", name: "Receita Líquida", sources: ["DRE.03"], formula: true },
  { code: "DEX.04", name: "(-) Custos dos Serviços", sources: ["DRE.04"] },
  { code: "DEX.05", name: "Resultado Bruto", sources: ["DRE.05"], formula: true },
  { code: "DEX.06", name: "(-) Despesas Administrativas e Operacionais", sources: ["DRE.06", "DRE.07", "DRE.08"] },
  { code: "DEX.07", name: "Outras Receitas/Despesas Operacionais", sources: ["DRE.09"] },
  { code: "DEX.08", name: "Resultado antes do Resultado Financeiro (EBIT)", sources: ["DRE.12"], formula: true },
  { code: "DEX.09", name: "(+) Depreciação e Amortização", sources: ["DRE.11"], invert: true },
  { code: "DEX.10", name: "EBITDA", sources: ["DRE.10"], formula: true },
  { code: "DEX.11", name: "Margem EBITDA (% da Receita Líquida)", percentage: true },
  { code: "DEX.12", name: "Resultados não operacionais", sources: ["DRE.14"] },
  { code: "DEX.13", name: "Receitas Financeiras", sources: ["DRE.13.01"] },
  { code: "DEX.14", name: "(-) Despesas Financeiras", sources: ["DRE.13.02", "DRE.13.03"] },
  { code: "DEX.15", name: "Resultado antes dos Tributos sobre o Lucro", sources: ["DRE.15"], formula: true },
  { code: "DEX.16", name: "(-) IRPJ e CSLL", sources: ["DRE.16"] },
  { code: "DEX.17", name: "Lucro (Prejuízo) Líquido do Período", sources: ["DRE.17"], formula: true },
];

// A shorter, non-EBITDA rollup — same "sum these DRE codes into one line"
// mechanics as the executive map, just a plainer set of lines: bruto,
// líquido, resultado financeiro as one line, no EBIT/D&A/margin/IRPJ.
export const DRE_RESUMIDA_MAP = [
  { code: "DRS.01", name: "Receita Bruta", sources: ["DRE.01"] },
  { code: "DRS.02", name: "(-) Impostos e deduções", sources: ["DRE.02"] },
  { code: "DRS.03", name: "Receita Líquida", sources: ["DRE.03"], formula: true },
  { code: "DRS.04", name: "(-) Custo", sources: ["DRE.04"] },
  { code: "DRS.05", name: "Resultado Bruto", sources: ["DRE.05"], formula: true },
  { code: "DRS.06", name: "(-) Despesas operacionais", sources: ["DRE.06", "DRE.07", "DRE.08"] },
  { code: "DRS.07", name: "Outras receitas e despesas", sources: ["DRE.09"] },
  { code: "DRS.08", name: "Resultado financeiro", sources: ["DRE.13"] },
  { code: "DRS.09", name: "Resultado antes dos tributos sobre o lucro", sources: ["DRE.15"], formula: true },
  { code: "DRS.10", name: "Lucro (Prejuízo) líquido do período", sources: ["DRE.17"], formula: true },
];

export function buildExecutiveDreRows(dreRows, map = EXECUTIVE_DRE_MAP) {
  const byCode = new Map(dreRows.map((row) => [row.codigo_gerencial, row]));
  const built = map.map((definition) => {
    const sources = (definition.sources || []).map((code) => byCode.get(code)).filter(Boolean);
    const factor = definition.invert ? -1 : 1;
    const monthKeys = new Set(sources.flatMap((row) => Object.keys(row.monthValues || {})));
    const sum = (key) => factor * sources.reduce((total, row) => total + Number(row[key] || 0), 0);
    return {
      codigo_gerencial: definition.code,
      categoria_gerencial: definition.name,
      demonstrativo: "DRE",
      kind: "synthetic",
      nivel: definition.formula ? 1 : 2,
      isFormula: Boolean(definition.formula),
      isPercentage: Boolean(definition.percentage),
      natureza: "synthetic",
      qtd_lancamentos: sources.reduce((total, row) => total + Number(row.qtd_lancamentos || 0), 0),
      saldo: sum("saldo"),
      saldo_inicial: sum("saldo_inicial"),
      saldo_anterior_balancete: sum("saldo_anterior_balancete"),
      movimento_periodo: sum("movimento_periodo"),
      saldo_final: sum("saldo_final"),
      monthValues: Object.fromEntries(
        [...monthKeys].map((month) => [month, factor * sources.reduce((total, row) => total + Number(row.monthValues?.[month] || 0), 0)])
      ),
      hasValue: sources.some((row) => row.hasValue || row.qtd_lancamentos) || definition.percentage,
    };
  });

  const byExecutiveCode = new Map(built.map((row) => [row.codigo_gerencial, row]));
  const margin = byExecutiveCode.get("DEX.11");
  const ebitda = byExecutiveCode.get("DEX.10");
  const netRevenue = byExecutiveCode.get("DEX.03");
  if (margin && ebitda && netRevenue) applyExecutiveMargin(margin, ebitda, netRevenue);
  return built;
}

function applyExecutiveMargin(target, ebitda, netRevenue) {
  const months = new Set([...Object.keys(ebitda.monthValues || {}), ...Object.keys(netRevenue.monthValues || {})]);
  const ratio = (numerator, denominator) =>
    Math.abs(Number(denominator || 0)) < 0.005 ? 0 : (Number(numerator || 0) / Number(denominator || 0)) * 100;
  target.saldo = ratio(ebitda.saldo, netRevenue.saldo);
  target.saldo_anterior_balancete = ratio(ebitda.saldo_anterior_balancete, netRevenue.saldo_anterior_balancete);
  target.movimento_periodo = ratio(ebitda.movimento_periodo, netRevenue.movimento_periodo);
  target.saldo_final = target.saldo;
  target.monthValues = Object.fromEntries(
    [...months].map((month) => [month, ratio(ebitda.monthValues?.[month], netRevenue.monthValues?.[month])])
  );
  target.hasValue = ebitda.hasValue || netRevenue.hasValue;
}

export function ebitdaChartData(executiveRows, months, monthLabel) {
  const find = (code) => executiveRows.find((row) => row.codigo_gerencial === code);
  const revenue = find("DEX.03");
  const ebitda = find("DEX.10");
  const margin = find("DEX.11");
  const financialRevenue = find("DEX.13");
  const financialExpense = find("DEX.14");
  const netIncome = find("DEX.17");
  return months.map((month) => ({
    month: monthLabel(month),
    revenue: Number(revenue?.monthValues?.[month] || 0),
    ebitda: Number(ebitda?.monthValues?.[month] || 0),
    margin: Number(margin?.monthValues?.[month] || 0),
    financialRevenue: Number(financialRevenue?.monthValues?.[month] || 0),
    financialExpense: Math.abs(Number(financialExpense?.monthValues?.[month] || 0)),
    netIncome: Number(netIncome?.monthValues?.[month] || 0),
  }));
}
