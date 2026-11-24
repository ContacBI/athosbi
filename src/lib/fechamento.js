// Fechamento: até que mês o CLIENTE enxerga os números de uma empresa. O
// escritório marca o mês fechado (company.fechadoAte, "AAAA-MM") na barra
// do topo da empresa; enquanto não marcar, vale o mês anterior ao atual —
// o mês corrente, ainda sendo lançado, nunca aparece pro cliente. A equipe
// (admin/colaborador) vê tudo, sempre.
//
// Num grupo vale o mais atrasado das empresas: o consolidado só mostra um
// mês quando todas fecharam.

const isMes = (mes) => /^\d{4}-\d{2}$/.test(String(mes || ""));

export function mesAnterior(hoje = new Date()) {
  const data = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function proximoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const data = new Date(ano, m, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// O mês `n` meses antes de `mes` (AAAA-MM).
export function mesesAntes(mes, n) {
  const [ano, m] = mes.split("-").map(Number);
  const data = new Date(ano, m - 1 - n, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

// Quantos meses a tela traz quando ninguém escolheu o período (o ano todo não cabe nas colunas).
export const MESES_DO_PERIODO_PADRAO = 5;

/** O período de partida de quem tem limite: os últimos meses, até o mês fechado. */
export function periodoPadrao(limite) {
  return { start: `${mesesAntes(limite, MESES_DO_PERIODO_PADRAO - 1)}-01`, end: ultimoDiaDoMes(limite) };
}

export function ultimoDiaDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, "0")}`;
}

export function mesFechadoDa(company, hoje = new Date()) {
  return isMes(company?.fechadoAte) ? company.fechadoAte : mesAnterior(hoje);
}

export function mesFechadoDoWorkspace(state, hoje = new Date()) {
  if (state.activeGroupId) {
    const group = (state.groups || []).find((item) => item.id === state.activeGroupId);
    const membros = (state.companies || []).filter((company) => (group?.companyIds || []).includes(company.id));
    if (!membros.length) return mesAnterior(hoje);
    return membros.map((company) => mesFechadoDa(company, hoje)).sort()[0];
  }
  const company = (state.companies || []).find((item) => item.id === state.activeCompanyId);
  return mesFechadoDa(company, hoje);
}

// O limite do que está logado: null pra equipe (sem limite).
export function limiteDoCliente(state, hoje = new Date()) {
  if (state.isAdmin || state.isColaborador) return null;
  return mesFechadoDoWorkspace(state, hoje);
}

// Período cortado no limite: o fim nunca passa do último dia do mês
// fechado; se o começo também passou, vira o próprio mês fechado.
export function limitarPeriodo({ start, end }, limite) {
  if (!limite) return { start, end };
  const fim = ultimoDiaDoMes(limite);
  // período sem fim ("todos os meses") também para no mês fechado
  if (!end) return { start, end: fim };
  if (end <= fim) return { start, end };
  return { start: start && start <= fim ? start : `${limite}-01`, end: fim };
}
