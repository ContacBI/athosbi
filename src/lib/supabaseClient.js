import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Both come from a .env.local (dev) or the host's env vars (prod) — see
// .env.example. Missing them is a setup problem, not a runtime one, so it
// fails loud immediately instead of every Supabase call quietly rejecting
// with a confusing "Invalid URL" deep in the storage layer.
if (!url || !anonKey) {
  throw new Error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.example pra .env.local e preencha com os dados do seu projeto Supabase."
  );
}

// Token de acesso vencido que o navegador ainda achava válido — o PC
// voltou da suspensão antes do timer de renovação, ou o relógio dele está
// atrasado em relação ao servidor. O banco responde 401 "JWT expired"
// (PGRST303) e, sem isso, o portal mostrava "Erro ao carregar o portal".
export function respostaDeTokenVencido(status, texto) {
  return (status === 401 || status === 403 || status === 400) && /JWT expired|PGRST303|claim timestamp check failed/i.test(String(texto || ""));
}

// Só as chamadas de dados (banco, arquivos, funções) — nunca as do login
// (/auth/v1/), que é quem renova o token.
const DE_DADOS = /\/(rest|storage|functions)\/v1\//;

let renovando = null;
function renovarSessao() {
  // Várias leituras falhando juntas renovam uma vez só.
  renovando ||= supabase.auth.refreshSession().finally(() => {
    renovando = null;
  });
  return renovando;
}

// fetch do cliente: se a resposta for de token vencido, renova a sessão e
// repete a MESMA chamada uma vez com o token novo. Se não der pra renovar
// (sessão encerrada de vez), devolve a resposta original — o Supabase
// avisa a saída e o app volta pra tela de login.
async function fetchQueRenova(input, init) {
  const resposta = await fetch(input, init);
  const endereco = typeof input === "string" ? input : input?.url || String(input);
  if (resposta.ok || !DE_DADOS.test(endereco) || ![400, 401, 403].includes(resposta.status)) return resposta;
  const texto = await resposta.clone().text().catch(() => "");
  if (!respostaDeTokenVencido(resposta.status, texto)) return resposta;
  try {
    const { data } = await renovarSessao();
    const token = data?.session?.access_token;
    if (!token) return resposta;
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return await fetch(input, { ...init, headers });
  } catch (error) {
    console.error("Não consegui renovar a sessão vencida:", error);
    return resposta;
  }
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: fetchQueRenova },
});

// Bucket that holds the "outro" monthly-report archive attachments (see
// lib/companies.js attachMonthlyReport) — the one kind of data in this app
// that's a real binary file rather than JSON, so it can't live in the
// app_storage jsonb table alongside everything else.
export const MONTHLY_REPORTS_BUCKET = "monthly-reports";
