import { supabase } from "./supabaseClient.js";
import { enderecoDoPortal } from "./enderecos.js";

// Pede ao Supabase o e-mail de "esqueci minha senha". O e-mail (modelo em
// supabase/emails/recuperar-senha.html) leva pra /confirmar-acesso com o
// token_hash; o redirectTo fica como antes pra quem ainda usa o modelo
// antigo ({{ .ConfirmationURL }}), que cai em /definir-senha já conectado.
export function pedirLinkDeSenha(email) {
  return supabase.auth.resetPasswordForEmail(String(email || "").trim(), { redirectTo: `${enderecoDoPortal()}/definir-senha` });
}
