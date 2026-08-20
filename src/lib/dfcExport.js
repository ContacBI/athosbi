import { state } from "../data/useStore.js";
import { buildDfcDirect, buildDfcIndirect, reportMonths } from "../data/calculations.js";
import { columnLabel, isZeroNoMovement } from "./reportColumns.js";
import { moneyOrDash, periodLabelPt } from "./format.js";
import { activeWorkspaceName } from "./groups.js";
import { slug } from "./demonstrativoExport.js";

// O relatório "completo" de DFC (padrão, sempre com o detalhe analítico
// aberto) construído direto do estado global — mesma ideia de
// buildFullReportExport (demonstrativoExport.js) pro BP/DRE: funciona de
// qualquer lugar, não só com Dfc.jsx montada, e relê o estado a cada
// chamada, o que é o que permite usar isso com o truque de "trocar
// silenciosamente a empresa ativa" do export Consolidado+Individual (ver
// lib/groupExport.js) — cada chamada enxerga os dados certos na hora.
export function buildFullDfcExport(mode = "direct") {
  const workspaceName = activeWorkspaceName();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const builtRows = mode === "direct" ? buildDfcDirect() : buildDfcIndirect();
  const rows = state.hideZeroNoMovement ? builtRows.filter((row) => row.natureza === "heading" || !isZeroNoMovement(row)) : builtRows;
  const columns = state.reportCompare ? reportMonths() : ["saldo"];
  const reportName = `DFC ${mode === "direct" ? "Direta" : "Indireta"}`;
  const periodLabel = periodLabelPt(state.periodStart, state.periodEnd);
  const metaLine = [company?.cnpj && `CNPJ ${company.cnpj}`, reportName, periodLabel].filter(Boolean).join(" | ");

  const cellsFor = (source) => {
    const cells = {};
    columns.forEach((column) => {
      cells[column] = moneyOrDash(column === "saldo" ? source.saldo : source.monthValues?.[column] || 0);
    });
    return cells;
  };
  const codeLabel = (classificacao) => (Array.isArray(classificacao) ? classificacao.join(", ") : classificacao || "");

  const exportRows = [];
  rows.forEach((row) => {
    exportRows.push({
      codigo: row.codigo_gerencial || "",
      nome: row.categoria_gerencial || "",
      nivel: Number(row.nivel || 0),
      isAnalytic: false,
      cells: row.natureza === "heading" ? {} : cellsFor(row),
    });
    (row.contas || []).forEach((child) => {
      exportRows.push({
        codigo: codeLabel(child.classificacao),
        nome: child.nome_conta || "",
        nivel: Number(row.nivel || 0) + 1,
        isAnalytic: true,
        cells: cellsFor(child),
      });
    });
  });

  return {
    companyName: workspaceName,
    reportName,
    metaLine,
    fileLabel: slug(`${reportName}_${workspaceName}`),
    columns: columns.map((column) => ({ key: column, label: columnLabel(column) })),
    rows: exportRows,
  };
}
