// Endereço oficial do portal. Todo link que sai do app — e-mail de "esqueci
// minha senha", convite, link de apresentação compartilhada — aponta pra
// cá, nunca pro endereço antigo (athosbi.vercel.app, aposentado; quem cai
// nele é mandado pra cá, ver index.html e vercel.json).
export const PORTAL_URL = "https://bi.athosconsultoriaempresarial.com";

// No computador de quem desenvolve (localhost), o link volta pro próprio
// localhost — pra dar pra testar convite e senha sem publicar.
export function enderecoDoPortal() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host === "localhost" || host === "127.0.0.1") return window.location.origin;
  return PORTAL_URL;
}
