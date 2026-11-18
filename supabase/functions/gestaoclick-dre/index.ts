// Edge Function: gestaoclick-dre
//
// DRE gerencial por loja (grupo Anjos), vinda do Gestão Click: a Central lê as telas do Gestão Click (robô de leitura), o usuário VALIDA as alterações de
// meses passados na própria Central, e só o que está validado chega aqui. Fica em public.gestaoclick_dre; o módulo "DRE Gerencial" do portal lê de lá.
//
// Autenticação: cabeçalho `x-sync-token` = segredo DOMINIO_SYNC_TOKEN (o mesmo da dominio-sync). verify_jwt = false.
//
// GET  → { empresas: [{ codigo, cnpj, nome, assinaturas: { "2026": "..." } }] } as empresas do portal com a assinatura já recebida de cada ano, pra Central
//        só mandar de novo o que mudou.
// POST → { empresa, cnpj, ano, assinatura, dados: { meses: { "1": { receita, vendas: { Situação: valor }, qtdVendas, pagamentos: { plano: valor },
//        recebimentos: { plano: valor }, parcial, coletadoEm } } } }
//        receita = soma das vendas Concretizadas; pagamentos/recebimentos = totais por Plano de contas do Fluxo de caixa; parcial = mês corrente (ainda aberto).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_TOKEN = Deno.env.get("DOMINIO_SYNC_TOKEN") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-sync-token, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function sameToken(given: string, expected: string) {
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const normalizeCodigo = (value: unknown) => String(value ?? "").trim().replace(/^0+(?=\d)/, "");
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

type Empresa = { id: string; codigo: string; cnpj: string; nome: string };

async function empresasDoPortal(admin: ReturnType<typeof createClient>): Promise<Empresa[]> {
  const { data, error } = await admin
    .from("app_storage")
    .select("key, value->>codigo, value->>name, value->>cnpj")
    .like("key", "portalGerencial.company.%");
  if (error) throw error;
  return (data || [])
    .filter((row: Record<string, string>) => row.key.startsWith("portalGerencial.company.") && normalizeCodigo(row.codigo))
    .map((row: Record<string, string>) => ({
      id: row.key.slice("portalGerencial.company.".length),
      codigo: normalizeCodigo(row.codigo),
      cnpj: digits(row.cnpj).replace(/^0+$/, ""),
      nome: row.name,
    }));
}

const numerico = (obj: unknown) =>
  !!obj && typeof obj === "object" && !Array.isArray(obj) && Object.values(obj as Record<string, unknown>).every((v) => Number.isFinite(Number(v)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    try {
      const empresas = await empresasDoPortal(admin);
      const { data, error } = await admin.from("gestaoclick_dre").select("company_id, ano, assinatura");
      if (error) throw error;
      const por = new Map<string, Record<string, string>>();
      for (const row of (data || []) as Array<{ company_id: string; ano: number; assinatura: string | null }>) {
        por.set(row.company_id, { ...(por.get(row.company_id) || {}), [String(row.ano)]: row.assinatura || "" });
      }
      return json({ empresas: empresas.map((e) => ({ codigo: e.codigo, cnpj: e.cnpj, nome: e.nome, assinaturas: por.get(e.id) || {} })) });
    } catch (error) {
      return json({ error: (error as Error).message }, 500);
    }
  }

  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo não é um JSON válido." }, 400);
  }

  const empresa = normalizeCodigo(body.empresa);
  const cnpj = digits(body.cnpj);
  const ano = Number(body.ano);
  const dados = body.dados as Record<string, unknown> | undefined;
  if (!/^\d{1,10}$/.test(empresa)) return json({ error: "empresa: código numérico da empresa na Domínio." }, 400);
  if (cnpj.length !== 14 || /^0+$/.test(cnpj)) return json({ error: "cnpj: 14 dígitos." }, 400);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return json({ error: "ano: inteiro entre 2000 e 2100." }, 400);
  const meses = dados?.meses as Record<string, Record<string, unknown>> | undefined;
  if (!meses || typeof meses !== "object" || Array.isArray(meses)) return json({ error: "dados.meses: objeto { '1': {...}, ... }." }, 400);
  for (const [mes, m] of Object.entries(meses)) {
    if (!/^(?:[1-9]|1[0-2])$/.test(mes)) return json({ error: `dados.meses["${mes}"]: mês de 1 a 12.` }, 400);
    if (!Number.isFinite(Number(m?.receita)) || !numerico(m?.pagamentos) || !numerico(m?.recebimentos) || !numerico(m?.vendas)) {
      return json({ error: `dados.meses["${mes}"]: receita numérica e vendas/pagamentos/recebimentos como { nome: valor }.` }, 400);
    }
  }
  if (JSON.stringify(dados).length > 2_000_000) return json({ error: "dados: grande demais." }, 400);

  let empresas: Empresa[];
  try {
    empresas = await empresasDoPortal(admin);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
  const alvo = empresas.find((e) => e.codigo === empresa && e.cnpj === cnpj);
  if (!alvo) return json({ error: `Nenhuma empresa do portal com código ${empresa} e CNPJ ${cnpj}. Nada foi gravado.` }, 409);

  const { error } = await admin.from("gestaoclick_dre").upsert({
    company_id: alvo.id,
    company_codigo: empresa,
    cnpj,
    ano,
    dados,
    assinatura: String(body.assinatura ?? "").slice(0, 80) || null,
    synced_at: new Date().toISOString(),
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, tipo: "gestaoclick-dre", empresa, cnpj, ano, meses: Object.keys(meses).length });
});
