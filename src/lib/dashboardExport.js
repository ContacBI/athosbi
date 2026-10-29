import { state } from "../data/useStore.js";
import { buildReportTree, buildDfcDirect, buildDfcIndirect, reportMonths } from "../data/calculations.js";
import { WIDGET_CATALOG, formatWidgetValue } from "./dashboardWidgets.js";
import { withPeriodDreValues } from "./dashboardData.js";
import { buildExecutiveDreRows, DRE_RESUMIDA_MAP } from "./executiveDre.js";
import { columnLabel, colunasDoCartao, valorDoCartao, isZeroNoMovement } from "./reportColumns.js";
import { slug } from "./demonstrativoExport.js";
import { activeWorkspaceName } from "./groups.js";
import { moneyOrDash, periodLabelPt } from "./format.js";

function percent(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
}

function tableRowsFor(definition, ctx) {
  if (definition.table === "executiva") return ctx.executive;
  if (definition.table === "dre_resumida") return ctx.dreResumida;
  const source = definition.table === "bp" ? ctx.bp : ctx.dre;
  return source.filter((row) => row.kind === "synthetic" && row.hasValue && Number(row.nivel || 0) >= 1 && Number(row.nivel || 0) <= 2);
}

function previewRowsFor(definition, ctx) {
  if (definition.preview === "dre_resumida") return ctx.dreResumida;
  if (definition.preview === "bp_resumo") {
    return ctx.bp.filter((row) => row.kind === "synthetic" && row.hasValue && Number(row.nivel || 0) >= 1 && Number(row.nivel || 0) <= 2);
  }
  return null;
}

// Everything a tab currently shows, flattened into the same {nome, nivel,
// isAnalytic, cells} shape reportPdf/reportExcel already know how to draw —
// one heading row per widget, its own rows nested under it. Charts have no
// sensible tabular form, so they're skipped; everything else (KPIs, tables,
// lists, the DRE/BP shortcut previews) turns into real exportable rows.
export function buildSummaryExportRows(widgets, ctx) {
  const catalogById = new Map(WIDGET_CATALOG.map((definition) => [definition.id, definition]));
  const rows = [];
  let emKpis = false;

  widgets.forEach((entry) => {
    const definition = catalogById.get(entry.id);
    if (!definition || !ctx) return;

    // Os cartões de número (KPI) seguidos ficam juntos sob um título, como
    // as linhas de uma tabela — e não cada um como um título destacado.
    if (definition.type === "kpi") {
      if (!emKpis) rows.push({ nome: "Números do período", nivel: 1, isAnalytic: false, cells: { valor: "" } });
      emKpis = true;
      const { value, format } = definition.value(ctx);
      rows.push({ nome: definition.label, nivel: 2, isAnalytic: false, cells: { valor: formatWidgetValue(value, format) } });
      return;
    }
    if (definition.type !== "chart") emKpis = false;

    if (definition.type === "table") {
      rows.push({ nome: definition.label, nivel: 1, isAnalytic: false, cells: { valor: "" } });
      tableRowsFor(definition, ctx).forEach((row) => {
        rows.push({
          nome: row.categoria_gerencial,
          nivel: 2,
          isAnalytic: !(row.isFormula || Number(row.nivel || 0) <= 1),
          cells: { valor: row.isPercentage ? percent(row.saldo) : moneyOrDash(row.saldo) },
        });
      });
      return;
    }

    if (definition.type === "link") {
      const preview = previewRowsFor(definition, ctx);
      if (!preview) return;
      rows.push({ nome: definition.label, nivel: 1, isAnalytic: false, cells: { valor: "" } });
      preview.forEach((row) => {
        rows.push({
          nome: row.categoria_gerencial,
          nivel: 2,
          isAnalytic: !(row.isFormula || Number(row.nivel || 0) <= 1),
          cells: { valor: moneyOrDash(row.saldo) },
        });
      });
      return;
    }

    if (definition.type === "list") {
      rows.push({ nome: definition.label, nivel: 1, isAnalytic: false, cells: { valor: "" } });
      if (definition.list === "destaques_dre") {
        ctx.destaques.forEach((row) =>
          rows.push({ nome: row.categoria_gerencial, nivel: 2, isAnalytic: true, cells: { valor: moneyOrDash(row.saldo) } })
        );
      } else if (definition.list === "checklist") {
        ctx.checklist.forEach((item) =>
          rows.push({ nome: item.label, nivel: 2, isAnalytic: true, cells: { valor: item.done ? "OK" : "Pendente" } })
        );
      } else if (definition.list === "sem_depara") {
        ctx.missing.forEach((account) =>
          rows.push({ nome: account.nome_conta || account.classificacao, nivel: 2, isAnalytic: true, cells: { valor: account.classificacao } })
        );
      }
    }
    // charts: no simple tabular form — skipped on purpose.
  });

  return rows;
}

const ehSintetico = (row) => row.kind === "synthetic" && row.hasValue && Number(row.nivel || 0) >= 1 && Number(row.nivel || 0) <= 2;

export function abaDaTabela(table) {
  return table === "bp" ? "BP" : table?.startsWith("dfc_") ? "DFC" : "DRE";
}

// Uma aba do Painel que é só um cartão de demonstração (ex.: "EBITDA") como
// relatório de verdade — as mesmas linhas e colunas do cartão —, montado
// direto do estado global. Assim o "Consolidado + Individual" do grupo
// (CompanyTopBar) consegue refazer o mesmo relatório pra cada empresa.
export function buildTableWidgetExport(table) {
  const definition = WIDGET_CATALOG.find((item) => item.type === "table" && item.table === table);
  if (!definition) return null;
  const tab = abaDaTabela(table);
  let built;
  if (table === "dfc_direta") built = buildDfcDirect();
  else if (table === "dfc_indireta") built = buildDfcIndirect();
  else if (table === "bp") built = buildReportTree("BP").filter(ehSintetico);
  else {
    const dre = withPeriodDreValues(buildReportTree("DRE"));
    if (table === "executiva") built = buildExecutiveDreRows(dre);
    else if (table === "dre_resumida") built = buildExecutiveDreRows(dre, DRE_RESUMIDA_MAP);
    else built = dre.filter(ehSintetico);
  }
  const linhas = state.hideZeroNoMovement ? built.filter((row) => row.natureza === "heading" || !isZeroNoMovement(row)) : built;
  const columns = colunasDoCartao(tab, state.reportCompare, state);
  const months = reportMonths();
  const celulas = (row) =>
    Object.fromEntries(
      columns.map((column) => {
        const valor = valorDoCartao(row, column, { tab, bpMonthlyMode: state.bpMonthlyMode, months });
        return [column, row.isPercentage ? percent(valor) : moneyOrDash(valor)];
      })
    );
  const rows = [];
  linhas.forEach((row) => {
    const nivel = Number(row.nivel || 0);
    rows.push({ codigo: row.codigo_gerencial || "", nome: row.categoria_gerencial || "", nivel, isAnalytic: !(row.isFormula || nivel <= 1), cells: celulas(row) });
    // DFC: as contas de cada linha, que o cartão abre com um clique.
    (row.contas || []).forEach((conta) => {
      rows.push({ codigo: "", nome: conta.nome_conta || "", nivel: nivel + 1, isAnalytic: true, cells: celulas(conta) });
    });
  });

  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const workspaceName = activeWorkspaceName();
  return {
    companyName: workspaceName,
    reportName: definition.label,
    metaLine: [company?.cnpj && `CNPJ ${company.cnpj}`, definition.label, periodLabelPt(state.periodStart, state.periodEnd)].filter(Boolean).join(" | "),
    fileLabel: slug(`${definition.label}_${workspaceName}`),
    columns: columns.map((column) => ({ key: column, label: columnLabel(column) })),
    rows,
  };
}
