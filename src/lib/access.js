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

// Ficha de quem é cada e-mail liberado (acesso_pessoas): nome, telefone e
// observação. As concessões continuam em access_grants — aqui é só o
// cadastro, pra tela mostrar "Yasmin Santos" em vez de só o e-mail.
// Map e-mail → ficha.
export async function listAccessPeople() {
  const { data, error } = await supabase.from("acesso_pessoas").select("email, nome, telefone, observacao, updated_at");
  if (error) throw error;
  return new Map((data || []).map((row) => [row.email, row]));
}

export async function saveAccessPerson({ email, nome = "", telefone = "", observacao = "" }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return;
  const by = await currentUserEmail();
  const { error } = await supabase.from("acesso_pessoas").upsert({
    email: cleanEmail,
    nome: String(nome || "").trim().slice(0, 120),
    telefone: String(telefone || "").trim().slice(0, 40),
    observacao: String(observacao || "").trim().slice(0, 300),
    updated_at: new Date().toISOString(),
    updated_by: by || null,
  });
  if (error) throw error;
}

// Some com a ficha (só o admin consegue — ver a RLS de acesso_pessoas).
export async function deleteAccessPerson(email) {
  const { error } = await supabase.from("acesso_pessoas").delete().eq("email", String(email || "").trim().toLowerCase());
  if (error) throw error;
}

// Dispara o e-mail de convite (ver supabase/functions/invite-user) — a
// pessoa recebe um link, clica, cai logada em /definir-senha e escolhe a
// senha ali. Não falha se o e-mail já tiver conta (alreadyExists: true);
// nesse caso a concessão em access_grants (já criada por grantAccess) é
// suficiente, não precisa de convite novo.
export async function inviteUser(email) {
  const { data, error } = await supabase.functions.invoke("invite-user", { body: { email } });
  if (error) throw error;
  return data;
}
