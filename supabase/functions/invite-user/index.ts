// Edge Function: invite-user
//
// Convida um e-mail novo pro portal — cria a conta no Supabase Auth SEM
// senha e dispara o e-mail de convite; a pessoa clica, confirma numa
// página intermediária (ver src/pages/ConfirmAccess.jsx — o e-mail
// aponta pra lá, não direto pro link do Supabase, justamente pra não ser
// consumido sozinho por verificadores automáticos de e-mail corporativo),
// cai logada em /definir-senha (ver src/pages/SetPassword.jsx) e escolhe
// a senha ali.
//
// Só existe como função de servidor porque supabase.auth.admin.* exige a
// service role key, que NUNCA pode ir pro código do front-end (bundle do
// navegador é público). Aqui ela só existe como variável de ambiente da
// própria função, injetada automaticamente pelo Supabase — não precisa
// cadastrar segredo nenhum na mão.
//
// Como publicar (painel do Supabase, sem precisar de CLI):
//   1. Abra o projeto em supabase.com > Edge Functions > Create a new function
//   2. Nome: invite-user
//   3. Cole o conteúdo deste arquivo inteiro e clique em Deploy
//   4. Em Edge Functions > invite-user > Secrets, adicione SITE_URL com a
//      URL de produção do portal (ex.: https://athosbi.vercel.app) — é pra
//      onde o link do e-mail de convite manda a pessoa.
//   5. Em Authentication > URL Configuration > Redirect URLs, adicione
//      "<SITE_URL>/definir-senha" (e a mesma coisa com localhost:5173 se
//      quiser testar convite em desenvolvimento).
//
// Quem pode chamar: admin (portal_admins), colaborador Restrito
// (colaboradores) OU quem é do escritório da Reforma Tributária
// (reforma_escritorio) — verificado abaixo com as mesmas funções que a RLS usa,
// com o token de quem chamou. Um colaborador Restrito convida tanto
// cliente (Acessos) quanto, indiretamente, ninguém em Colaborar (essa tela
// é admin-only no front, mas o convite em si não distingue "pra quê" —
// quem decide se a pessoa vira Total/Restrito/cliente é a linha que já foi
// criada em portal_admins/colaboradores/access_grants antes de chamar
// aqui). Quem não é admin só convida e-mail que já foi liberado antes:
// colaborador, numa empresa dele no B.I. (access_grants); escritório da
// Reforma, numa empresa da Reforma (reforma_acessos) — ver a checagem logo
// depois de ler o e-mail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  // Cliente com o token de quem chamou — só usado pra confirmar que é
  // admin (mesma checagem que a RLS já faz em app_storage).
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const [{ data: isAdmin }, { data: isColaborador }, { data: isReforma }] = await Promise.all([
    callerClient.rpc("is_portal_admin"),
    callerClient.rpc("is_colaborador"),
    callerClient.rpc("is_reforma_escritorio"),
  ]);
  if (!isAdmin && !isColaborador && !isReforma) {
    return json({ error: "Só admin, colaborador ou o escritório da Reforma pode convidar." }, 403);
  }

  let email = "";
  try {
    ({ email } = await req.json());
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return json({ error: "E-mail inválido." }, 400);

  // Quem não é admin só convida quem já liberou antes (a tela cria o acesso
  // ANTES de chamar aqui), lido com o token de quem chamou — a RLS só mostra
  // pro colaborador as concessões das empresas onde ele é responsável, e
  // reforma_acessos só pro escritório da Reforma. Sem nenhuma pra esse
  // e-mail, não convida. Sem isso, qualquer um deles criava conta pra
  // qualquer e-mail.
  if (!isAdmin) {
    const liberado = async (tabela) => {
      const { data, error } = await callerClient.from(tabela).select("id").eq("email", cleanEmail).limit(1);
      return !error && data?.length > 0;
    };
    const ok = (isColaborador && (await liberado("access_grants"))) || (isReforma && (await liberado("reforma_acessos")));
    if (!ok) {
      return json({ error: "Libere primeiro o acesso dessa pessoa a uma empresa (Parâmetros > Acessos, ou na própria empresa da Reforma)." }, 403);
    }
  }

  // Só a service role pode criar usuário/disparar convite — bypassa a RLS
  // por completo, então essa chave nunca pode sair desta função.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error } = await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
    redirectTo: `${SITE_URL}/definir-senha`,
  });

  if (error) {
    // E-mail já tem conta — não é uma falha do fluxo de acesso (a
    // concessão em access_grants já foi criada à parte), só não precisa
    // de convite novo.
    const alreadyExists = /already.*registered/i.test(error.message || "");
    return json({ error: error.message, alreadyExists }, alreadyExists ? 200 : 400);
  }

  return json({ ok: true });
});
