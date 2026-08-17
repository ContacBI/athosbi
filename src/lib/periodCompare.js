import { state } from "../data/useStore.js";
import { visibleReportRows } from "../data/calculations.js";

// Temporarily swaps the global period, runs the (otherwise-global-state-driven)
// report builder for it, then restores the original period. Synchronous and
// side-effect free from the outside — never goes through setData/notify, so it
// never triggers a render while another render is in flight.
export function rowsForPeriod(type, periodStart, periodEnd) {
  const original = { periodStart: state.periodStart, periodEnd: state.periodEnd };
  state.periodStart = periodStart;
  state.periodEnd = periodEnd;
  const rows = visibleReportRows(type);
  state.periodStart = original.periodStart;
  state.periodEnd = original.periodEnd;
  return rows;
}

// DRE rows carry saldo/saldo_final as a year-to-date figure (the calc engine
// accumulates everything since Jan 1 up to periodEnd, because that's what the
// BP's "Resultado do exercicio" rollup needs). movimento_periodo, by contrast,
// is always just the selected window in isolation — the one we want for a
// "value of this period" column or a period-vs-period comparison.
// BP rows have no such double meaning: saldo_final is simply the closing
// balance, which is exactly what a balance sheet should show.
export function rowValue(row, tab) {
  if (tab === "DRE") return Number(row.movimento_periodo || 0);
  const value = row.saldo_final ?? row.saldo;
  return Number(value || 0);
}

export function rowKey(row) {
  return row.codigo_gerencial || row.classificacao;
}
