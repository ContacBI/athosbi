// "Ver como": a lista de pessoas dos clientes que o login de visualização (e a equipe, no portal) pode escolher pra ver EXATAMENTE a tela dela. Junta as concessões de acesso
// (access_grants), a ficha de cada e-mail (acesso_pessoas) e os tipos de acesso (Financeiro, Comercial…) que cada empresa/grupo deu a essa pessoa (`visibilidade.perfilPorPessoa`).
const norm = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function pessoasParaVerComo({ grants = [], fichas = new Map(), companies = [], groups = [] } = {}) {
  const porEmail = new Map();
  for (const grant of grants) {
    const email = String(grant.email || "").trim().toLowerCase();
    if (!email) continue;
    if (!porEmail.has(email)) porEmail.set(email, { email, empresas: [], grupos: [] });
    const pessoa = porEmail.get(email);
    if (grant.scope_type === "company") pessoa.empresas.push(grant.scope_id);
    else if (grant.scope_type === "group") pessoa.grupos.push(grant.scope_id);
  }
  const lista = [];
  for (const pessoa of porEmail.values()) {
    const ficha = fichas.get(pessoa.email);
    const alvos = [...pessoa.grupos.map((id) => groups.find((group) => group.id === id)), ...pessoa.empresas.map((id) => companies.find((company) => company.id === id))].filter(Boolean);
    if (!alvos.length) continue;
    // os tipos de acesso dessa pessoa em cada empresa/grupo dela, sem repetir
    const tipos = new Set();
    for (const alvo of alvos) {
      const v = alvo.visibilidade;
      const id = v?.perfilPorPessoa?.[pessoa.email];
      const perfil = id ? (v.perfis || []).find((item) => item.id === id) : null;
      if (perfil?.nome) tipos.add(perfil.nome);
    }
    lista.push({
      email: pessoa.email,
      nome: ficha?.nome || "",
      modulos: Array.isArray(ficha?.modulos) ? ficha.modulos : [],
      empresas: pessoa.empresas,
      grupos: pessoa.grupos,
      tipos: [...tipos],
      onde: alvos.map((alvo) => alvo.name).slice(0, 3),
      maisOnde: Math.max(0, alvos.length - 3),
    });
  }
  return lista.sort((a, b) => norm(a.nome || a.email).localeCompare(norm(b.nome || b.email)));
}

/** Filtra a lista pelo que foi digitado (nome, e-mail, tipo de acesso ou empresa). */
export function filtrarPessoas(pessoas, termo) {
  const busca = norm(termo).trim();
  if (!busca) return pessoas;
  return pessoas.filter((pessoa) => norm([pessoa.nome, pessoa.email, ...pessoa.tipos, ...pessoa.onde].join(" ")).includes(busca));
}

/** A `pessoa` que o modo portal espera (lib/modoEquipe.js › entrarNoModo). */
export const comoPessoa = (pessoa) => ({ email: pessoa.email, nome: pessoa.nome, modulos: pessoa.modulos, empresas: pessoa.empresas, grupos: pessoa.grupos });

/**
 * Só as pessoas liberadas pra empresa/grupo que está aberto: numa empresa, quem tem a empresa direto ou um grupo que a contém; num grupo, quem tem o grupo. Sem nada aberto,
 * a lista inteira. Ninguém liberado = lista vazia.
 */
export function pessoasDoAlvo(pessoas, { companyId = "", groupId = "", groups = [] } = {}) {
  if (groupId) return pessoas.filter((pessoa) => pessoa.grupos.includes(groupId));
  if (!companyId) return pessoas;
  const gruposDaEmpresa = groups.filter((group) => (group.companyIds || []).includes(companyId)).map((group) => group.id);
  return pessoas.filter((pessoa) => pessoa.empresas.includes(companyId) || pessoa.grupos.some((id) => gruposDaEmpresa.includes(id)));
}
