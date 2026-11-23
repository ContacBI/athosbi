import { supabase } from "./supabaseClient.js";
import { equipeVeTudo, modulosDaEmpresa } from "./visibilidade.js";

// Dois módulos à parte, cada um com o seu cadastro e os seus acessos:
//   B.I.  — a carteira do escritório. Cliente vê as empresas/grupos que
//           foram liberados pra ele em Parâmetros › Acessos (access_grants).
//   Reforma Tributária — cadastro próprio de empresas (reforma_empresas).
//           Quem está em reforma_escritorio (chave em Parâmetros ›
//           Colaborar) cadastra, configura e convida o dono de cada empresa
//           dentro do próprio módulo (reforma_acessos). Ser admin ou
//           colaborador NÃO dá acesso à Reforma.
// O banco aplica tudo isso por RLS; aqui é só pra UI mostrar o caminho certo.

export async function isReformaEscritorio() {
  const { data, error } = await supabase.rpc("is_reforma_escritorio");
  if (error) {
    console.error("Falha ao checar acesso à Reforma Tributária:", error);
    return false;
  }
  return Boolean(data);
}

// Módulos complementares da empresa aberta (menu lateral, além do B.I
// Contábil). A equipe (admin/colaborador) vê todos; o cliente só os que
// foram liberados na ficha dele em Parâmetros › Acessos (acesso_pessoas.
// modulos). Sem nenhum, o cliente fica só no B.I. e o menu nem aparece.
// `precisaDeDados`: só abre com balancete/razão importado (sem eles a tela fica vazia).
// Empresas que têm dados do Gestão Click (grupo Anjos; códigos da Domínio). O módulo "DRE Gerencial" só aparece no menu quando a empresa ou o grupo aberto
// tem uma delas — as demais empresas não têm esses dados. Outro cliente que passe a usar o Gestão Click: é só incluir o código aqui.
export const CODIGOS_GESTAO_CLICK = ["120", "121", "122", "165", "223"];
// Empresas com o Revisa Nota (raiz do CNPJ): hoje só a Micromedical. Outra empresa que passe a usar: é só incluir a raiz aqui (e mandar os dados pela função revisa-nota).
export const RAIZES_REVISA_NOTA = ["07326871"];
const semZeros = (valor) => String(valor ?? "").trim().replace(/^0+(?=\d)/, "");
// `soCodigos`: o módulo só vale quando a empresa ativa (ou alguma do grupo ativo) tem um desses códigos. `soCnpjRaiz`: o mesmo, pela raiz do CNPJ (8 primeiros dígitos).
const digitos = (valor) => String(valor ?? "").replace(/\D/g, "");
const empresaServe = (modulo, company) =>
  Boolean((modulo.soCodigos && modulo.soCodigos.includes(semZeros(company.codigo))) || (modulo.soCnpjRaiz && modulo.soCnpjRaiz.some((raiz) => digitos(company.cnpj).startsWith(raiz))));
function aplicavel(modulo, state) {
  if (!modulo.soCodigos && !modulo.soCnpjRaiz) return true;
  const grupo = state.activeGroupId ? (state.groups || []).find((g) => g.id === state.activeGroupId) : null;
  const ids = grupo ? new Set(grupo.companyIds || []) : new Set([state.activeCompanyId]);
  return (state.companies || []).some((c) => ids.has(c.id) && empresaServe(modulo, c));
}

// Os módulos que valem pra uma empresa/grupo específico (o do "Acesso dos clientes"), sem depender de qual está aberta: o DRE Gerencial, por exemplo, só existe
// pras empresas do Gestão Click — nas demais nem aparece pra configurar.
export function modulosAplicaveisAoAlvo(alvo, ehGrupo, companies) {
  const ids = ehGrupo ? new Set(alvo?.companyIds || []) : new Set([alvo?.id]);
  const daqui = (companies || []).filter((c) => ids.has(c.id));
  return MODULOS_COMPLEMENTARES.filter((modulo) => (!modulo.soCodigos && !modulo.soCnpjRaiz) || daqui.some((c) => empresaServe(modulo, c)));
}

export const MODULOS_COMPLEMENTARES = [
  { id: "orcamento", nome: "Orçamento", rota: "/empresa/orcamento", descricao: "Orçado x realizado, mês a mês", precisaDeDados: true },
  { id: "carga-tributaria", nome: "Carga tributária", rota: "/empresa/carga-tributaria", descricao: "Impostos do fiscal ÷ faturamento" },
  { id: "analise-desempenho", nome: "Análise de desempenho", rota: "/empresa/analise-desempenho", descricao: "O que mais pesa no faturamento", precisaDeDados: true },
  { id: "entradas-saidas", nome: "Entradas x Saídas", rota: "/empresa/entradas-saidas", descricao: "Notas fiscais por acumulador" },
  { id: "dre-gerencial", nome: "DRE Gerencial", rota: "/empresa/dre-gerencial", descricao: "Vendas e despesas do Gestão Click", soCodigos: CODIGOS_GESTAO_CLICK },
  { id: "revisa-nota", nome: "Revisa Nota", rota: "/empresa/revisa-nota", descricao: "Produtos e clientes: classificação IBS/CBS e perfil do comprador", soCnpjRaiz: RAIZES_REVISA_NOTA },
];

export function modulosLiberados(state) {
  const aplicaveis = MODULOS_COMPLEMENTARES.filter((modulo) => aplicavel(modulo, state));
  if (state.isAdmin || state.isColaborador || equipeVeTudo(state)) return aplicaveis.map((modulo) => modulo.id);
  // empresa/grupo configurado (Parâmetros › Acesso dos clientes): a lista dele manda; senão vale a ficha da pessoa
  const daEmpresa = modulosDaEmpresa();
  const todos = aplicaveis.map((modulo) => modulo.id);
  if (daEmpresa) return todos.filter((id) => daEmpresa.includes(id));
  return todos.filter((id) => (state.modulosCliente || []).includes(id));
}

// As ferramentas que esta tela mostra/abre, cada uma com `doCliente`: se o
// cliente desta empresa/grupo vê (true/false) ou null (vale a ficha de cada
// pessoa). A equipe nos modos do hub (lib/modoEquipe.js) — fora do "ver como"
// uma pessoa — vê todas, mesmo no portal, marcadas quando o cliente não vê;
// o resto, só as liberadas.
export function ferramentasDaTela(state) {
  const liberados = modulosLiberados(state);
  const equipe = Boolean(state.modoEquipe) && !state.pessoaVista && !state.clienteSimulado;
  const config = modulosDaEmpresa();
  return MODULOS_COMPLEMENTARES.filter((modulo) => aplicavel(modulo, state) && (equipe || liberados.includes(modulo.id))).map((modulo) => ({ ...modulo, doCliente: config ? config.includes(modulo.id) : null }));
}

// O módulo complementar de uma rota (null = B.I. ou outra tela).
export const moduloDaRota = (path) => MODULOS_COMPLEMENTARES.find((modulo) => String(path || "").startsWith(modulo.rota))?.id || null;

// Cliente sem nenhuma empresa liberada no B.I. lê 0 empresas (RLS).
export const temBi = (state) => Boolean(state.isAdmin || state.isColaborador || state.companies.length > 0);

export const temReforma = (state) => Boolean(state.isReformaEscritorio || state.reformaEmpresas.length > 0);
