// A ponte do assistente com os dados do app: o contexto do B.I. num período
// qualquer (sem mexer no período da tela), o catálogo de linhas e contas
// que o leitor de pedidos reconhece pelo nome e o período de comparação.

import { state } from "../../data/useStore.js";
import { sharedDashboardContext } from "../dashboardData.js";

// Calcula como se a tela estivesse no período pedido e volta ao que era —
// sem setData, então nenhuma tela redesenha no meio. Os caches de cálculo
// já levam o período na chave.
export function contextForPeriod(start, end) {
  const saved = { periodStart: state.periodStart, periodEnd: state.periodEnd };
  try {
    state.periodStart = start;
    state.periodEnd = end;
    return sharedDashboardContext();
  } finally {
    state.periodStart = saved.periodStart;
    state.periodEnd = saved.periodEnd;
  }
}

// Meses com lançamento no razão (e os do balancete), pra "último mês",
// "ano todo", "últimos 3 meses"…
export function dataMonths() {
  const months = new Set();
  (state.journal || []).forEach((entry) => {
    const month = String(entry.data || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) months.add(month);
  });
  const metas = state.activeGroupId
    ? (state.companies || []).filter((company) => (state.groups || []).find((group) => group.id === state.activeGroupId)?.companyIds?.includes(company.id)).map((company) => company.lastBalanceteMeta)
    : [(state.companies || []).find((company) => company.id === state.activeCompanyId)?.lastBalanceteMeta];
  metas.filter(Boolean).forEach((meta) => {
    const start = String(meta.inicio || "").slice(0, 7);
    const end = String(meta.fim || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return;
    let [year, month] = start.split("-").map(Number);
    for (let guard = 0; guard < 240; guard += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      months.add(key);
      if (key >= end) break;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  });
  return [...months].sort();
}

// O que dá pra citar pelo nome no pedido: as linhas do plano gerencial com
// valor e as contas do balancete embaixo delas ("banco itaú").
export function buildCatalog(ctx) {
  const lines = [];
  const accounts = [];
  const seenAccounts = new Set();
  [
    ["DRE", ctx?.dre],
    ["BP", ctx?.bp],
  ].forEach(([source, rows]) => {
    (rows || []).forEach((row) => {
      if (row.kind !== "synthetic" || !row.hasValue || Number(row.nivel || 0) < 2) return;
      lines.push({ source, code: row.codigo_gerencial, name: row.categoria_gerencial, nivel: Number(row.nivel || 0) });
      if (row.hasSyntheticChildren) return;
      (row.contas || []).forEach((conta) => {
        const key = `${source}|${conta.classificacao}`;
        if (!conta.nome_conta || seenAccounts.has(key)) return;
        seenAccounts.add(key);
        accounts.push({ source, code: row.codigo_gerencial, name: conta.nome_conta, classificacao: conta.classificacao });
      });
    });
  });
  return { months: dataMonths(), lines, accounts };
}

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function lastDay(year, month) {
  return new Date(year, month, 0).getDate();
}

function ymd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// "abr-mai/26", "2025", "out/25-mar/26", "abr/26".
export function shortPeriod(start, end) {
  if (!start || !end) return "";
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const whole = ds === 1 && de === lastDay(ye, me);
  if (!whole) return `${start.split("-").reverse().join("/")} a ${end.split("-").reverse().join("/")}`;
  if (ys === ye && ms === 1 && me === 12) return String(ys);
  if (ys === ye && ms === me) return `${SHORT[ms - 1]}/${String(ys).slice(2)}`;
  if (ys === ye) return `${SHORT[ms - 1]}-${SHORT[me - 1]}/${String(ys).slice(2)}`;
  return `${SHORT[ms - 1]}/${String(ys).slice(2)}-${SHORT[me - 1]}/${String(ye).slice(2)}`;
}

// Período de comparação: o mesmo do ano anterior ("yoy") ou o de mesmo
// tamanho logo antes ("anterior").
export function comparisonPeriod(period, mode) {
  if (!period?.start || !period?.end || !mode) return null;
  const [ys, ms] = period.start.split("-").map(Number);
  const [ye, me] = period.end.split("-").map(Number);
  if (mode === "yoy") {
    const start = ymd(ys - 1, ms, 1);
    const end = ymd(ye - 1, me, lastDay(ye - 1, me));
    return { start, end, label: shortPeriod(start, end) };
  }
  const length = (ye - ys) * 12 + (me - ms) + 1;
  let sy = ys;
  let sm = ms - length;
  while (sm < 1) {
    sm += 12;
    sy -= 1;
  }
  let ey = ys;
  let em = ms - 1;
  if (em < 1) {
    em = 12;
    ey -= 1;
  }
  const start = ymd(sy, sm, 1);
  const end = ymd(ey, em, lastDay(ey, em));
  return { start, end, label: shortPeriod(start, end) };
}
