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
import { budgetFor } from "./budget.js";
import { PME_LIMIT, prazosDoCtx } from "./prazos.js";
import { evaluateIndicatorFormula, describeIndicatorFormula, indicatorDetailRows, richLineDetail, isSingleLineFormula } from "./indicatorFormula.js";

function pct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
}

function ratioText(value) {
  return value == null ? "—" : value.toFixed(2).replace(".", ",");
}

export function formatWidgetValue(value, format) {
  if (format === "days") return value == null || !Number.isFinite(Number(value)) ? "—" : `${Math.round(Number(value))} dias`;
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
  // No plano gerencial padrão DRE.06 são as despesas comerciais e DRE.07 as
  // administrativas (o card "Despesas administrativas" lia DRE.06 por engano).
  lineEntry({ id: "dre_despesas_comerciais", label: "Despesas comerciais", category: "DRE", icon: Receipt, code: "DRE.06" }),
  lineEntry({ id: "dre_despesas_adm", label: "Despesas administrativas", category: "DRE", icon: Receipt, code: "DRE.07" }),
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
  { id: "chart_ponte_caixa", label: "Do lucro ao caixa (ponte)", category: "Gráficos", icon: Waves, defaultSize: "lg", type: "chart", chart: "ponte_caixa" },
  { id: "chart_caixa_evolucao", label: "Evolução do saldo de caixa", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "caixa_evolucao" },
  { id: "chart_ativo_passivo_pl", label: "Ativo x Passivo x PL no tempo", category: "Gráficos", icon: Building, defaultSize: "lg", type: "chart", chart: "ativo_passivo_pl" },
  { id: "chart_receita_custo_despesa", label: "Receita x Custo x Despesa", category: "Gráficos", icon: BarChart3, defaultSize: "lg", type: "chart", chart: "receita_custo_despesa" },
  { id: "chart_pareto_despesas", label: "Maiores despesas (Pareto)", category: "Gráficos", icon: BarChartHorizontal, defaultSize: "lg", type: "chart", chart: "pareto_despesas" },
  { id: "chart_ponto_equilibrio", label: "Ponto de equilíbrio", category: "Gráficos", icon: Target, defaultSize: "lg", type: "chart", chart: "ponto_equilibrio" },
  { id: "chart_ncg_evolucao", label: "Capital de giro no tempo", category: "Gráficos", icon: Coins, defaultSize: "lg", type: "chart", chart: "ncg_evolucao" },
  { id: "chart_comparativo_empresas", label: "Comparativo entre empresas do grupo", category: "Gráficos", icon: Network, defaultSize: "lg", type: "chart", chart: "comparativo_empresas" },
  { id: "chart_radar_indicadores", label: "Radar de indicadores", category: "Gráficos", icon: Radar, defaultSize: "md", type: "chart", chart: "radar_indicadores" },
  { id: "chart_dfc_operacional", label: "Composição do caixa operacional", category: "Gráficos", icon: PieChart, defaultSize: "md", type: "chart", chart: "dfc_operacional" },
  { id: "chart_margens_evolucao", label: "Evolução das margens (bruta e líquida)", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "margens_evolucao" },
  { id: "chart_liquidez_evolucao", label: "Evolução da liquidez", category: "Gráficos", icon: Droplets, defaultSize: "lg", type: "chart", chart: "liquidez_evolucao" },
  { id: "chart_endividamento_evolucao", label: "Evolução do endividamento", category: "Gráficos", icon: ShieldAlert, defaultSize: "lg", type: "chart", chart: "endividamento_evolucao" },
  { id: "chart_dre_cascata", label: "Cascata do resultado (DRE)", category: "Gráficos", icon: Waves, defaultSize: "lg", type: "chart", chart: "dre_cascata" },
  { id: "chart_despesas_composicao", label: "Composição das despesas operacionais", category: "Gráficos", icon: PieChart, defaultSize: "md", type: "chart", chart: "despesas_composicao" },
  { id: "chart_dre_percentual_tempo", label: "Estrutura da DRE no tempo (% da receita)", category: "Gráficos", icon: BarChart3, defaultSize: "lg", type: "chart", chart: "dre_percentual_tempo" },
  { id: "chart_receita_composicao", label: "Composição da receita bruta", category: "Gráficos", icon: PieChart, defaultSize: "md", type: "chart", chart: "receita_composicao" },
  { id: "chart_capital_giro_vs_divida", label: "Capital de giro x Dívida financeira", category: "Gráficos", icon: Coins, defaultSize: "lg", type: "chart", chart: "capital_giro_vs_divida" },
  { id: "chart_pl_evolucao", label: "Evolução do Patrimônio Líquido", category: "Gráficos", icon: Landmark, defaultSize: "lg", type: "chart", chart: "pl_evolucao" },
  { id: "chart_rentabilidade_evolucao", label: "Evolução de ROE e ROA", category: "Gráficos", icon: Percent, defaultSize: "lg", type: "chart", chart: "rentabilidade_evolucao" },

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

// Orçamento x Realizado (lib/budget.js): o principal do ano do período,
// só nos meses do período. Sem orçamento cadastrado mostram "—".
function compactMoney(value) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toFixed(2).replace(".", ",")} mi`;
  if (abs >= 1e4) return `${sign}R$ ${(abs / 1e3).toFixed(1).replace(".", ",")} mil`;
  return money(n);
}

function budgetKpi({ id, label, icon, pick, note }) {
  return {
    id,
    label,
    category: "Orçamento",
    type: "kpi",
    icon,
    defaultSize: "sm",
    value: (ctx) => {
      const item = budgetFor(ctx) ? pick(budgetFor(ctx)) : null;
      return { value: item && item.orcado ? item.reach : null, format: "percent" };
    },
    caption: (ctx) => {
      const budget = budgetFor(ctx);
      if (!budget) return "Sem orçamento para o ano do período";
      const item = pick(budget);
      return `Realizado ${compactMoney(Math.abs(item.realizado))} de ${compactMoney(Math.abs(item.orcado))} orçado${note ? ` — ${note}` : ""}`;
    },
    detail: (ctx) => {
      const budget = budgetFor(ctx);
      if (!budget) return { formula: "Cadastre o orçamento em Orçamento (no topo da empresa).", rows: [] };
      const item = pick(budget);
      return {
        formula: `Realizado ÷ orçado — ${budget.versao}, ${budget.ano}`,
        rows: [
          { label: "Orçado", value: item.orcado },
          { label: "Realizado", value: item.realizado },
          { label: "Diferença (realizado − orçado)", value: item.diff },
          { label: "% do orçado", display: pct(item.reach), bold: true },
        ],
      };
    },
  };
}

export const BUDGET_WIDGETS = [
  budgetKpi({ id: "orc_receita", label: "Receita líquida x orçado", icon: Target, pick: (budget) => budget.receita }),
  budgetKpi({ id: "orc_despesas", label: "Despesas x orçado", icon: Receipt, pick: (budget) => budget.despesas, note: "abaixo de 100% é bom" }),
  budgetKpi({ id: "orc_resultado", label: "Resultado x orçado", icon: PiggyBank, pick: (budget) => budget.resultado }),
  { id: "chart_orcado_realizado", label: "Orçado x realizado mês a mês", category: "Orçamento", icon: BarChart3, defaultSize: "lg", type: "chart", chart: "orcado_realizado" },
  { id: "chart_orcado_tabela", label: "Orçado x realizado (DRE)", category: "Orçamento", icon: Table2, defaultSize: "lg", type: "chart", chart: "orcado_tabela" },
];

// Prazos médios e ciclo financeiro (lib/prazos.js — a mesma conta do
// assistente de slides): saldo médio no balanço ÷ movimento do período ×
// dias do período.
const days = (value) => (value == null ? "—" : `${Math.round(value)} dias`);
function prazoKpi({ id, label, icon, pick, formula, caption, rows }) {
  return {
    id,
    label,
    category: "Indicadores",
    type: "kpi",
    icon,
    defaultSize: "sm",
    value: (ctx) => ({ value: pick(prazosDoCtx(ctx)), format: "days" }),
    caption: (ctx) => caption(prazosDoCtx(ctx)),
    detail: (ctx) => {
      const p = prazosDoCtx(ctx);
      return { formula, rows: [...rows(p), { label: "Resultado", display: days(pick(p)), bold: true }] };
    },
  };
}

const avgLabel = (item) => (item.start + item.end) / 2;

export const PRAZO_WIDGETS = [
  prazoKpi({
    id: "prazo_recebimento",
    label: "Prazo médio de recebimento",
    icon: Coins,
    pick: (p) => p?.pmr,
    formula: "Saldo médio de clientes ÷ receita bruta × dias do período",
    caption: (p) => (p?.pmr == null ? "Sem receita bruta no período" : "Quanto tempo os clientes levam para pagar"),
    rows: (p) => [
      { label: "Clientes no começo", value: p.clientes.start },
      { label: "Clientes no fim", value: p.clientes.end },
      { label: "Saldo médio de clientes", value: avgLabel(p.clientes) },
      { label: "Receita bruta do período", value: p.receitaBruta },
      { label: "Dias do período", display: String(p.days) },
    ],
  }),
  prazoKpi({
    id: "prazo_estoque",
    label: "Prazo médio de estoque",
    icon: Boxes,
    pick: (p) => p?.pme,
    formula: "Saldo médio de estoques ÷ custo do período × dias do período",
    caption: (p) => (p?.pmeRaw != null && p.pme == null ? "O custo da DRE não permite calcular (CMV muito baixo para o estoque)" : p?.pme == null ? "Sem custo apurado no período" : "Quanto tempo a mercadoria fica parada"),
    rows: (p) => [
      { label: "Estoques no começo", value: p.estoques.start },
      { label: "Estoques no fim", value: p.estoques.end },
      { label: "Saldo médio de estoques", value: avgLabel(p.estoques) },
      { label: "Custo do período (DRE)", value: Math.abs(p.custos) },
      { label: "Dias do período", display: String(p.days) },
      ...(p.pmeRaw != null && p.pme == null ? [{ label: `Conta deu ${Math.round(p.pmeRaw)} dias (acima de ${PME_LIMIT}): confira a apuração do custo`, display: "" }] : []),
    ],
  }),
  prazoKpi({
    id: "prazo_pagamento",
    label: "Prazo médio de pagamento",
    icon: Receipt,
    pick: (p) => p?.pmp,
    formula: "Saldo médio de fornecedores ÷ compras (ou custo) × dias do período",
    caption: (p) => (p?.pmp == null ? "Sem compras ou custo no período" : "Quanto tempo a empresa leva para pagar fornecedores"),
    rows: (p) => [
      { label: "Fornecedores no começo", value: p.fornecedores.start },
      { label: "Fornecedores no fim", value: p.fornecedores.end },
      { label: "Saldo médio de fornecedores", value: avgLabel(p.fornecedores) },
      { label: p.pmpPorCompras ? "Compras do período" : "Custo do período (sem compras na DRE)", value: p.pmpBase },
      { label: "Dias do período", display: String(p.days) },
    ],
  }),
  prazoKpi({
    id: "ciclo_financeiro",
    label: "Ciclo financeiro",
    icon: Activity,
    pick: (p) => p?.ciclo,
    formula: "Prazo de recebimento + prazo de estoque − prazo de pagamento",
    caption: (p) => {
      if (p?.ciclo == null) return "Faltam prazos para calcular";
      const base = p.ciclo > 0 ? "Dias que a empresa financia a operação com o próprio caixa" : "Os fornecedores financiam a operação";
      return p.cicloSemEstoque ? `${base} (sem o prazo de estoque: o custo da DRE não permite calcular)` : base;
    },
    rows: (p) => [
      { label: "Prazo médio de recebimento", display: days(p.pmr) },
      { label: "(+) Prazo médio de estoque", display: days(p.pme) },
      { label: "(−) Prazo médio de pagamento", display: days(p.pmp) },
      { label: "Ciclo operacional (recebimento + estoque)", display: days(p.cicloOperacional) },
    ],
  }),
  { id: "chart_prazos_evolucao", label: "Prazos médios e ciclo financeiro no tempo", category: "Gráficos", icon: LineChart, defaultSize: "lg", type: "chart", chart: "prazos_evolucao" },
];

WIDGET_CATALOG.push(...TABLE_WIDGETS, ...LINK_WIDGETS, ...BUDGET_WIDGETS, ...PRAZO_WIDGETS);
