import { supabase } from "./supabaseClient.js";
import { currentUserEmail } from "./access.js";

// Colaboradores internos — dois níveis, ver supabase/schema.sql:
//   Total    — mesma coisa que portal_admins (ver lib/access.js
//              isPortalAdmin): acesso e edição de tudo, sem crivo nenhum.
//   Restrito — tabela `colaboradores` — enxerga a carteira inteira, mas só
//              edita as empresas onde está em `company.responsaveis`.
// A aplicação de verdade é a RLS do banco; este arquivo é só a UI de
// gerenciar as duas listas (tela Parâmetros > Colaborar, admin-only).

export async function isColaborador() {
  const email = await currentUserEmail();
  if (!email) return false;
  const { data, error } = await supabase.from("colaboradores").select("email").eq("email", email).maybeSingle();
  if (error) {
    console.error("Falha ao checar se é colaborador:", error);
    return false;
  }
  return Boolean(data);
}

export async function listAdmins() {
  const { data, error } = await supabase.from("portal_admins").select("email, nome, created_at").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addAdmin({ nome, email }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return null;
  const { data, error } = await supabase
    .from("portal_admins")
    .upsert({ email: cleanEmail, nome: String(nome || "").trim() || null }, { onConflict: "email" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeAdmin(email) {
  const { error } = await supabase.from("portal_admins").delete().eq("email", email);
  if (error) throw error;
}

export async function listColaboradores() {
  const { data, error } = await supabase.from("colaboradores").select("email, nome, created_at").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addColaborador({ nome, email }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return null;
  const { data, error } = await supabase
    .from("colaboradores")
    .upsert({ email: cleanEmail, nome: String(nome || "").trim() || null }, { onConflict: "email" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeColaborador(email) {
  const { error } = await supabase.from("colaboradores").delete().eq("email", email);
  if (error) throw error;
}

// Espelha has_any_responsibility() do banco (supabase/schema.sql) — usado
// só pra UI decidir se mostra os botões de criar/editar em Planos padrão,
// Representantes e Acessos pra um colaborador Restrito. A aplicação de
// verdade continua sendo a RLS.
export function hasAnyResponsibility(state) {
  return (state.companies || []).some((company) => (company.responsaveis || []).includes(state.userEmail));
}

// Empresas/grupos onde ESTE colaborador pode liberar/revogar acesso de
// cliente (ver access_grants_colaborador_scoped) — pra filtrar o que o
// AccessModal oferece pra quem não é admin.
export function companiesResponsavel(state) {
  return (state.companies || []).filter((company) => (company.responsaveis || []).includes(state.userEmail));
}

export function groupsResponsavel(state) {
  return (state.groups || []).filter((group) =>
    (group.companyIds || []).some((id) => {
      const company = state.companies.find((item) => item.id === id);
      return company && (company.responsaveis || []).includes(state.userEmail);
    })
  );
}

// Mesmo crivo de groupsResponsavel, mas pra UM grupo só — espelha
// is_responsavel_for_group() do banco (supabase/schema.sql): responsável
// em QUALQUER empresa-membro já basta pra editar o workspace consolidado
// do grupo, sem precisar ser responsável pelas outras também. Usado onde
// só interessa "esse grupo específico dá pra editar?" (CompanyLayout.jsx,
// CompanyTopBar.jsx, PersonalizarHub.jsx).
export function isResponsavelForGroup(state, groupId) {
  const group = (state.groups || []).find((item) => item.id === groupId);
  if (!group) return false;
  return (group.companyIds || []).some((id) => {
    const company = (state.companies || []).find((item) => item.id === id);
    return company && (company.responsaveis || []).includes(state.userEmail);
  });
}
