import { supabase } from "./supabaseClient.js";

// A parte do compartilhamento que a página pública (/p/<código>) usa —
// separada de lib/sharing.js pra quem abre o link não baixar o resto do
// portal.

// Quem abre: celular, tablet ou computador (só isso fica registrado).
export function deviceLabel() {
  const agent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/ipad|tablet/i.test(agent)) return "tablet";
  if (/mobi|iphone|android/i.test(agent)) return "celular";
  return "computador";
}

export async function openShared(token, password) {
  const { data, error } = await supabase.rpc("open_shared_presentation", { p_token: token, p_password: password || null, p_device: deviceLabel() });
  if (error) throw error;
  return data || { status: "not_found" };
}
