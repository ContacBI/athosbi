import { WIDGET_CATALOG, formatWidgetValue } from "./dashboardWidgets.js";
import { moneyOrDash } from "./format.js";

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

  widgets.forEach((entry) => {
    const definition = catalogById.get(entry.id);
    if (!definition || !ctx) return;

    if (definition.type === "kpi") {
      const { value, format } = definition.value(ctx);
      rows.push({ nome: definition.label, nivel: 1, isAnalytic: false, cells: { valor: formatWidgetValue(value, format) } });
      return;
    }

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
