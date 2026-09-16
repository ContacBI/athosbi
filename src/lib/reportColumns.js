import { reportMonths } from "../data/calculations.js";

// Faithful port of the legacy portal's column logic (src/views/reports.js),
// which itself sits on top of the untouched calculations.js engine.

// Agrupa os meses realmente presentes (já filtrados pelo período selecionado)
// em blocos de bimestre/trimestre alinhados ao calendário (jan-fev, mar-abr,
// ... / jan-mar, abr-jun, ...) — nunca um bloco "1º bimestre" que mistura
// dez/24 com jan/25, por exemplo: o ano faz parte da chave do bloco. Meses
// sem nenhum lançamento não geram bloco vazio (só teria uma coluna zerada
// à toa) — só entra bloco pra período que a empresa realmente tem dado.
export function groupMonths(months, granularity) {
  if (granularity !== "bimester" && granularity !== "quarter") {
    return (months || []).map((month) => ({ key: month, months: [month] }));
  }
  const size = granularity === "quarter" ? 3 : 2;
  const prefix = granularity === "quarter" ? "Q" : "B";
  const groups = new Map();
  (months || []).forEach((month) => {
    const [year, mm] = month.split("-");
    const index = Math.floor((Number(mm) - 1) / size);
    const key = `${year}-${prefix}${index + 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(month);
  });
  return Array.from(groups.entries()).map(([key, groupedMonths]) => ({ key, months: groupedMonths }));
}

export function reportColumns({ tab, reportCompare, showPreviousBalance, showReportTotal, bpMonthlyMode, granularity }) {
  if (!reportCompare) {
    const compact = tab === "BP" ? ["initial", "debit", "credit", "ending"] : ["saldo"];
    return showPreviousBalance ? compact : compact.filter((column) => column !== "initial");
  }
  const groups = groupMonths(reportMonths(), granularity);
  let columns = ["previous", ...groups.map((group) => group.key), "total"];
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
  const grouped = String(column).match(/^(\d{4})-([QB])(\d)$/);
  if (grouped) {
    const [, year, kind, index] = grouped;
    return `${index}${kind === "Q" ? "T" : "B"}/${year.slice(2)}`;
  }
  const [year, month] = String(column).split("-");
  return year && month ? `${month}/${year.slice(2)}` : column;
}

function periodTotal(row) {
  const values = Object.values(row.monthValues || {});
  if (values.length) return values.reduce((sum, value) => sum + Number(value || 0), 0);
  return row.kind === "analytic" ? row.valor_gerencial : row.saldo;
}

// Exportado pra dashboardData.js reusar nas séries mensais de BP dos
// gráficos (Ativo x Passivo x PL no tempo, NCG) — mesmo saldo acumulado
// (saldo anterior + movimento até o mês) que a tela de Demonstrativos já
// usa no modo "Saldo acumulado", só chamado fora do componente da tela.
export function accumulatedBalanceValue(row, targetMonth, months) {
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

export function columnValue(row, column, { tab, bpMonthlyMode, months, granularity }) {
  if (column === "saldo") return periodTotal(row);
  if (column === "initial") return row.saldo_inicial || 0;
  if (column === "previous") return row.saldo_anterior_balancete || 0;
  if (column === "movement") return row.movimento_periodo || periodTotal(row);
  if (column === "debit") return row.periodDebito || 0;
  if (column === "credit") return row.periodCredito || 0;
  // "ending" só aparece junto de initial/debit/credit nesse modo compacto do
  // BP (ver reportColumns acima) — precisa fechar a conta do período
  // selecionado, não mostrar row.saldo_final, que é o saldo_atual FIXO do
  // balancete importado (a "foto" mais recente, não necessariamente do fim
  // do período filtrado na tela). Com um balancete importado até 06 e o
  // período filtrado até 01, saldo_final sempre mostrava o saldo de 06
  // junto de Entradas/Saídas só de 01 — a conta nunca fechava.
  //
  // SI + row.movimento_periodo, NÃO "SI + Entradas − Saídas" direto:
  // Entradas/Saídas (periodDebito/periodCredito) são somas CRUAS de
  // débito/crédito, sem ajuste de sinal — corretas pro Ativo (débito
  // aumenta), mas invertidas pro Passivo/PL (crédito aumenta, débito
  // diminui). row.movimento_periodo já vem com o sinal certo por conta
  // (reportEntryValue/isPassiveOrEquityPlan, a mesma função que já inverte
  // o saldo pro Passivo aparecer positivo em vez de negativo) — usar ele
  // fecha os dois lados do balanço com a fórmula certa de cada um, sem
  // precisar decidir aqui qual é qual.
  if (column === "ending" && tab === "BP") return Number(row.saldo_inicial || 0) + Number(row.movimento_periodo || 0);
  if (column === "ending") return row.saldo_final || row.saldo || 0;
  if (column === "total" && tab === "DRE") return Number(row.saldo_anterior_balancete || 0) + periodTotal(row);
  if (column === "total") return row.saldo_final || row.saldo || 0;
  if (tab === "BP" && bpMonthlyMode === "accumulated" && /^\d{4}-\d{2}$/.test(column)) {
    return accumulatedBalanceValue(row, column, months);
  }
  // Coluna de bimestre/trimestre ("2025-Q1", "2025-B3", ...) — ver
  // groupMonths acima. Balanço acumulado usa o saldo de FECHAMENTO do
  // último mês real do bloco (uma balança não se soma entre meses); DRE e
  // Balanço em modo "movimento" somam o movimento dos meses reais do
  // bloco, igual ao "Saldo total" já faz pra todo o período.
  const grouped = /^\d{4}-[QB]\d$/.test(column);
  if (grouped) {
    const group = groupMonths(months, granularity).find((item) => item.key === column);
    const groupedMonths = group?.months || [];
    if (!groupedMonths.length) return 0;
    if (tab === "BP" && bpMonthlyMode === "accumulated") {
      return accumulatedBalanceValue(row, groupedMonths[groupedMonths.length - 1], months);
    }
    return groupedMonths.reduce((sum, month) => sum + Number(row.monthValues?.[month] || 0), 0);
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
