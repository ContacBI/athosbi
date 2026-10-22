import { supabase } from "./supabaseClient.js";

// Carga tributária (impostos próprios apurados no fiscal da Domínio ÷ faturamento) por empresa e ano. A Central calcula (só leitura na Domínio) e
// manda pela função dominio-carga; fica em public.dominio_carga (leitura: admin, colaborador e quem tem acesso à empresa).
// Cada linha: { ano, dados: { grupos: [{ id, nome }], meses: [12], trimestres: [4], ano_total }, synced_at }.
// Período (meses, trimestres e ano) = { fat: { servicos, vendas, total, notasServicos, notasVendas, outrasSaidas }, imp: { <grupo>: valor },
// impTotal, carga (fração ou null), reforma: { ibs, cbs }, naoClassificados: { "<código nome>": valor } }.
export async function fetchCargaTributaria(companyId) {
  if (!companyId) return [];
  const { data, error } = await supabase.from("dominio_carga").select("ano, dados, synced_at").eq("company_id", companyId).order("ano", { ascending: false });
  if (error) throw error;
  return data || [];
}

export const pctCarga = (value) => (value == null ? "—" : `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
