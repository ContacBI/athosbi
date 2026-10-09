import { supabase } from "../supabaseClient.js";
import { mesclarParametros } from "./parametros.js";

// Leitura/gravação do módulo Reforma Tributária no Supabase (tabelas
// reforma_empresas, reforma_acessos, reforma_simulacoes, reforma_parametros
// e reforma_escritorio — ver supabase/schema.sql). Quem vê o quê é decidido
// pela RLS: o cliente só a(s) empresa(s) liberada(s) pra ele em
// reforma_acessos; do escritório, só quem está em reforma_escritorio.

const READ_TIMEOUT_MS = 60000;
const timeoutSignal = () => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined);
const limparEmail = (email) => String(email || "").trim().toLowerCase();

// ── Parâmetros ──

export async function carregarParametros() {
  const { data, error } = await supabase.from("reforma_parametros").select("dados, updated_at, updated_by").eq("id", 1).maybeSingle().abortSignal(timeoutSignal());
  if (error) throw error;
  return { params: mesclarParametros(data?.dados), atualizadoEm: data?.updated_at || null, atualizadoPor: data?.updated_by || null };
}

export async function salvarParametros(dados, email) {
  const { error } = await supabase.from("reforma_parametros").upsert({ id: 1, dados, updated_at: new Date().toISOString(), updated_by: email || null });
  if (error) throw error;
}

// ── Empresas (cadastro próprio da Reforma, à parte da carteira do B.I.) ──
// `config` = configuração feita pelo escritório (regime, Simples, produtos e
// compras de partida — mesmo formato de `dados` de uma simulação); toda
// simulação nova da empresa começa dela. `orientacao` = recado pro cliente.

const CAMPOS_EMPRESA_LISTA = "id, nome, cnpj, bi_company_id, updated_at";

export async function listarEmpresas() {
  const { data, error } = await supabase.from("reforma_empresas").select(CAMPOS_EMPRESA_LISTA).order("nome").abortSignal(timeoutSignal());
  if (error) throw error;
  return data || [];
}

export async function carregarEmpresa(id) {
  const { data, error } = await supabase.from("reforma_empresas").select("*").eq("id", id).maybeSingle().abortSignal(timeoutSignal());
  if (error) throw error;
  return data;
}

export async function criarEmpresa({ nome, cnpj, biCompanyId, config }) {
  const { data, error } = await supabase
    .from("reforma_empresas")
    .insert({ nome: String(nome || "").trim(), cnpj: cnpj || null, bi_company_id: biCompanyId || null, config })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Autor e data são carimbados pelo banco (trigger), não daqui.
export async function salvarEmpresa(id, { nome, cnpj, biCompanyId, config, orientacao }) {
  const patch = {};
  if (nome !== undefined) patch.nome = String(nome).trim();
  if (cnpj !== undefined) patch.cnpj = cnpj || null;
  if (biCompanyId !== undefined) patch.bi_company_id = biCompanyId || null;
  if (config !== undefined) patch.config = config;
  if (orientacao !== undefined) patch.orientacao = orientacao.trim() ? orientacao : null;
  const { data, error } = await supabase.from("reforma_empresas").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

// Leva junto (cascata no banco) as simulações e os acessos da empresa.
export async function excluirEmpresa(id) {
  const { error } = await supabase.from("reforma_empresas").delete().eq("id", id);
  if (error) throw error;
}

// ── Acessos: quem do cliente entra em cada empresa ──

export async function listarAcessos({ empresaId } = {}) {
  let query = supabase.from("reforma_acessos").select("id, empresa_id, email, created_by, created_at").order("created_at");
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query.abortSignal(timeoutSignal());
  if (error) throw error;
  return data || [];
}

export async function liberarAcesso(empresaId, email) {
  const limpo = limparEmail(email);
  const { error } = await supabase.from("reforma_acessos").upsert({ empresa_id: empresaId, email: limpo }, { onConflict: "empresa_id,email", ignoreDuplicates: true });
  if (error) throw error;
  return limpo;
}

export async function retirarAcesso(id) {
  const { error } = await supabase.from("reforma_acessos").delete().eq("id", id);
  if (error) throw error;
}

// ── Simulações ──

const CAMPOS_LISTA = "id, empresa_id, nome, resumo, created_by, updated_by, created_at, updated_at";

// Sem `dados` (pode ser grande) — a lista e o painel só precisam do resumo.
export async function listarSimulacoes({ empresaId } = {}) {
  let query = supabase.from("reforma_simulacoes").select(CAMPOS_LISTA).order("updated_at", { ascending: false });
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query.abortSignal(timeoutSignal());
  if (error) throw error;
  return data || [];
}

export async function carregarSimulacao(id) {
  const { data, error } = await supabase.from("reforma_simulacoes").select("*").eq("id", id).maybeSingle().abortSignal(timeoutSignal());
  if (error) throw error;
  return data;
}

export async function criarSimulacao({ empresaId, nome, dados, resumo = null }) {
  const { data, error } = await supabase.from("reforma_simulacoes").insert({ empresa_id: empresaId, nome, dados, resumo }).select(CAMPOS_LISTA).single();
  if (error) throw error;
  return data;
}

// Autor e data são carimbados pelo banco (trigger), não daqui.
export async function salvarSimulacao(id, { nome, dados, resumo }) {
  const patch = {};
  if (nome !== undefined) patch.nome = nome;
  if (dados !== undefined) patch.dados = dados;
  if (resumo !== undefined) patch.resumo = resumo;
  const { data, error } = await supabase.from("reforma_simulacoes").update(patch).eq("id", id).select("updated_at, updated_by").single();
  if (error) throw error;
  return data;
}

export async function excluirSimulacao(id) {
  const { error } = await supabase.from("reforma_simulacoes").delete().eq("id", id);
  if (error) throw error;
}

// ── Notas fiscais da Domínio (resumo mandado pela Central, por CNPJ) ──
// Só o escritório da Reforma lê (RLS). null = ainda não chegou nada.

export async function carregarFiscal(cnpj) {
  const digitos = String(cnpj || "").replace(/\D/g, "");
  if (digitos.length !== 14) return null;
  const { data, error } = await supabase.from("dominio_fiscal").select("*").eq("cnpj", digitos).maybeSingle().abortSignal(timeoutSignal());
  if (error) throw error;
  return data;
}

// ── Quem do escritório vê a Reforma (Parâmetros › Colaborar) ──

export async function listarEscritorioReforma() {
  const { data, error } = await supabase.from("reforma_escritorio").select("email");
  if (error) throw error;
  return (data || []).map((row) => row.email);
}

export async function definirEscritorioReforma(email, ligado) {
  const limpo = limparEmail(email);
  if (!limpo) return;
  const { error } = ligado
    ? await supabase.from("reforma_escritorio").upsert({ email: limpo }, { onConflict: "email" })
    : await supabase.from("reforma_escritorio").delete().eq("email", limpo);
  if (error) throw error;
}
