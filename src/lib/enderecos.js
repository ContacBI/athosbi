import { EH_TESTE } from "./ambiente.js";

// Endereço oficial do portal. Todo link que sai do app — e-mail de "esqueci
// minha senha", convite, link de apresentação compartilhada — aponta pra
// cá, nunca pro endereço antigo (athosbi.vercel.app, aposentado; quem cai
// nele é mandado pra cá, ver index.html e vercel.json).
export const PORTAL_URL = "https://bi.athosconsultoriaempresarial.com";

// No computador de quem desenvolve (localhost) e no site de teste, o link
// volta pro próprio endereço — pra testar convite e senha sem cair no
// site oficial (ver lib/ambiente.js).
export function enderecoDoPortal() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host === "localhost" || host === "127.0.0.1" || (EH_TESTE && host)) return window.location.origin;
  return PORTAL_URL;
}
