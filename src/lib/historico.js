import { supabase } from "./supabaseClient.js";
import { COMPANY_KEY_PREFIX, GROUPS_KEY } from "./persistence.js";

// Histórico de alterações de um grupo/empresa no console (pedido do Izaias,
// 29/10/2026: "quem mudou o quê"), a partir do backup automático que o banco
// já guarda (app_storage_history — ver HistoricoVersoes.jsx): quem gravou,
// quando e em qual cadastro. Só os metadados — a versão em si fica pra tela
// de Histórico de versões (baixar/restaurar). Só o admin lê.
export const chaveDaEmpresa = (id) => `${COMPANY_KEY_PREFIX}${id}`;

export async function alteracoesRecentes({ empresas = [], comGrupos = false, limite = 60 }) {
  const chaves = [...empresas.map(chaveDaEmpresa), ...(comGrupos ? [GROUPS_KEY] : [])];
  if (!chaves.length) return [];
  const { data, error } = await supabase.from("app_storage_history").select("id, key, saved_at, saved_by, motivo").in("key", chaves).order("saved_at", { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}

// O que cada linha quer dizer, em português.
export function descreverAlteracao(linha, nomeDaEmpresa) {
  const grupos = linha.key === GROUPS_KEY;
  const id = String(linha.key || "").slice(COMPANY_KEY_PREFIX.length);
  const empresa = nomeDaEmpresa(id) || "uma empresa";
  const detalhe = grupos ? " (montagem, painéis ou o que o cliente vê)" : " (painéis, De/Para, dados ou o que o cliente vê)";
  if (linha.motivo === "restauracao") return `restaurou uma versão anterior ${grupos ? "dos grupos" : `do cadastro de ${empresa}`}`;
  if (linha.motivo === "exclusao") return `apagou ${grupos ? "os grupos" : `o cadastro de ${empresa}`}`;
  return `alterou ${grupos ? "os grupos" : `o cadastro de ${empresa}`}${detalhe}`;
}
