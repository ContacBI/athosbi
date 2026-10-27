import { state } from "../data/useStore.js";
import { supabase } from "./supabaseClient.js";
import { activeWorkspaceName } from "./groups.js";
import { enderecoDoPortal } from "./enderecos.js";

export { deviceLabel, openShared } from "./sharingPublic.js";

// Apresentação compartilhada por link (tabela shared_presentations, ver
// supabase/schema.sql): uma "foto" dos slides em imagens, aberta sem login
// pela função open_shared_presentation, que confere validade, senha e
// registra cada abertura. O escritório cria, atualiza os números e revoga.

const COLUMNS = "id, token, title, period_label, slide_count, expires_at, revoked_at, created_by, created_at, updated_at, password_hash";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// 24 caracteres sorteados pelo navegador (~140 bits): impossível de adivinhar.
export function newShareToken(length = 24) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function shareUrl(token) {
  return `${enderecoDoPortal()}/p/${token}`;
}

export function activeWorkspace() {
  return state.activeGroupId
    ? { kind: "group", id: state.activeGroupId, name: activeWorkspaceName() }
    : { kind: "company", id: state.activeCompanyId, name: activeWorkspaceName() };
}

// Situação de um link: ativo, expirado ou revogado.
export function shareStatus(share, now = new Date()) {
  if (share.revoked_at) return "revogado";
  if (share.expires_at && new Date(share.expires_at) < now) return "expirado";
  return "ativo";
}

function clean(row) {
  const { password_hash, ...rest } = row;
  return { ...rest, has_password: Boolean(password_hash) };
}

export async function listShares(deckId) {
  const workspace = activeWorkspace();
  const { data, error } = await supabase
    .from("shared_presentations")
    .select(COLUMNS)
    .eq("workspace_id", workspace.id)
    .eq("deck_id", deckId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const shares = (data || []).map(clean);
  if (!shares.length) return shares;
  const { data: views, error: viewsError } = await supabase
    .from("shared_presentation_views")
    .select("share_id, viewed_at, outcome, device")
    .in("share_id", shares.map((share) => share.id))
    .order("viewed_at", { ascending: false })
    .limit(500);
  if (viewsError) throw viewsError;
  return shares.map((share) => {
    const mine = (views || []).filter((view) => view.share_id === share.id);
    const opened = mine.filter((view) => view.outcome === "aberto");
    return { ...share, views: opened, openCount: opened.length, lastOpen: opened[0]?.viewed_at || null, wrongPasswords: mine.length - opened.length };
  });
}

export async function createShare({ deck, title, periodLabel, slides, expiresAt, password }) {
  const workspace = activeWorkspace();
  const token = newShareToken();
  const { data, error } = await supabase
    .from("shared_presentations")
    .insert({
      token,
      workspace_kind: workspace.kind,
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      deck_id: deck.id,
      title: title || deck.name,
      period_label: periodLabel || "",
      slides,
      slide_count: slides.length,
      expires_at: expiresAt || null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  if (password) await setSharePassword(data.id, password);
  return clean({ ...data, password_hash: password ? "x" : null });
}

// "Atualizar os números": mesma URL, imagens novas.
export async function refreshShare(id, { slides, periodLabel, title }) {
  const patch = { slides, slide_count: slides.length, period_label: periodLabel || "", updated_at: new Date().toISOString() };
  if (title) patch.title = title;
  const { error } = await supabase.from("shared_presentations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function revokeShare(id) {
  const { error } = await supabase.from("shared_presentations").update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setShareExpiry(id, expiresAt) {
  const { error } = await supabase.from("shared_presentations").update({ expires_at: expiresAt || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setSharePassword(id, password) {
  const { error } = await supabase.rpc("set_shared_presentation_password", { p_share_id: id, p_password: password || "" });
  if (error) throw error;
}

// Validade a partir de hoje: "7", "30", "90" dias, "" = sem prazo, ou uma
// data "AAAA-MM-DD" (vale até o fim desse dia).
export function expiryFromChoice(choice, customDate) {
  if (choice === "never") return null;
  if (choice === "custom") return customDate ? new Date(`${customDate}T23:59:59`).toISOString() : null;
  const days = Number(choice) || 30;
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 0);
  return date.toISOString();
}
