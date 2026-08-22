import { supabase } from "./supabaseClient.js";

// Controle de acessos — dono (portal_admins) vê/edita tudo; qualquer outro
// e-mail só enxerga (nunca edita) o que estiver liberado em access_grants,
// direto ou via grupo. A aplicação de verdade acontece no banco (ver
// supabase/schema.sql, políticas de RLS em app_storage) — este arquivo é só
// a camada que a UI usa pra saber o que mostrar e pra gerenciar concessões;
// mesmo que o front confie cegamente nisso, ninguém consegue ler/escrever
// mais do que a RLS permite direto pelo Supabase.

export async function currentUserEmail() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email?.toLowerCase() || "";
}

// Chamado uma vez no boot (ver App.jsx) pra decidir se essa sessão é do
// dono (menu Parâmetros completo, pode editar) ou de alguém liberado
// (portal fica travado só-leitura nas empresas/grupos concedidos).
export async function isPortalAdmin() {
  const email = await currentUserEmail();
  if (!email) return false;
  const { data, error } = await supabase.from("portal_admins").select("email").eq("email", email).maybeSingle();
  if (error) {
    console.error("Falha ao checar se é admin:", error);
    return false;
  }
  return Boolean(data);
}

// Lista todas as concessões (só um admin consegue de fato ler todas — pra
// quem não é admin a RLS devolve só a própria linha). Usado pela tela
// Parâmetros > Acessos.
export async function listAccessGrants() {
  const { data, error } = await supabase
    .from("access_grants")
    .select("id, email, scope_type, scope_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function grantAccess({ email, scopeType, scopeId }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !scopeId) return null;
  const { data, error } = await supabase
    .from("access_grants")
    .upsert({ email: cleanEmail, scope_type: scopeType, scope_id: scopeId }, { onConflict: "email,scope_type,scope_id" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function revokeAccess(id) {
  const { error } = await supabase.from("access_grants").delete().eq("id", id);
  if (error) throw error;
}
