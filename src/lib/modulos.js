import { supabase } from "./supabaseClient.js";
import { modulosDaEmpresa } from "./visibilidade.js";

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
export const MODULOS_COMPLEMENTARES = [
  { id: "orcamento", nome: "Orçamento", rota: "/empresa/orcamento" },
  { id: "carga-tributaria", nome: "Carga tributária", rota: "/empresa/carga-tributaria" },
  { id: "analise-desempenho", nome: "Análise de desempenho", rota: "/empresa/analise-desempenho" },
  { id: "entradas-saidas", nome: "Entradas x Saídas", rota: "/empresa/entradas-saidas" },
];

export function modulosLiberados(state) {
  if (state.isAdmin || state.isColaborador) return MODULOS_COMPLEMENTARES.map((modulo) => modulo.id);
  // empresa/grupo configurado (Parâmetros › Acesso dos clientes): a lista dele manda; senão vale a ficha da pessoa
  const daEmpresa = modulosDaEmpresa();
  const todos = MODULOS_COMPLEMENTARES.map((modulo) => modulo.id);
  if (daEmpresa) return todos.filter((id) => daEmpresa.includes(id));
  return todos.filter((id) => (state.modulosCliente || []).includes(id));
}

// O módulo complementar de uma rota (null = B.I. ou outra tela).
export const moduloDaRota = (path) => MODULOS_COMPLEMENTARES.find((modulo) => String(path || "").startsWith(modulo.rota))?.id || null;

// Cliente sem nenhuma empresa liberada no B.I. lê 0 empresas (RLS).
export const temBi = (state) => Boolean(state.isAdmin || state.isColaborador || state.companies.length > 0);

export const temReforma = (state) => Boolean(state.isReformaEscritorio || state.reformaEmpresas.length > 0);
