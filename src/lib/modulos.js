import { supabase } from "./supabaseClient.js";

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

// Cliente sem nenhuma empresa liberada no B.I. lê 0 empresas (RLS).
export const temBi = (state) => Boolean(state.isAdmin || state.isColaborador || state.companies.length > 0);

export const temReforma = (state) => Boolean(state.isReformaEscritorio || state.reformaEmpresas.length > 0);
