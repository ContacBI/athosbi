import { state } from "../data/useStore.js";

// Visibilidade por empresa/grupo (pedido do Izaias, 28/10/2026): a equipe configura UMA vez o que os clientes daquela empresa (ou grupo) enxergam; tudo
// começa visível e a equipe oculta o que quiser. A configuração mora no próprio cadastro da empresa/grupo (`visibilidade`):
//   { ocultos: ["bi:tab:<aba>", "bi:sub:<aba>:<subaba>", "bi:w:<aba>:<subaba|_>:<item>", "es:insights", ...], modulos?: ["orcamento", ...] }
// `modulos` (quando existe) é a lista de módulos complementares liberados pros clientes desta empresa/grupo; sem ela vale a ficha de cada pessoa.
// É só a TELA: quem tem acesso à empresa continua com o dado liberado no banco; a equipe sempre vê tudo (e a "visão do cliente" mostra o que o cliente vê).

export const kAba = (abaId) => `bi:tab:${abaId}`;
export const kSubaba = (abaId, subId) => `bi:sub:${abaId}:${subId}`;
export const kItem = (abaId, subId, itemId) => `bi:w:${abaId}:${subId || "_"}:${itemId}`;

// Blocos do módulo Entradas x Saídas que dá pra ocultar (os acumuladores são sempre só da equipe).
export const BLOCOS_ENTRADAS_SAIDAS = [
  { id: "es:kpis", nome: "Cartões de resumo" },
  { id: "es:insights", nome: "Leitura rápida (frases)" },
  { id: "es:comparativo", nome: "Comparativo entre as empresas (grupo)" },
  { id: "es:grafico", nome: "Gráfico mês a mês" },
];

/**
 * A equipe vê TUDO (pedido do Izaias, 21/11/2026): no console e também no portal do hub, onde a tela só imita o cliente nos controles de edição. O que o cliente não vê só
 * some quando a equipe liga "Ver como cliente" (clienteSimulado) ou olha como UMA pessoa (pessoaVista).
 */
export function equipeVeTudo(st = state) {
  return Boolean(st.isAdmin || st.isColaborador || (st.modoEquipe === "portal" && !st.pessoaVista && !st.clienteSimulado && (st.realIsAdmin || st.realIsColaborador)));
}

/** Se a visibilidade já foi configurada de verdade (modo "marcados", lista antiga de ocultos ou lista de módulos). */
export const temConfiguracao = (v) => Boolean(v && (v.modo === "marcados" || Array.isArray(v.ocultos) || Array.isArray(v.modulos) || (Array.isArray(v.perfis) && v.perfis.length)));

/**
 * Perfis de acesso (21/11/2026): numa mesma empresa/grupo, pessoas diferentes veem telas diferentes. `visibilidade.perfis` = [{ id, nome, visiveis, modulos, areasOcultas }] e
 * `visibilidade.perfilPorPessoa` = { "email": perfilId }. Quem não tem perfil (ou tem um que sumiu) fica no padrão da própria `visibilidade`. Devolve a configuração que vale
 * pra essa pessoa, no mesmo formato de sempre ({ modo: "marcados", visiveis, modulos, areasOcultas }).
 */
export function configDaPessoa(v, email) {
  const id = v?.perfilPorPessoa?.[String(email || "").trim().toLowerCase()];
  const perfil = id ? (v.perfis || []).find((p) => p.id === id) : null;
  if (!perfil) return v;
  return { modo: "marcados", visiveis: perfil.visiveis || [], modulos: perfil.modulos || [], areasOcultas: perfil.areasOcultas || [] };
}

/**
 * Empresa sem configuração própria HERDA a do grupo a que pertence (21/11/2026): o que a equipe marcou no grupo vale também pra empresa aberta sozinha. Se ela estiver
 * em mais de um grupo configurado, vale o de configuração mais recente. Devolve { grupo, visibilidade } ou null (empresa com configuração própria, ou sem grupo configurado).
 */
export function configHerdada(company, groups) {
  if (!company || temConfiguracao(company.visibilidade)) return null;
  const candidatos = (groups || []).filter((g) => (g.companyIds || []).includes(company.id) && temConfiguracao(g.visibilidade));
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { grupo: candidatos[0], visibilidade: visibilidadeParaEmpresa(candidatos[0], company), varios: candidatos.length > 1 };
}

const nomeNorm = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * O que o grupo marcou vale pra TODAS as empresas dele (pedido do Izaias, 24/11/2026). As chaves de aba, subaba e item levam o código da aba, e cada empresa tem as abas
 * com códigos próprios (mesmos nomes: Resumo, Demonstrativos…), então a configuração do grupo é traduzida pros códigos da empresa, casando aba e subaba pelo NOME.
 * As chaves originais ficam (se os códigos já coincidirem nada muda); o que a empresa não tem de igual nome fica como está.
 */
export function visibilidadeParaEmpresa(grupo, company) {
  const v = grupo?.visibilidade;
  if (!v) return v;
  const abasG = Array.isArray(grupo?.dashboardTabs) ? grupo.dashboardTabs : [];
  const abasE = Array.isArray(company?.dashboardTabs) ? company.dashboardTabs : [];
  if (!abasG.length || !abasE.length) return v;
  const abaDaEmpresa = new Map(); // código da aba do grupo → { id da empresa, subabas: código do grupo → código da empresa }
  for (const aba of abasG) {
    const par = abasE.find((x) => nomeNorm(x.name) === nomeNorm(aba.name));
    if (!par) continue;
    const subs = new Map();
    for (const sub of aba.subTabs || []) {
      const igual = (par.subTabs || []).find((x) => nomeNorm(x.name) === nomeNorm(sub.name));
      if (igual) subs.set(sub.id, igual.id);
    }
    abaDaEmpresa.set(aba.id, { id: par.id, subs });
  }
  const traduzir = (chave) => {
    const partes = String(chave).split(":");
    if (partes[0] !== "bi") return chave;
    const [, tipo, abaId, a3, ...resto] = partes;
    const alvo = abaDaEmpresa.get(abaId);
    if (!alvo) return chave;
    if (tipo === "tab") return kAba(alvo.id);
    if (tipo === "sub") return kSubaba(alvo.id, alvo.subs.get(a3) || a3);
    if (tipo === "w") return kItem(alvo.id, a3 === "_" ? null : alvo.subs.get(a3) || a3, resto.join(":"));
    return chave;
  };
  const dobrar = (lista) => (Array.isArray(lista) ? [...new Set([...lista, ...lista.map(traduzir)])] : lista);
  return { ...v, ...(Array.isArray(v.visiveis) ? { visiveis: dobrar(v.visiveis) } : {}), ...(Array.isArray(v.ocultos) ? { ocultos: dobrar(v.ocultos) } : {}), ...(Array.isArray(v.perfis) ? { perfis: v.perfis.map((p) => ({ ...p, visiveis: dobrar(p.visiveis) })) } : {}) };
}

/** Visibilidade configurada da empresa/grupo que está aberto agora (a empresa sem configuração própria usa a do grupo dela). */
export function visibilidadeAtiva() {
  let v;
  if (state.activeGroupId) v = state.groups.find((group) => group.id === state.activeGroupId)?.visibilidade || null;
  else {
    const company = state.companies.find((item) => item.id === state.activeCompanyId);
    v = configHerdada(company, state.groups)?.visibilidade || company?.visibilidade || null;
  }
  // "ver como uma pessoa" (equipe) usa o e-mail dela; senão, o de quem está logado
  return configDaPessoa(v, state.pessoaVista?.email || state.userEmail);
}

/**
 * A equipe vê tudo; o cliente (ou a equipe na "visão do cliente") vê conforme a configuração da empresa/grupo:
 *  - modo "marcados" (o padrão novo, 29/10/2026): só aparece o que a equipe MARCOU (`visiveis`); item novo nasce desmarcado;
 *  - legado (`ocultos`): aparece tudo, menos o que foi ocultado — vale até a equipe abrir o "Acesso dos clientes" e salvar de novo;
 *  - sem configuração: aparece tudo (pra não tirar a tela de quem já usa antes de configurar).
 */
export function oculto(chave) {
  if (equipeVeTudo()) return false;
  return ocultoNaConfiguracao(visibilidadeAtiva(), chave);
}

/** Se uma configuração de visibilidade (a `visibilidade` de uma empresa/grupo) esconde a chave do cliente — mesmas regras de `oculto`. */
export function ocultoNaConfiguracao(v, chave) {
  if (v?.modo === "marcados") return !(v.visiveis || []).includes(chave);
  return (v?.ocultos || []).includes(chave);
}

/** Todas as chaves que dá pra marcar numa empresa/grupo (abas, subabas, itens do B.I e blocos do Entradas x Saídas). */
export function todasAsChaves(alvo) {
  const chaves = [];
  for (const aba of abasDoAlvo(alvo)) {
    chaves.push(kAba(aba.id));
    for (const item of aba.widgets || []) chaves.push(kItem(aba.id, null, item.id));
    for (const sub of aba.subTabs || []) {
      chaves.push(kSubaba(aba.id, sub.id));
      for (const item of sub.widgets || []) chaves.push(kItem(aba.id, sub.id, item.id));
    }
  }
  BLOCOS_ENTRADAS_SAIDAS.forEach((b) => chaves.push(b.id));
  return [...new Set(chaves)];
}

/**
 * Áreas do menu do site que a equipe escondeu do cliente desta empresa/grupo (`visibilidade.areasOcultas`: "bi", "reforma", "servicos", "conteudos", "ferramentas").
 * Aqui o padrão é VISÍVEL (só some o que foi listado), então configurações antigas não perdem nenhuma área. O Início nunca some. A equipe vê tudo.
 */
export const AREAS_OCULTAVEIS = ["bi", "reforma", "servicos", "conteudos", "ferramentas"];
export function areaOculta(id) {
  if (equipeVeTudo()) return false;
  return (visibilidadeAtiva()?.areasOcultas || []).includes(id);
}

/** Módulos que a empresa/grupo aberto libera pros clientes — null = não configurado (vale a ficha da pessoa). */
export function modulosDaEmpresa() {
  const lista = visibilidadeAtiva()?.modulos;
  return Array.isArray(lista) ? lista : null;
}

/** Árvore de abas do B.I da empresa/grupo (a do cadastro, que é a que o cliente vê): [{ id, name, subTabs: [{ id, name, widgets }], widgets }]. */
export function abasDoAlvo(alvo) {
  const abas = Array.isArray(alvo?.dashboardTabs) ? alvo.dashboardTabs : [];
  return abas.map((aba) => ({ id: aba.id, name: aba.name, subTabs: aba.subTabs || [], widgets: aba.widgets || [] }));
}
