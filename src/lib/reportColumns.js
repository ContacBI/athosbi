import { reportMonths } from "../data/calculations.js";

// Faithful port of the legacy portal's column logic (src/views/reports.js),
// which itself sits on top of the untouched calculations.js engine.

export function reportColumns({ tab, reportCompare, showPreviousBalance, showReportTotal, bpMonthlyMode }) {
  if (!reportCompare) {
    const compact = tab === "BP" ? ["initial", "debit", "credit", "ending"] : ["saldo"];
    return showPreviousBalance ? compact : compact.filter((column) => column !== "initial");
  }
  let columns = ["previous", ...reportMonths(), "total"];
  if (!showPreviousBalance) columns = columns.filter((column) => column !== "previous");
  // A balanço em modo acumulado já termina no saldo final do último mês —
  // uma coluna "total" ali seria redundante (ou enganosa, somando saldos).
  const suppressTotal = tab === "BP" && bpMonthlyMode === "accumulated";
  if (!showReportTotal || suppressTotal) columns = columns.filter((column) => column !== "total");
  return columns;
}

export function columnLabel(column) {
  if (column === "saldo") return "Saldo do período";
  if (column === "initial") return "Saldo inicial";
  if (column === "previous") return "Saldo anterior";
  if (column === "movement") return "Movimento";
  if (column === "debit") return "Entradas";
  if (column === "credit") return "Saídas";
  if (column === "ending") return "Saldo final";
  if (column === "total") return "Saldo total";
  const [year, month] = String(column).split("-");
  return year && month ? `${month}/${year.slice(2)}` : column;
}

function periodTotal(row) {
  const values = Object.values(row.monthValues || {});
  if (values.length) return values.reduce((sum, value) => sum + Number(value || 0), 0);
  return row.kind === "analytic" ? row.valor_gerencial : row.saldo;
}

function accumulatedBalanceValue(row, targetMonth, months) {
  let value = Number(row.saldo_anterior_balancete || 0);
  for (const month of months) {
    value += Number(row.monthValues?.[month] || 0);
    if (month === targetMonth) break;
  }
  return value;
}

// Análise horizontal: para cada período do intervalo, a variação % da linha
// em relação ao primeiro período (a base fica em 0%). Balanço parte do saldo
// acumulado (usa o saldo anterior como base "antes do período" quando
// disponível); DRE compara o valor de cada mês de movimento contra o do
// primeiro mês.
export function horizontalPercent(row, month, { tab, bpMonthlyMode, months }) {
  if (!months || !months.length) return null;
  const firstMonth = months[0];
  const valueFor = (target) =>
    tab === "BP" && bpMonthlyMode === "accumulated"
      ? accumulatedBalanceValue(row, target, months)
      : Number(row.monthValues?.[target] || 0);
  const base =
    tab === "BP" && bpMonthlyMode === "accumulated" && row.saldo_anterior_balancete
      ? Number(row.saldo_anterior_balancete)
      : valueFor(firstMonth);
  if (nearZero(base)) return null;
  return ((valueFor(month) - base) / Math.abs(base)) * 100;
}

export function columnValue(row, column, { tab, bpMonthlyMode, months }) {
  if (column === "saldo") return periodTotal(row);
  if (column === "initial") return row.saldo_inicial || 0;
  if (column === "previous") return row.saldo_anterior_balancete || 0;
  if (column === "movement") return row.movimento_periodo || periodTotal(row);
  if (column === "debit") return row.periodDebito || 0;
  if (column === "credit") return row.periodCredito || 0;
  // "ending" só aparece junto de initial/debit/credit nesse modo compacto do
  // BP (ver reportColumns acima) — precisa fechar a conta do período
  // selecionado (SI + Entradas − Saídas), não mostrar row.saldo_final, que
  // é o saldo_atual FIXO do balancete importado (a "foto" mais recente,
  // não necessariamente do fim do período filtrado na tela). Com um
  // balancete importado até 06 e o período filtrado até 01, saldo_final
  // sempre mostrava o saldo de 06 junto de Entradas/Saídas só de 01 — a
  // conta nunca fechava.
  if (column === "ending" && tab === "BP") return Number(row.saldo_inicial || 0) + Number(row.periodDebito || 0) - Number(row.periodCredito || 0);
  if (column === "ending") return row.saldo_final || row.saldo || 0;
  if (column === "total" && tab === "DRE") return Number(row.saldo_anterior_balancete || 0) + periodTotal(row);
  if (column === "total") return row.saldo_final || row.saldo || 0;
  if (tab === "BP" && bpMonthlyMode === "accumulated" && /^\d{4}-\d{2}$/.test(column)) {
    return accumulatedBalanceValue(row, column, months);
  }
  return row.monthValues?.[column] || 0;
}

function nearZero(value) {
  return Math.abs(Number(value || 0)) < 0.005;
}

export function isZeroNoMovement(row) {
  const movement = Number(row.movimento_periodo || 0) || periodTotal(row);
  const balance = Number(row.saldo_final || row.saldo || row.valor_gerencial || 0);
  const previous = Number(row.saldo_anterior_balancete || 0);
  const hasMonthlyMovement = Object.values(row.monthValues || {}).some((value) => !nearZero(value));
  return !hasMonthlyMovement && nearZero(movement) && nearZero(balance) && nearZero(previous);
}
