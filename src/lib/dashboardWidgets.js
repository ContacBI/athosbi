import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  Percent,
  Landmark,
  Droplets,
  PiggyBank,
  Receipt,
  Building2,
  Layers,
  BarChart3,
  LineChart,
  PieChart,
  ListChecks,
  AlertTriangle,
  Banknote,
  Coins,
  Gauge,
  ShieldAlert,
  Boxes,
  Activity,
  CircleDollarSign,
  Table2,
  FileBarChart,
  Waves,
  BarChartHorizontal,
  Target,
  Building,
  Radar,
  Network,
} from "lucide-react";
import { money } from "./format.js";
import { evaluateIndicatorFormula, describeIndicatorFormula, indicatorDetailRows, richLineDetail, isSingleLineFormula } from "./indicatorFormula.js";

function pct(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
}

function ratioText(value) {
  return value == null ? "—" : value.toFixed(2).replace(".", ",");
}

export function formatWidgetValue(value, format) {
  if (format === "percent") return pct(value);
  if (format === "ratio") return ratioText(value);
  return money(value);
}

// Every DRE/Balanço/Indicadores catalog entry — built-in or user-created
// alike — is data-driven: a `formula` object (sum-of-signed-lines, or a
// ratio of two such sums) that this derives `value`/`detail` from, instead
// of a hand-written closure per card. That's what makes them editable from
// Parâmetros → B.I. (see lib/indicators.js) — editing one just patches its
// `formula`, and value/detail recompute themselves from it automatically.
function formulaEntry({ id, label, category, icon, defaultSize = "sm", formula }) {
  return {
    id,
    label,
    category,
    type: "kpi",
    icon,
    defaultSize,
    formula,
    builtin: true,
    value: (ctx) => evaluateIndicatorFormula(formula, ctx),
    detail: (ctx) =>
      isSingleLineFormula(formula)
        ? richLineDetail(formula.numerator[0].code, ctx)
        : { formula: describeIndicatorFormula(formula), rows: indicatorDetailRows(formula, ctx) },
  };
}

// A single DRE/BP managerial-plan code, as a one-term "sum" formula — the
// shape every plain DRE/Balanço card used before they became editable.
function lineEntry({ id, label, category, icon, defaultSize = "sm", code, format = "money" }) {
  return formulaEntry({ id, label, category, icon, defaultSize, formula: { kind: "sum", format, numerator: [{ code, sign: 1 }] } });
}

export const WIDGET_CATALOG = [
  // DRE — linhas gerenciais
  lineEntry({ id: "dre_receita_bruta", label: "Receita bruta", category: "DRE", icon: TrendingUp, code: "DRE.01" }),
  lineEntry({ id: "dre_deducoes", label: "Deduções da receita", category: "DRE", icon: TrendingDown, code: "DRE.02" }),
  lineEntry({ id: "dre_receita_liquida", label: "Receita líquida", category: "DRE", icon: TrendingUp, code: "DRE.03" }),
  lineEntry({ id: "dre_custos", label: "Custos diretos", category: "DRE", icon: TrendingDown, code: "DRE.04" }),
  lineEntry({ id: "dre_lucro_bruto", label: "Lucro bruto", category: "DRE", icon: Wallet, code: "DRE.05" }),
  lineEntry({ id: "dre_despesas_adm", label: "Despesas administrativas", category: "DRE", icon: Receipt, code: "DRE.06" }),
  lineEntry({ id: "dre_resultado_operacional", label: "Resultado operacional", category: "DRE", icon: Wallet, code: "DRE.12" }),
  lineEntry({ id: "dre_resultado_financeiro", label: "Resultado financeiro", category: "DRE", icon: Coins, code: "DRE.13" }),
  lineEntry({ id: "dre_resultado_antes_ir", label: "Resultado antes de IR/CSLL", category: "DRE", icon: Scale, code: "DRE.15" }),
  lineEntry({ id: "dre_impostos", label: "IRPJ e CSLL", category: "DRE", icon: Receipt, code: "DRE.16" }),
  lineEntry({ id: "dre_resultado_liquido", label: "Resultado líquido do período", category: "DRE", icon: PiggyBank, code: "DRE.17" }),

  // Balanço patrimonial
  lineEntry({ id: "bp_ativo", label: "Total do ativo", category: "Balanço", icon: Landmark, code: "01" }),
  lineEntry({ id: "bp_ativo_circulante", label: "Ativo circulante", category: "Balanço", icon: Boxes, code: "01.01" }),
  lineEntry({ id: "bp_ativo_nao_circulante", label: "Ativo não circulante", category: "Balanço", icon: Building2, code: "01.02" }),
  lineEntry({ id: "bp_passivo", label: "Total do passivo", category: "Balanço", icon: Landmark, code: "02" }),
  lineEntry({ id: "bp_passivo_circulante", label: "Passivo circulante", category: "Balanço", icon: Boxes, code: "02.01" }),
  lineEntry({ id: "bp_passivo_nao_circulante", label: "Passivo não circulante", category: "Balanço", icon: Building2, code: "02.02" }),
  lineEntry({ id: "bp_pl", label: "Patrimônio líquido", category: "Balanço", icon: Layers, code: "03" }),

  // Indicadores calculados
  formulaEntry({
    id: "ratio_margem_bruta",
    label: "Margem bruta",
    category: "Indicadores",
    icon: Scale,
    formula: { kind: "ratio", format: "percent", numerator: [{ code: "DRE.05", sign: 1 }], denominator: [{ code: "DRE.03", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_margem_liquida",
    label: "Margem líquida",
    category: "Indicadores",
    icon: Percent,
    formula: { kind: "ratio", format: "percent", numerator: [{ code: "DRE.17", sign: 1 }], denominator: [{ code: "DRE.03", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_margem_ebitda",
    label: "Margem EBITDA",
    category: "Indicadores",
    icon: Gauge,
    formula: {
      kind: "ratio",
      format: "percent",
      numerator: [{ code: "DEX.08", sign: 1 }, { code: "DEX.09", sign: 1 }],
      denominator: [{ code: "DRE.03", sign: 1 }],
    },
  }),
  formulaEntry({
    id: "ratio_ebitda",
    label: "EBITDA",
    category: "Indicadores",
    icon: Activity,
    formula: { kind: "sum", format: "money", numerator: [{ code: "DEX.08", sign: 1 }, { code: "DEX.09", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_liquidez_corrente",
    label: "Liquidez corrente",
    category: "Indicadores",
    icon: Droplets,
    formula: { kind: "ratio", format: "ratio", numerator: [{ code: "01.01", sign: 1 }], denominator: [{ code: "02.01", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_liquidez_geral",
    label: "Liquidez geral",
    category: "Indicadores",
    icon: Droplets,
    formula: { kind: "ratio", format: "ratio", numerator: [{ code: "01", sign: 1 }], denominator: [{ code: "02", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_endividamento",
    label: "Endividamento (Passivo/PL)",
    category: "Indicadores",
    icon: ShieldAlert,
    formula: { kind: "ratio", format: "ratio", numerator: [{ code: "02", sign: 1 }], denominator: [{ code: "03", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_ativo_total",
    label: "Total do ativo (visão indicadores)",
    category: "Indicadores",
    icon: CircleDollarSign,
    formula: { kind: "sum", format: "money", numerator: [{ code: "01", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_roe",
    label: "ROE (retorno sobre o PL)",
    category: "Indicadores",
    icon: Percent,
    formula: { kind: "ratio", format: "percent", numerator: [{ code: "DRE.17", sign: 1 }], denominator: [{ code: "03", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_roa",
    label: "ROA (retorno sobre o ativo)",
    category: "Indicadores",
    icon: Percent,
    formula: { kind: "ratio", format: "percent", numerator: [{ code: "DRE.17", sign: 1 }], denominator: [{ code: "01", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_margem_operacional",
    label: "Margem operacional",
    category: "Indicadores",
    icon: Gauge,
    formula: { kind: "ratio", format: "percent", numerator: [{ code: "DRE.12", sign: 1 }], denominator: [{ code: "DRE.03", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_giro_ativo",
    label: "Giro do ativo",
    category: "Indicadores",
    icon: Activity,
    formula: { kind: "ratio", format: "ratio", numerator: [{ code: "DRE.03", sign: 1 }], denominator: [{ code: "01", sign: 1 }] },
  }),
  formulaEntry({
    id: "ratio_capital_giro",
    label: "Capital de giro",
    category: "Indicadores",
    icon: Coins,
    formula: { kind: "sum", format: "money", numerator: [{ code: "01.01", sign: 1 }, { code: "02.01", sign: -1 }] },
  }),
  formulaEntry({
    id: "ratio_composicao_endividamento",
    label: "Composição do endividamento",
    category: "Indicadores",
    icon: ShieldAlert,
    formula: { kind: "ratio", format: "percent", numerator: [{ code: "02.01", sign: 1 }], denominator: [{ code: "02", sign: 1 }] },
  }),

  // Gráficos
  { id: "chart_resultado", label: "Composição do resultado", category: "Gráficos", icon: BarChart3, defaultSize: "lg", type: "chart", chart: "resultado" },
  { id: "chart_balanco", label: "Composição do balanço", category: "Gráficos", icon: PieChart, defaultSize: "md", type: "chart", chart: "balanco" },
  { id: "chart_receita_evolucao", label: "Evolução da receita líquida", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "receita_evolucao" },
  { id: "chart_ebitda_evolucao", label: "Evolução do EBITDA", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "ebitda_evolucao" },
  { id: "chart_margem_ebitda", label: "Margem EBITDA no tempo", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "margem_ebitda" },
  { id: "chart_lucro_evolucao", label: "Evolução do lucro líquido", category: "Gráficos", icon: BarChart3, defaultSize: "lg", type: "chart", chart: "lucro_evolucao" },
  { id: "chart_margens_comparativo", label: "Comparativo de margens", category: "Gráficos", icon: BarChart3, defaultSize: "md", type: "chart", chart: "margens_comparativo" },
  { id: "chart_estrutura_capital", label: "Estrutura de capital (Passivo x PL)", category: "Gráficos", icon: PieChart, defaultSize: "md", type: "chart", chart: "estrutura_capital" },
  { id: "chart_dfc_cascata", label: "Cascata do fluxo de caixa (DFC)", category: "Gráficos", icon: Waves, defaultSize: "lg", type: "chart", chart: "dfc_cascata" },
  { id: "chart_caixa_evolucao", label: "Evolução do saldo de caixa", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "caixa_evolucao" },
  { id: "chart_ativo_passivo_pl", label: "Ativo x Passivo x PL no tempo", category: "Gráficos", icon: Building, defaultSize: "lg", type: "chart", chart: "ativo_passivo_pl" },
  { id: "chart_receita_custo_despesa", label: "Receita x Custo x Despesa", category: "Gráficos", icon: BarChart3, defaultSize: "lg", type: "chart", chart: "receita_custo_despesa" },
  { id: "chart_pareto_despesas", label: "Maiores despesas (Pareto)", category: "Gráficos", icon: BarChartHorizontal, defaultSize: "lg", type: "chart", chart: "pareto_despesas" },
  { id: "chart_ponto_equilibrio", label: "Ponto de equilíbrio", category: "Gráficos", icon: Target, defaultSize: "lg", type: "chart", chart: "ponto_equilibrio" },
  { id: "chart_ncg_evolucao", label: "Capital de giro no tempo", category: "Gráficos", icon: Coins, defaultSize: "lg", type: "chart", chart: "ncg_evolucao" },
  { id: "chart_comparativo_empresas", label: "Comparativo entre empresas do grupo", category: "Gráficos", icon: Network, defaultSize: "lg", type: "chart", chart: "comparativo_empresas" },
  { id: "chart_radar_indicadores", label: "Radar de indicadores", category: "Gráficos", icon: Radar, defaultSize: "md", type: "chart", chart: "radar_indicadores" },
  { id: "chart_dfc_operacional", label: "Composição do caixa operacional", category: "Gráficos", icon: PieChart, defaultSize: "md", type: "chart", chart: "dfc_operacional" },

  // Listas e resumos
  { id: "list_destaques_dre", label: "Destaques da DRE", category: "Listas", icon: ListChecks, defaultSize: "md", type: "list", list: "destaques_dre" },
  { id: "list_checklist", label: "Próximos passos", category: "Listas", icon: ListChecks, defaultSize: "md", type: "list", list: "checklist" },
  { id: "list_sem_depara", label: "Contas sem de/para", category: "Listas", icon: AlertTriangle, defaultSize: "md", type: "list", list: "sem_depara" },

  // Extras — atalhos monetários rápidos
  lineEntry({ id: "dre_despesas_operacionais", label: "Outras despesas operacionais", category: "DRE", icon: Receipt, code: "DRE.09" }),
  lineEntry({ id: "dre_tributos_op", label: "Tributos e provisões operacionais", category: "DRE", icon: Receipt, code: "DRE.08" }),
  lineEntry({ id: "bp_disponibilidades", label: "Caixa e equivalentes", category: "Balanço", icon: Banknote, code: "01.01.01" }),
];

// Demonstrações — a própria DRE/Balanço/DRE Executiva em versão resumida
// (só linhas sintéticas até o nível 2, sem abrir/fechar), pra quem quer
// literalmente montar o resumo com pedaços dos relatórios completos.
export const TABLE_WIDGETS = [
  { id: "table_dre_resumo", label: "DRE resumida", category: "Demonstrações", icon: Table2, defaultSize: "lg", type: "table", table: "dre_resumida" },
  { id: "table_bp_resumo", label: "Balanço resumido", category: "Demonstrações", icon: Table2, defaultSize: "lg", type: "table", table: "bp" },
  { id: "table_dre_executiva", label: "EBITDA", category: "Demonstrações", icon: Table2, defaultSize: "lg", type: "table", table: "executiva" },
  { id: "table_dfc_direta", label: "DFC direta (resumo)", category: "Demonstrações", icon: Table2, defaultSize: "lg", type: "table", table: "dfc_direta" },
  { id: "table_dfc_indireta", label: "DFC indireta (resumo)", category: "Demonstrações", icon: Table2, defaultSize: "lg", type: "table", table: "dfc_indireta" },
];

// The full interactive report tool (DRE/BP, comparativo, DRE Executiva,
// gráficos EBITDA, PDF/Excel) — not a "widget" with real data of its own,
// just a card that opens it. Lives in the catalog like everything else: the
// user decides if/where it shows up, nothing pins it to the nav by default.
export const LINK_WIDGETS = [
  {
    id: "link_dre_completo",
    label: "DRE completo",
    category: "Demonstrações",
    icon: FileBarChart,
    defaultSize: "lg",
    type: "link",
    href: "/empresa/demonstrativos",
    navState: { tab: "DRE" },
    preview: "dre_resumida",
    description: "DRE completa e interativa: comparativo, análise vertical, DRE Ebitda, gráficos EBITDA e exportação.",
  },
  {
    id: "link_balanco_completo",
    label: "Balanço completo",
    category: "Demonstrações",
    icon: FileBarChart,
    defaultSize: "lg",
    type: "link",
    href: "/empresa/demonstrativos",
    navState: { tab: "BP" },
    preview: "bp_resumo",
    description: "Balanço patrimonial completo e interativo: comparativo, análise vertical e exportação.",
  },
  {
    id: "link_dfc_direta",
    label: "DFC direta",
    category: "Demonstrações",
    icon: FileBarChart,
    defaultSize: "lg",
    type: "link",
    href: "/empresa/dfc",
    navState: { mode: "direct" },
    description: "Demonstração dos fluxos de caixa pelo método direto, com movimentos operacionais, de investimento e financiamento.",
  },
  {
    id: "link_dfc_indireta",
    label: "DFC indireta",
    category: "Demonstrações",
    icon: FileBarChart,
    defaultSize: "lg",
    type: "link",
    href: "/empresa/dfc",
    navState: { mode: "indirect" },
    description: "Demonstração dos fluxos de caixa pelo método indireto, conciliando resultado, capital de giro e caixa final.",
  },
];

WIDGET_CATALOG.push(...TABLE_WIDGETS, ...LINK_WIDGETS);
