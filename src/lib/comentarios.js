import { state, setData } from "../data/useStore.js";
import { persistActiveCompany } from "./companies.js";

// Comentários nos números: uma nota presa a uma linha (código gerencial da
// DRE ou do Balanço) e a um mês — "abril teve indenização pontual de R$ 80
// mil". Ficam no cadastro da empresa (company.comentarios) e aparecem nos
// Demonstrativos, nos cards do B.I. e nos slides do assistente.
// Formato: { id, code, month: "AAAA-MM", text, author, createdAt }.

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthNamePt = (month) => `${MONTHS[Number(String(month).slice(5, 7)) - 1] || ""}/${String(month).slice(0, 4)}`;

function activeCompany() {
  return state.activeGroupId ? null : (state.companies || []).find((item) => item.id === state.activeCompanyId) || null;
}

export function allComments(company = activeCompany()) {
  return Array.isArray(company?.comentarios) ? company.comentarios : [];
}

// O comentário vale para a linha e para as linhas acima dela: um comentário
// em "Aluguel" aparece também em "Despesas administrativas".
export function commentMatches(comment, code) {
  return comment.code === code || String(comment.code).startsWith(`${code}.`);
}

export function commentsFor(list, codes, months = null) {
  const wanted = Array.isArray(codes) ? codes : [codes];
  const monthSet = months ? new Set(months) : null;
  return list
    .filter((comment) => (!monthSet || monthSet.has(comment.month)) && wanted.some((code) => code && commentMatches(comment, code)))
    .sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt));
}

// Só os comentários exatamente desta linha neste mês (a marquinha na célula).
export function exactComments(list, code, month) {
  return list.filter((comment) => comment.code === code && comment.month === month);
}

function save(next) {
  const company = activeCompany();
  if (!company) return false;
  const companies = state.companies.map((item) => (item.id === company.id ? { ...item, comentarios: next } : item));
  setData({ companies });
  persistActiveCompany();
  return true;
}

export function addComment({ code, month, text }) {
  const clean = String(text || "").trim();
  if (!code || !/^\d{4}-\d{2}$/.test(String(month)) || !clean) return null;
  const comment = { id: `cm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, code, month, text: clean.slice(0, 600), author: state.userEmail || "", createdAt: new Date().toISOString() };
  return save([...allComments(), comment]) ? comment : null;
}

export function removeComment(id) {
  return save(allComments().filter((comment) => comment.id !== id));
}

export function updateComment(id, text) {
  const clean = String(text || "").trim();
  if (!clean) return false;
  return save(allComments().map((comment) => (comment.id === id ? { ...comment, text: clean.slice(0, 600), updatedAt: new Date().toISOString() } : comment)));
}

// De qual assunto do assistente de slides é a linha (o comentário entra
// como observação no slide desse assunto).
const TOPIC_PREFIXES = [
  ["DRE.01", "receita"],
  ["DRE.02", "deducoes"],
  ["DRE.03", "receita"],
  ["DRE.04", "custos"],
  ["DRE.05", "margens"],
  ["DRE.07.01", "pessoal"],
  ["DRE.06", "despesas"],
  ["DRE.07", "despesas"],
  ["DRE.08", "despesas"],
  ["DRE.09", "despesas"],
  ["DRE.10", "despesas"],
  ["DRE.12", "ebitda"],
  ["DRE.14", "financeiro"],
  ["DRE.17", "tributos"],
  ["DRE", "resultado"],
  ["01.01.01", "caixa"],
  ["01.01.02", "recebiveis"],
  ["01.01.03", "estoques"],
  ["01.02", "investimentos"],
  ["02.01.01", "fornecedores"],
  ["02.01.02", "endividamento"],
  ["02.02.01", "endividamento"],
  ["03", "pl"],
  ["01", "balanco"],
  ["02", "balanco"],
];

export function topicForCode(code) {
  const text = String(code || "");
  const match = TOPIC_PREFIXES.filter(([prefix]) => text === prefix || text.startsWith(`${prefix}.`)).sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1] : "visao";
}

// Os códigos de linha de uma fórmula de card do B.I. ({ numerator,
// denominator }) — para achar os comentários do card.
export function formulaCodes(formula) {
  return [...(formula?.numerator || []), ...(formula?.denominator || [])].map((term) => term.code).filter(Boolean);
}

export function formulaComments(formula, months, list = allComments()) {
  const codes = formulaCodes(formula);
  return codes.length && list.length ? commentsFor(list, codes, months) : [];
}
