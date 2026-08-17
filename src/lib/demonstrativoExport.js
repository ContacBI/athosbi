import { state } from "../data/useStore.js";
import { visibleReportRows, reportMonths } from "../data/calculations.js";
import { reportColumns, columnLabel, columnValue, isZeroNoMovement } from "./reportColumns.js";
import { moneyOrDash, periodLabelPt } from "./format.js";
import { activeWorkspaceName } from "./groups.js";

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function slug(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// The same "Padrão" report Demonstrativos shows by default (full depth,
// current global period/filters), built straight off the shared store — so
// it works from anywhere, not just while the Demonstrativos page itself is
// mounted. Used by the top bar's "Gerar relatórios" menu, which needs to
// offer "DRE completo"/"Balanço completo" no matter which tab is active.
export function buildFullReportExport(tab) {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const workspaceName = activeWorkspaceName();
  const built = visibleReportRows(tab);
  const rows = state.hideZeroNoMovement ? built.filter((row) => row.natureza === "heading" || !isZeroNoMovement(row)) : built;
  const months = reportMonths();
  const showPreviousBalance = tab === "BP" ? state.showPreviousBalanceBP : state.showPreviousBalanceDRE;
  const columns = reportColumns({
    tab,
    reportCompare: state.reportCompare,
    showPreviousBalance,
    showReportTotal: state.showReportTotal,
    bpMonthlyMode: state.bpMonthlyMode,
  });

  const exportRows = rows.map((row) => ({
    codigo: row.codigo_gerencial || "",
    nome: row.categoria_gerencial || row.nome_conta || "",
    nivel: Number(row.nivel || 0),
    isAnalytic: row.kind !== "synthetic",
    cells: Object.fromEntries(
      columns.map((column) => {
        const raw = columnValue(row, column, { tab, bpMonthlyMode: state.bpMonthlyMode, months });
        return [column, row.isPercentage ? formatPercent(raw) : moneyOrDash(raw)];
      })
    ),
  }));

  const reportName = tab === "BP" ? "Balanço Patrimonial" : "DRE";
  const hasAnalytic = rows.some((row) => row.kind !== "synthetic");
  const maxLevel = rows.reduce((max, row) => Math.max(max, Number(row.nivel || 0)), 0);
  const depthLabel = hasAnalytic ? "Analítico" : maxLevel ? `Sintético até nível ${maxLevel}` : "";
  const periodLabel = periodLabelPt(state.periodStart, state.periodEnd);
  const metaLine =
    tab === "BP"
      ? [reportName, periodLabel].filter(Boolean).join(" | ")
      : [company?.cnpj && `CNPJ ${company.cnpj}`, reportName, periodLabel, depthLabel].filter(Boolean).join(" | ");

  return {
    companyName: workspaceName,
    reportName,
    metaLine,
    fileLabel: slug(`${reportName}_${workspaceName}`),
    columns: columns.map((column) => ({ key: column, label: columnLabel(column) })),
    rows: exportRows,
  };
}
