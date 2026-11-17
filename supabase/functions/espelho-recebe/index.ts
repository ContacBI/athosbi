// Edge Function: espelho-recebe  (SÓ no projeto de TESTE — nunca publicar no oficial)
//
// Recebe, em tempo real, cada alteração de linha que acontece no banco OFICIAL (gatilho `espelhar_linha` do oficial, via pg_net) e a repete aqui, pra o site de
// teste ser sempre um espelho exato do oficial (pedido do Izaias, 17/11/2026: "qualquer ação no oficial já reflete no teste"). Só de ida: o oficial nunca é
// alterado por aqui. A cópia completa agendada (GitHub Actions) continua como conferência.
//
// Autenticação: cabeçalho `x-espelho` = segredo ESPELHO_SECRET (Edge Functions › Secrets). Publicar com verify_jwt = false.
// POST { tabela, op: "INSERT"|"UPDATE"|"DELETE", linha: {...a linha inteira...} }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET = Deno.env.get("ESPELHO_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// chave primária de cada tabela espelhada (igual a TABELAS em scripts/copiar-oficial-para-teste.mjs)
const CHAVES: Record<string, string> = {
  portal_admins: "email",
  colaboradores: "email",
  access_grants: "id",
  acesso_pessoas: "email",
  app_storage: "key",
  dominio_sync: "company_codigo,competencia,lote,parte",
  dominio_balancete: "company_codigo,lote,parte",
  dominio_carga: "company_id,ano",
  dominio_notas: "company_id,ano",
  dominio_fiscal: "cnpj",
  dominio_dfc_modelo: "company_codigo,cnpj",
  dominio_pedidos: "id",
  reforma_escritorio: "email",
  reforma_parametros: "id",
  reforma_empresas: "id",
  reforma_acessos: "id",
  reforma_simulacoes: "id",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return resposta({ ok: true });
  if (!SECRET || req.headers.get("x-espelho") !== SECRET) return resposta({ erro: "negado" }, 401);

  let corpo: { tabela?: string; op?: string; linha?: Record<string, unknown> };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "JSON inválido" }, 400);
  }
  const { tabela = "", op = "", linha } = corpo;
  const chave = CHAVES[tabela];
  if (!chave || !linha) return resposta({ erro: `tabela não espelhada: ${tabela}` }, 400);
  const colunas = chave.split(",");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    if (op === "DELETE") {
      let q = admin.from(tabela).delete();
      for (const c of colunas) q = q.eq(c, linha[c] as string);
      const { error } = await q;
      if (error) throw error;
      return resposta({ ok: true, op: "DELETE" });
    }
    // INSERT/UPDATE: as chamadas podem chegar fora de ordem — uma versão mais antiga não sobrescreve uma mais nova
    if (typeof linha.updated_at === "string") {
      let q = admin.from(tabela).select("updated_at");
      for (const c of colunas) q = q.eq(c, linha[c] as string);
      const { data } = await q.maybeSingle();
      const atual = (data as { updated_at?: string } | null)?.updated_at;
      if (atual && Date.parse(atual) > Date.parse(linha.updated_at)) return resposta({ ok: true, ignorado: "versão mais antiga" });
    }
    const { error } = await admin.from(tabela).upsert(linha, { onConflict: chave });
    if (error) throw error;
    return resposta({ ok: true, op });
  } catch (erro) {
    console.error(`espelho ${tabela} ${op}:`, (erro as Error).message);
    return resposta({ erro: (erro as Error).message }, 500);
  }
});
