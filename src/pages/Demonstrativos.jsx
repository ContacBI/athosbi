import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, Maximize2, Minimize2, Search, TriangleAlert } from "lucide-react";
import { useAppState, setData, state } from "../data/useStore.js";
import { visibleReportRows, missingMappingAccounts, reportMonths, buildReportTree } from "../data/calculations.js";
import { rowsForPeriod, rowValue, rowKey } from "../lib/periodCompare.js";
import { reportColumns, columnLabel, columnValue, isZeroNoMovement, horizontalPercent } from "../lib/reportColumns.js";
import { exportDemonstrativoPdf } from "../lib/reportPdf.js";
import { exportDemonstrativoExcel } from "../lib/reportExcel.js";
import { buildExecutiveDreRows, ebitdaChartData } from "../lib/executiveDre.js";
import { money, moneyOrDash, periodLabelPt } from "../lib/format.js";
import { useDownloadHandlers } from "../lib/pageActions.jsx";
import { activeWorkspaceName } from "../lib/groups.js";
import Placeholder from "../components/Placeholder.jsx";
import LedgerModal from "../components/LedgerModal.jsx";
import Sparkline from "../components/Sparkline.jsx";
import MiniBar from "../components/MiniBar.jsx";
import ReportSettingsMenu from "../components/ReportSettingsMenu.jsx";
import PeriodPicker from "../components/PeriodPicker.jsx";

const MODES = [
  { id: "padrao", label: "Padrão" },
  { id: "comparativo", label: "Comparativo" },
  { id: "vertical", label: "Análise vertical" },
  { id: "horizontal", label: "Análise horizontal" },
];

// "DRE Ebitda" e "Gráficos EBITDA" ficavam aqui como sub-modos da DRE,
// duplicando o que já existe como widgets próprios no catálogo (tabela
// "EBITDA" e os gráficos "Evolução do EBITDA"/"Margem EBITDA no tempo",
// já disponíveis pra qualquer aba de Gráficos/Demonstrações). Removidos
// daqui pra não ter duas formas de chegar na mesma coisa — o código de
// renderização (mode "executiva"/"graficos") continua existindo, só não
// é mais alcançável por este seletor.
const DRE_ONLY_MODES = [];

const EBITDA_CHARTS = [
  { id: "evolucao", label: "Evolução do EBITDA" },
  { id: "margem", label: "Margem EBITDA" },
  { id: "receita_ebitda", label: "Receita x EBITDA" },
  { id: "lucro", label: "Evolução do Lucro Líquido" },
  { id: "financeiro", label: "Resultado Financeiro" },
];

const LEVELS = [1, 2, 3, 4, 5, 6];

const HIGHLIGHT_CODES = {
  DRE: new Set(["DRE.03", "DRE.05", "DRE.10", "DRE.12", "DRE.15", "DRE.17"]),
  BP: new Set(["01", "02", "03"]),
};

function moneyClass(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) < 0.005) return "text-ink-600";
  return numeric < 0 ? "text-danger-600" : "text-success-600";
}

function columnTone(column) {
  if (column === "debit") return "text-success-600";
  if (column === "credit") return "text-danger-600";
  return "";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

// The more synthetic (aggregated) a line is, the stronger the visual weight —
// tapering down smoothly to a clearly lighter, italic treatment for real
// ledger accounts, so the two kinds never get confused at a glance.
function nameStyle(row, isHighlight) {
  // text-ink-900, não text-navy-900/950 — navy-9xx é a mesma família usada
  // como FUNDO do modo escuro (Login, sidebar); como cor de texto ficava
  // certo no claro (bem escuro sobre branco) mas quase invisível no escuro
  // (escuro sobre um card também escuro). ink-900 é o token que já inverte
  // certo pros dois temas.
  if (isHighlight) return "text-[16px] font-bold text-ink-900";
  if (row.kind !== "synthetic") return "text-[12px] font-normal italic text-ink-400";
  const nivel = Number(row.nivel || 0);
  if (nivel <= 1) return "text-[16px] font-bold text-ink-900";
  if (nivel === 2) return "text-[14px] font-bold text-ink-900";
  if (nivel === 3) return "text-[13.5px] font-semibold text-ink-800";
  if (nivel === 4) return "text-[13px] font-medium text-ink-600";
  return "text-[12.5px] font-normal text-ink-500";
}

function RowLabel({ row, canToggle, isOpen, isHighlight }) {
  const nivel = Number(row.nivel || 0);
  return (
    <div className="relative flex min-w-0 items-center gap-1.5" style={{ paddingLeft: 4 + nivel * 15 }}>
      {nivel > 1 &&
        Array.from({ length: nivel - 1 }).map((_, index) => (
          <span key={index} aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-line" style={{ left: 4 + index * 15 + 6 }} />
        ))}
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center text-ink-400">
        {canToggle && <ChevronRight size={13} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />}
      </span>
      <span className={`truncate ${nameStyle(row, isHighlight)}`}>{row.categoria_gerencial || row.nome_conta}</span>
    </div>
  );
}

function gridTemplate({ mode, columnsCount, showTrend }) {
  if (mode === "comparativo") return "minmax(260px,1fr) 118px 118px 118px 90px";
  if (mode === "vertical" && columnsCount) return `minmax(260px,1fr) ${Array(columnsCount).fill("170px").join(" ")}`;
  if (mode === "vertical") return "minmax(260px,1fr) 118px 170px";
  // Na análise horizontal cada mês mostra o valor e, ao lado, a variação %.
  const cols = Array(columnsCount).fill(mode === "horizontal" ? "170px" : "112px").join(" ");
  return `minmax(260px,1fr) ${cols}${showTrend ? " 90px" : ""}`;
}

// Compact segmented-control switch — replaces loose rows of individually
// bordered pill buttons with a single grouped control, the same pattern
// modern BI toolbars (Linear, Notion, HubCount) use to avoid a "wall of
// buttons" feel.
function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-surface-muted p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            value === option.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function compactMoney(value) {
  const numeric = Number(value || 0);
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(numeric / 1_000).toFixed(0)}k`;
  return numeric.toFixed(0);
}

function monthLabel(month) {
  const [year, mm] = String(month || "").split("-");
  return year && mm ? `${mm}/${year.slice(2)}` : month;
}

// DRE Executiva rows already carry period-correct values on saldo/previous/
// monthValues — but for the Margem EBITDA row those are ratios (%), not
// money, so summing monthly values into a period total (like columnValue's
// periodTotal does) would wrongly add percentages together. This bypasses
// that for the one derived row and defers to the normal logic otherwise.
function executiveColumnValue(row, column, ctx) {
  if (row.isPercentage) {
    if (column === "saldo" || column === "total" || column === "movement" || column === "ending") return row.saldo;
    if (column === "previous") return row.saldo_anterior_balancete;
    return row.monthValues?.[column] || 0;
  }
  return columnValue(row, column, ctx);
}

function renderEbitdaChart(type, data) {
  const grid = <CartesianGrid vertical={false} stroke="var(--color-line)" />;
  const xAxis = <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />;
  const moneyAxis = <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />;
  const tooltipMoney = <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />;

  if (type === "margem") {
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        {xAxis}
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => formatPercent(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line dataKey="margin" name="Margem EBITDA" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (type === "receita_ebitda") {
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        {xAxis}
        {moneyAxis}
        {tooltipMoney}
        <Bar dataKey="revenue" name="Receita líquida" fill="var(--color-navy-700)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="ebitda" name="EBITDA" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    );
  }
  if (type === "lucro") {
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        {xAxis}
        {moneyAxis}
        {tooltipMoney}
        <Bar dataKey="netIncome" name="Lucro líquido" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.netIncome < 0 ? "var(--color-danger-500)" : "var(--color-success-500)"} />
          ))}
        </Bar>
      </ComposedChart>
    );
  }
  if (type === "financeiro") {
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        {xAxis}
        {moneyAxis}
        {tooltipMoney}
        <Bar dataKey="financialRevenue" name="Receitas financeiras" fill="var(--color-success-500)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="financialExpense" name="Despesas financeiras" fill="var(--color-danger-500)" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    );
  }
  return (
    <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
      {grid}
      {xAxis}
      {moneyAxis}
      {tooltipMoney}
      <Bar dataKey="ebitda" name="EBITDA" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
      <Line dataKey="revenue" name="Receita líquida" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2 }} />
    </ComposedChart>
  );
}

// `lockedTabProp` lets a "DRE completo" / "Balanço completo" workspace
// widget embed this whole page directly — full toolbar, full table, no
// navigation involved — instead of just linking out to it. When rendered as
// the /empresa/demonstrativos route it falls back to reading the same lock
// off router state, so a plain navigate(href, {state}) still works too.
export default function Demonstrativos({ lockedTab: lockedTabProp } = {}) {
  const appState = useAppState();
  const location = useLocation();
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;
  // Arriving via a "DRE completo" / "Balanço completo" shortcut card means
  // the user wants exactly that report, not a switcher that could show the
  // other one — so the DRE/BP toggle itself disappears in that case.
  const lockedTab =
    lockedTabProp === "BP" || lockedTabProp === "DRE"
      ? lockedTabProp
      : location.state?.tab === "BP" || location.state?.tab === "DRE"
        ? location.state.tab
        : null;
  const [tab, setTab] = useState(lockedTab || "DRE");
  // When this page is embedded directly inside a sub-tab (Personalizar or
  // the live painel), the same <Demonstrativos> instance is reused as the
  // user switches between sibling sub-tabs (e.g. "Balanço" → "DRE") — React
  // keeps its state across that prop change, so the initial useState above
  // only fires once. Without this, the header/toolbar would relabel itself
  // but the table would keep showing whichever report was locked first.
  useEffect(() => {
    if (lockedTab) setTab(lockedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedTab]);
  const [mode, setMode] = useState("padrao");
  const [compareStart, setCompareStart] = useState("");
  const [compareEnd, setCompareEnd] = useState("");
  // Período A antes era sempre o período global (o do topo da tela) sem
  // opção de trocar. Vazio aqui significa "segue o período global" — só
  // passa a valer um período próprio quando o usuário mexe no PeriodPicker.
  const [compareAStart, setCompareAStart] = useState("");
  const [compareAEnd, setCompareAEnd] = useState("");
  const effectiveAStart = compareAStart || appState.periodStart;
  const effectiveAEnd = compareAEnd || appState.periodEnd;
  const [ledgerRow, setLedgerRow] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [ebitdaChart, setEbitdaChart] = useState("evolucao");

  const visibleModes = tab === "DRE" ? [...MODES, ...DRE_ONLY_MODES] : MODES;
  const showLevelControls = mode === "padrao" || mode === "comparativo" || mode === "vertical" || mode === "horizontal";

  function handleTabChange(next) {
    setTab(next);
    if (next === "BP" && (mode === "executiva" || mode === "graficos")) setMode("padrao");
  }

  const rows = useMemo(() => {
    if (!hasData) return [];
    const built = visibleReportRows(tab);
    if (!appState.hideZeroNoMovement) return built;
    return built.filter((row) => row.natureza === "heading" || !isZeroNoMovement(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasData,
    tab,
    appState.mappings,
    appState.accounts,
    appState.journal,
    appState.periodStart,
    appState.periodEnd,
    appState.expandedLines,
    appState.search,
    appState.hideZeroNoMovement,
    appState.hideNonOperatingResults,
    appState.excludedNonOperatingCodes,
  ]);

  const months = useMemo(() => (hasData ? reportMonths() : []), [hasData, appState.periodStart, appState.periodEnd, appState.journal]);

  const showPreviousBalance = tab === "BP" ? appState.showPreviousBalanceBP : appState.showPreviousBalanceDRE;

  const columns = useMemo(() => {
    if (mode === "horizontal") return months;
    // "Comparar meses" na Análise vertical: um par Valor/% por mês, em vez
    // de um só pra todo o período (era ignorado nesse modo antes — o
    // checkbox existia mas não tinha efeito nenhum aqui).
    if (mode === "vertical") return appState.reportCompare ? months : null;
    if (mode !== "padrao" && mode !== "executiva") return null;
    return reportColumns({
      tab,
      reportCompare: appState.reportCompare,
      showPreviousBalance,
      showReportTotal: tab === "BP" ? appState.showReportTotalBP : appState.showReportTotalDRE,
      bpMonthlyMode: appState.bpMonthlyMode,
    });
    // reportColumns() reads the selected period internally (via reportMonths()),
    // so periodStart/periodEnd must be deps too — otherwise the column
    // headers go stale whenever only the period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    tab,
    appState.reportCompare,
    showPreviousBalance,
    appState.showReportTotalBP,
    appState.showReportTotalDRE,
    appState.bpMonthlyMode,
    appState.periodStart,
    appState.periodEnd,
    months,
  ]);

  const showTrend = mode === "padrao" && !appState.reportCompare;
  const template = gridTemplate({ mode, columnsCount: columns?.length || 0, showTrend });

  const dreTreeForExecutive = useMemo(() => {
    if (tab !== "DRE" || (mode !== "executiva" && mode !== "graficos")) return [];
    return buildReportTree("DRE");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mode, appState.mappings, appState.accounts, appState.journal, appState.periodStart, appState.periodEnd]);

  const executiveRows = useMemo(() => {
    if (mode !== "executiva" && mode !== "graficos") return [];
    const built = buildExecutiveDreRows(dreTreeForExecutive);
    if (!appState.hideZeroNoMovement) return built;
    // Formula/percentage rows (EBITDA, margem, subtotais) stay even at zero —
    // only the plain zeroed-out source lines get hidden, same rule as the
    // regular DRE/BP table.
    return built.filter((row) => row.isFormula || row.isPercentage || !isZeroNoMovement(row));
  }, [mode, dreTreeForExecutive, appState.hideZeroNoMovement]);

  const ebitdaSeries = useMemo(() => {
    if (mode !== "graficos") return [];
    return ebitdaChartData(executiveRows, months, monthLabel);
  }, [mode, executiveRows, months]);

  const compareRows = useMemo(() => {
    if (!hasData || mode !== "comparativo" || !compareStart || !compareEnd) return null;
    return rowsForPeriod(tab, compareStart, compareEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, mode, tab, compareStart, compareEnd, appState.mappings, appState.accounts, appState.journal, appState.expandedLines]);

  const compareMap = useMemo(() => {
    if (!compareRows) return null;
    return new Map(compareRows.map((row) => [rowKey(row), row]));
  }, [compareRows]);

  const compareARows = useMemo(() => {
    if (!hasData || mode !== "comparativo") return null;
    return rowsForPeriod(tab, effectiveAStart, effectiveAEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, mode, tab, effectiveAStart, effectiveAEnd, appState.mappings, appState.accounts, appState.journal, appState.expandedLines]);

  const compareAMap = useMemo(() => {
    if (!compareARows) return null;
    return new Map(compareARows.map((row) => [rowKey(row), row]));
  }, [compareARows]);

  const baseValue = useMemo(() => {
    if (mode !== "vertical") return 0;
    const baseCode = tab === "DRE" ? "DRE.03" : "01";
    const baseRow = rows.find((row) => row.codigo_gerencial === baseCode);
    return baseRow ? Math.abs(rowValue(baseRow, tab)) : 0;
  }, [mode, tab, rows]);

  // Base do "% do ativo/receita" mês a mês, pro modo "Comparar meses" da
  // Análise vertical — mesma ideia do baseValue acima, só que uma base por
  // coluna em vez de uma só pro período inteiro.
  const baseValueByMonth = useMemo(() => {
    if (mode !== "vertical" || !appState.reportCompare || !months.length) return null;
    const baseCode = tab === "DRE" ? "DRE.03" : "01";
    const baseRow = rows.find((row) => row.codigo_gerencial === baseCode);
    if (!baseRow) return null;
    const map = new Map();
    months.forEach((month) => {
      map.set(month, Math.abs(columnValue(baseRow, month, { tab, bpMonthlyMode: appState.bpMonthlyMode, months })));
    });
    return map;
  }, [mode, tab, rows, appState.reportCompare, appState.bpMonthlyMode, months]);

  const missing = useMemo(() => (hasData ? missingMappingAccounts() : []), [hasData, appState.mappings, appState.accounts]);

  function toggle(code) {
    const next = new Set(appState.expandedLines);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setData({ expandedLines: next });
  }

  function expandToLevel(level) {
    const codes = state.plano
      .filter((row) => row.demonstrativo === tab && Number(row.nivel) < level)
      .map((row) => row.codigo_gerencial);
    setData({ expandedLines: new Set(codes) });
  }

  function buildExportColumns() {
    if (mode === "comparativo") {
      return [
        { key: "a", label: "Período A" },
        { key: "b", label: "Período B" },
        { key: "diff", label: "Variação" },
        { key: "diffPct", label: "Var. %" },
      ];
    }
    if (mode === "vertical" && baseValueByMonth) {
      return columns.map((month) => ({ key: month, label: columnLabel(month) }));
    }
    if (mode === "vertical") {
      return [
        { key: "valor", label: "Valor" },
        { key: "pct", label: tab === "DRE" ? "% da receita" : "% do ativo" },
      ];
    }
    return columns.map((column) => ({ key: column, label: columnLabel(column) }));
  }

  // Shared row-builder for PDF and Excel — both now render the exact same
  // pre-formatted display strings (money/percent), matching what's on
  // screen, plus the hierarchy metadata (código/nível/tipo) the styled
  // exporters use to reproduce the accounting team's report layout.
  function buildExportRows(format) {
    const activeRows = mode === "executiva" ? executiveRows : rows;
    return activeRows.map((row) => {
      const base = {
        codigo: row.codigo_gerencial || "",
        nome: row.categoria_gerencial || row.nome_conta || "",
        nivel: Number(row.nivel || 0),
        isAnalytic: row.kind !== "synthetic",
      };
      if (mode === "comparativo") {
        const a = compareAMap ? rowValue(compareAMap.get(rowKey(row)) || {}, tab) : rowValue(row, tab);
        const b = compareMap ? rowValue(compareMap.get(rowKey(row)) || {}, tab) : 0;
        const diff = a - b;
        const diffPct = b ? (diff / Math.abs(b)) * 100 : 0;
        return { ...base, cells: { a: format(a), b: format(b), diff: format(diff), diffPct: format(diffPct, true) } };
      }
      if (mode === "vertical" && baseValueByMonth) {
        const cells = {};
        columns.forEach((month) => {
          const value = columnValue(row, month, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
          const monthBase = baseValueByMonth.get(month);
          const pct = monthBase ? (Math.abs(value) / monthBase) * 100 : 0;
          cells[month] = `${format(value)} (${format(pct, true)})`;
        });
        return { ...base, cells };
      }
      if (mode === "vertical") {
        const value = rowValue(row, tab);
        const pct = baseValue ? (Math.abs(value) / baseValue) * 100 : 0;
        return { ...base, cells: { valor: format(value), pct: format(pct, true) } };
      }
      if (mode === "horizontal") {
        const cells = {};
        columns.forEach((column) => {
          const value = columnValue(row, column, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
          const percent = horizontalPercent(row, column, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
          cells[column] = `${format(value)} (${format(percent, true)})`;
        });
        return { ...base, cells };
      }
      const cells = {};
      columns.forEach((column) => {
        const raw =
          mode === "executiva"
            ? executiveColumnValue(row, column, { tab, months })
            : columnValue(row, column, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
        cells[column] = format(raw, row.isPercentage);
      });
      return { ...base, cells };
    });
  }

  function exportMeta() {
    const company = state.companies.find((item) => item.id === state.activeCompanyId);
    const workspaceName = activeWorkspaceName();
    const reportName = tab === "BP" ? "Balanço Patrimonial" : mode === "executiva" ? "DRE Ebitda" : "DRE";
    const activeRows = mode === "executiva" ? executiveRows : rows;
    const hasAnalytic = activeRows.some((row) => row.kind !== "synthetic");
    const maxLevel = activeRows.reduce((max, row) => Math.max(max, Number(row.nivel || 0)), 0);
    const depthLabel = hasAnalytic ? "Analítico" : maxLevel ? `Sintético até nível ${maxLevel}` : "";
    const periodLabel =
      mode === "comparativo" && compareStart && compareEnd
        ? `${periodLabelPt(effectiveAStart, effectiveAEnd)} vs ${periodLabelPt(compareStart, compareEnd)}`
        : periodLabelPt(appState.periodStart, appState.periodEnd);
    // Balanço não leva CNPJ na linha de meta (mesmo padrão da referência);
    // DRE/EBITDA levam CNPJ + a profundidade de detalhe exibida — um grupo
    // não tem um único CNPJ, então essa parte só aparece com uma empresa.
    const metaLine =
      tab === "BP"
        ? [reportName, periodLabel].filter(Boolean).join(" | ")
        : [company?.cnpj && `CNPJ ${company.cnpj}`, reportName, periodLabel, depthLabel].filter(Boolean).join(" | ");
    const fileLabel = `${reportName}_${workspaceName}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return { companyName: workspaceName, reportName, metaLine, fileLabel };
  }

  function handleExportPdf() {
    exportDemonstrativoPdf({
      ...exportMeta(),
      columns: buildExportColumns(),
      rows: buildExportRows((value, isPercentage) => (isPercentage ? formatPercent(value) : moneyOrDash(value))),
    });
  }

  function handleExportExcel() {
    exportDemonstrativoExcel({
      ...exportMeta(),
      columns: buildExportColumns(),
      rows: buildExportRows((value, isPercentage) => (isPercentage ? formatPercent(value) : moneyOrDash(value))),
    });
  }

  // The top bar's global "Baixar" button always exports whatever's active
  // here — disabled (registers nothing) on the chart-only EBITDA view,
  // which has no tabular form to export.
  useDownloadHandlers(hasData && mode !== "graficos" ? { pdf: handleExportPdf, excel: handleExportExcel, reportKind: { type: "demonstrativo", tab } } : null);

  if (!hasData) {
    return (
      <Placeholder
        icon={FileText}
        title="Nenhum dado importado ainda"
        description="Vá até o menu Dados e importe o balancete e o diário da empresa selecionada para ver o Balanço e a DRE aqui."
      />
    );
  }

  return (
    <div className={expanded ? "fixed inset-0 z-50 overflow-y-auto bg-surface-page p-5" : "flex flex-col gap-4"}>
      <div className={expanded ? "mx-auto flex max-w-[1600px] flex-col gap-4" : "contents"}>
      <div className="rounded-xl bg-surface-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {lockedTab ? (
              <p className="text-[15px] font-medium text-ink-900">{lockedTab === "BP" ? "Balanço patrimonial" : "DRE"}</p>
            ) : (
              <SegmentedControl
                options={[
                  { id: "DRE", label: "DRE" },
                  { id: "BP", label: "Balanço patrimonial" },
                ]}
                value={tab}
                onChange={handleTabChange}
              />
            )}
            <div className="relative hidden sm:block">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={appState.search}
                onChange={(event) => setData({ search: event.target.value })}
                placeholder="Buscar conta"
                className="w-40 rounded-md border border-line-strong py-1.5 pl-7 pr-2 text-[12px] outline-none focus:border-accent-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReportSettingsMenu tab={tab} />
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Sair da tela cheia" : "Tela cheia"}
              title={expanded ? "Sair da tela cheia" : "Tela cheia"}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted"
            >
              {expanded ? <Minimize2 size={14} strokeWidth={1.8} /> : <Maximize2 size={14} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl options={visibleModes} value={mode} onChange={setMode} />
            {showLevelControls && (
              <div className="flex items-center gap-1 border-l border-line pl-3">
                <span className="text-[11px] text-ink-400">Nível</span>
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => expandToLevel(level)}
                    title={level === LEVELS[LEVELS.length - 1] ? "Abrir tudo até a conta real" : `Abrir até o nível ${level}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-muted text-[11px] font-medium text-ink-600 transition-colors hover:bg-accent-50 hover:text-accent-600"
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
          </div>
          {mode === "comparativo" && (
            <div className="flex flex-wrap items-center gap-2">
              <PeriodPicker
                label="Período A"
                start={effectiveAStart}
                end={effectiveAEnd}
                accent="accent"
                onChange={(start, end) => {
                  setCompareAStart(start);
                  setCompareAEnd(end);
                }}
              />
              <span className="text-[11px] text-ink-300">vs</span>
              <PeriodPicker
                label="Período B"
                start={compareStart}
                end={compareEnd}
                accent="navy"
                onChange={(start, end) => {
                  setCompareStart(start);
                  setCompareEnd(end);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {missing.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl bg-warning-500/10 px-4 py-2.5 text-[12px] text-warning-500">
          <TriangleAlert size={15} strokeWidth={1.8} />
          {missing.length} conta{missing.length > 1 ? "s" : ""} do balancete ainda sem de/para — o valor delas não entra nos demonstrativos.
        </div>
      )}

      {mode === "comparativo" && !compareMap && (
        <div className="rounded-xl bg-surface-card px-4 py-8 text-center text-[13px] text-ink-400 shadow-sm">
          Escolha o Período B acima para comparar com o Período A.
        </div>
      )}

      {mode === "comparativo" && compareMap && tab === "BP" && (
        <div className="rounded-xl bg-surface-muted px-4 py-2.5 text-[12px] text-ink-500">
          O balanço reflete sempre o balancete mais recente importado — por isso Ativo e Passivo aparecem iguais nos dois períodos. Só os
          Resultados acumulados mudam, porque são calculados a partir do resultado de cada período.
        </div>
      )}

      {mode === "graficos" && (
        <div className="rounded-xl bg-surface-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-ink-900">Gráficos EBITDA</p>
            <SegmentedControl options={EBITDA_CHARTS} value={ebitdaChart} onChange={setEbitdaChart} />
          </div>
          {ebitdaSeries.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {renderEbitdaChart(ebitdaChart, ebitdaSeries)}
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-[13px] text-ink-400">Sem meses no período selecionado.</p>
          )}
        </div>
      )}

      {mode === "executiva" && (
        <div className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
          <div className={`overflow-auto scrollbar-thin ${expanded ? "max-h-[calc(100vh-260px)]" : "max-h-[600px]"}`}>
            <div className="min-w-max">
              <div
                className="sticky top-0 z-10 grid items-center gap-x-[var(--col-gap,0px)] border-b border-line bg-surface-muted px-3 py-2 text-[11px] font-medium text-ink-400"
                style={{ gridTemplateColumns: template }}
              >
                <span>Conta</span>
                {columns.map((column) => (
                  <span key={column} className="text-right">
                    {columnLabel(column)}
                  </span>
                ))}
              </div>
              {executiveRows.map((row, index) => (
                <div
                  key={row.codigo_gerencial}
                  style={{ gridTemplateColumns: template }}
                  className={`grid items-center gap-x-[var(--col-gap,0px)] px-3 py-2 text-[13px] ${index !== executiveRows.length - 1 ? "border-b border-line" : ""} ${
                    row.isFormula ? "bg-accent-50/50" : index % 2 ? "bg-surface-page/60" : "bg-surface-card"
                  }`}
                >
                  <span className={row.isFormula ? "pl-1 text-[14px] font-bold text-ink-900" : "pl-6 text-[12.5px] text-ink-600"}>
                    {row.categoria_gerencial}
                  </span>
                  {columns.map((column) => {
                    const value = executiveColumnValue(row, column, { tab, months });
                    return (
                      <span
                        key={column}
                        className={`whitespace-nowrap text-right tabular-nums ${row.isFormula ? "font-semibold" : ""} ${
                          row.isPercentage ? "text-navy-700" : moneyClass(value)
                        }`}
                      >
                        {row.isPercentage ? formatPercent(value) : money(value)}
                      </span>
                    );
                  })}
                </div>
              ))}
              {executiveRows.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-ink-400">Nenhuma linha encontrada.</p>}
            </div>
          </div>
        </div>
      )}

      {(mode === "padrao" || mode === "comparativo" || mode === "vertical" || mode === "horizontal") && (mode !== "comparativo" || compareMap) && (
        <div className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
          <div className={`overflow-auto scrollbar-thin ${expanded ? "max-h-[calc(100vh-260px)]" : "max-h-[600px]"}`}>
            <div className="min-w-max">
              <div
                className="sticky top-0 z-10 grid items-center gap-x-[var(--col-gap,0px)] border-b border-line bg-surface-muted px-3 py-2 text-[11px] font-medium text-ink-400"
                style={{ gridTemplateColumns: template }}
              >
                <span>Conta</span>
                {(mode === "padrao" || mode === "horizontal") &&
                  columns.map((column) => (
                    <span key={column} className="text-right">
                      {columnLabel(column)}
                    </span>
                  ))}
                {showTrend && <span className="text-right">Tendência</span>}
                {mode === "comparativo" && (
                  <>
                    <span className="text-right">Período A</span>
                    <span className="text-right">Período B</span>
                    <span className="text-right">Variação</span>
                    <span className="text-right">Var. %</span>
                  </>
                )}
                {mode === "vertical" && !baseValueByMonth && (
                  <>
                    <span className="text-right">Valor</span>
                    <span className="text-right">% {tab === "DRE" ? "da receita" : "do ativo"}</span>
                  </>
                )}
                {mode === "vertical" && baseValueByMonth && columns?.map((month) => (
                  <span key={month} className="text-right">{columnLabel(month)}</span>
                ))}
              </div>

              {rows.map((row, index) => {
                const isSynthetic = row.kind === "synthetic";
                const canToggle = isSynthetic && Number(row.nivel || 0) >= 2;
                const key = `${row.kind}-${rowKey(row)}-${index}`;
                const isHighlight = HIGHLIGHT_CODES[tab]?.has(row.codigo_gerencial);

                const clickHandler = canToggle
                  ? () => toggle(row.codigo_gerencial)
                  : !isSynthetic
                    ? () => setLedgerRow(row)
                    : undefined;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={clickHandler}
                    disabled={!clickHandler}
                    style={{ gridTemplateColumns: template }}
                    className={`grid w-full items-center gap-x-[var(--col-gap,0px)] px-3 py-2 text-left text-[13px] transition-colors enabled:hover:bg-surface-muted disabled:cursor-default ${
                      index !== rows.length - 1 ? "border-b border-line" : ""
                    } ${isHighlight ? "bg-accent-50/50" : index % 2 ? "bg-surface-page/60" : "bg-surface-card"}`}
                  >
                    <RowLabel row={row} canToggle={canToggle} isOpen={appState.expandedLines.has(row.codigo_gerencial)} isHighlight={isHighlight} />

                    {mode === "padrao" && (
                      <>
                        {columns.map((column) => {
                          const value = columnValue(row, column, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
                          const tone = columnTone(column) || moneyClass(value);
                          return (
                            <span key={column} className={`whitespace-nowrap text-right tabular-nums ${tone} ${isHighlight ? "font-semibold" : ""}`}>
                              {money(value)}
                            </span>
                          );
                        })}
                        {showTrend && (
                          <span className="flex justify-end">
                            <Sparkline values={months.map((month) => Number(row.monthValues?.[month] || 0))} />
                          </span>
                        )}
                      </>
                    )}

                    {mode === "horizontal" &&
                      columns.map((column) => {
                        const value = columnValue(row, column, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
                        const pct = horizontalPercent(row, column, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
                        return (
                          <span
                            key={column}
                            className={`flex items-baseline justify-end gap-2 tabular-nums ${isHighlight ? "font-semibold" : ""}`}
                          >
                            <span className={moneyClass(value)}>{money(value)}</span>
                            <span className={`text-[11px] font-normal ${pct == null ? "text-ink-300" : moneyClass(pct)}`}>
                              {pct == null ? "—" : formatPercent(pct)}
                            </span>
                          </span>
                        );
                      })}

                    {mode === "comparativo" &&
                      (() => {
                        const compareARow = compareAMap?.get(rowKey(row));
                        const a = compareARow ? rowValue(compareARow, tab) : rowValue(row, tab);
                        const compareRow = compareMap.get(rowKey(row));
                        const b = compareRow ? rowValue(compareRow, tab) : 0;
                        const diff = a - b;
                        const diffPct = b ? (diff / Math.abs(b)) * 100 : a ? 100 : 0;
                        return (
                          <>
                            <span className="text-right tabular-nums text-ink-600">{money(a)}</span>
                            <span className="text-right tabular-nums text-ink-400">{money(b)}</span>
                            <span className={`text-right tabular-nums font-medium ${moneyClass(diff)}`}>{money(diff)}</span>
                            <span className={`text-right tabular-nums ${moneyClass(diffPct)}`}>{formatPercent(diffPct)}</span>
                          </>
                        );
                      })()}

                    {mode === "vertical" && !baseValueByMonth &&
                      (() => {
                        const value = rowValue(row, tab);
                        const pct = baseValue ? (Math.abs(value) / baseValue) * 100 : 0;
                        return (
                          <>
                            <span className={`text-right tabular-nums font-medium ${moneyClass(value)}`}>{money(value)}</span>
                            <span className="flex items-center justify-end gap-2">
                              <MiniBar percent={pct} />
                              <span className="w-12 text-right text-[11px] font-normal tabular-nums text-ink-500">{formatPercent(pct)}</span>
                            </span>
                          </>
                        );
                      })()}

                    {/* "Comparar meses": um par valor/% por mês — sem a barrinha de
                        progresso (MiniBar), que fica poluída com várias colunas
                        lado a lado; só o percentual mesmo, como no padrão/horizontal. */}
                    {mode === "vertical" && baseValueByMonth &&
                      columns.map((month) => {
                        const value = columnValue(row, month, { tab, bpMonthlyMode: appState.bpMonthlyMode, months });
                        const base = baseValueByMonth.get(month);
                        const pct = base ? (Math.abs(value) / base) * 100 : 0;
                        return (
                          <span key={month} className="flex items-baseline justify-end gap-2 tabular-nums">
                            <span className={moneyClass(value)}>{money(value)}</span>
                            <span className="text-[11px] font-normal text-ink-500">{formatPercent(pct)}</span>
                          </span>
                        );
                      })}
                  </button>
                );
              })}
              {rows.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-ink-400">Nenhuma linha encontrada.</p>}
            </div>
          </div>
        </div>
      )}
      </div>

      {ledgerRow && <LedgerModal row={ledgerRow} onClose={() => setLedgerRow(null)} />}
    </div>
  );
}
