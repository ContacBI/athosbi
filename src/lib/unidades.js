// A carteira organizada por grupo (pedido do Izaias, 29/10/2026): "não vamos
// trabalhar com empresas isoladas (caso ela tenha grupo), vamos liberar o
// grupo pros clientes". A unidade de trabalho é o grupo — com o consolidado
// e cada empresa dentro; empresa sem grupo é a própria unidade.

const porNome = (a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");

// { grupos: [{ tipo: "grupo", id, nome, grupo, membros }], avulsas: [{ tipo: "empresa", id, nome, empresa }] }
// `soCompletos`: o cliente só vê o grupo inteiro (mesma regra de Empresas.jsx) —
// grupo com alguma empresa que ele não enxerga fica de fora, e as empresas
// dele aparecem como avulsas.
export function unidadesDaCarteira(companies = [], groups = [], { soCompletos = false } = {}) {
  const porId = new Map(companies.map((company) => [company.id, company]));
  const emGrupo = new Set();
  const grupos = [];
  for (const group of groups) {
    const ids = group.companyIds || [];
    const membros = ids.map((id) => porId.get(id)).filter(Boolean);
    if (soCompletos && (!ids.length || membros.length !== ids.length)) continue;
    membros.forEach((company) => emGrupo.add(company.id));
    grupos.push({ tipo: "grupo", id: group.id, nome: group.name, grupo: group, membros });
  }
  const avulsas = companies.filter((company) => !emGrupo.has(company.id)).map((company) => ({ tipo: "empresa", id: company.id, nome: company.name, empresa: company }));
  return { grupos: grupos.sort(porNome), avulsas: avulsas.sort(porNome) };
}

export function gruposDaEmpresa(groups = [], companyId) {
  if (!companyId) return [];
  return groups.filter((group) => (group.companyIds || []).includes(companyId));
}

// O grupo "em volta" do que está aberto, pra trocar entre o consolidado e
// cada empresa sem sair do B.I.: o próprio grupo aberto; numa empresa, o
// grupo em que ela foi aberta (lembrado), senão o aberto mais recentemente
// que tem ela, senão o primeiro.
export function grupoDoContexto({ groups = [], activeGroupId = "", activeCompanyId = "" }, { lembrado = "", recentes = [], visiveis = null } = {}) {
  const lista = visiveis || groups;
  if (activeGroupId) return lista.find((group) => group.id === activeGroupId) || null;
  const candidatos = gruposDaEmpresa(lista, activeCompanyId);
  if (!candidatos.length) return null;
  const doLembrado = candidatos.find((group) => group.id === lembrado);
  if (doLembrado) return doLembrado;
  for (const item of recentes) {
    if (item.tipo !== "grupo") continue;
    const recente = candidatos.find((group) => group.id === item.id);
    if (recente) return recente;
  }
  return candidatos[0];
}

const CHAVE_DO_CONTEXTO = "athosbi.grupoContexto";

export function lembrarGrupoContexto(id) {
  try {
    if (id) sessionStorage.setItem(CHAVE_DO_CONTEXTO, id);
  } catch {
    // sem armazenamento: cai no grupo aberto mais recentemente
  }
}

export function grupoLembrado() {
  try {
    return sessionStorage.getItem(CHAVE_DO_CONTEXTO) || "";
  } catch {
    return "";
  }
}
