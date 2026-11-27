// Edge Function: interno-contabil
//
// Interno x Contábil (Grupo Concent): o demonstrativo gerencial interno do cliente (o "DRF" do sistema deles) conferido na Central contra a contabilidade
// (Domínio). A Central monta o demonstrativo (grupos do relatório, quanto foi achado na contabilidade, conta de destino e, no caixa, a prova contra o
// movimento de caixa e equivalentes) e manda aqui quando o usuário clica "Enviar pro BI". Fica em public.interno_contabil; o módulo "Interno x Contábil"
// do portal lê de lá.
//
// Autenticação: cabeçalho `x-sync-token` = segredo DOMINIO_SYNC_TOKEN (o mesmo da dominio-sync). verify_jwt = false.
//
// GET  → { empresas: [{ codigo, cnpj, nome, enviados: { "2026-10|caixa": "assinatura" } }] }
// POST → { empresa, cnpj, mes: "AAAA-MM", regime: "caixa"|"competencia", assinatura, dados: { blocos: [...], cascata: {...}, ... } }
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


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    try {
      const empresas = await empresasDoPortal(admin);
      const { data, error } = await admin.from("interno_contabil").select("company_id, mes, regime, assinatura");
      if (error) throw error;
      const por = new Map<string, Record<string, string>>();
      for (const row of (data || []) as Array<{ company_id: string; mes: string; regime: string; assinatura: string | null }>) {
        por.set(row.company_id, { ...(por.get(row.company_id) || {}), [`${row.mes}|${row.regime}`]: row.assinatura || "" });
      }
      return json({ empresas: empresas.map((e) => ({ codigo: e.codigo, cnpj: e.cnpj, nome: e.nome, enviados: por.get(e.id) || {} })) });
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
  const mes = String(body.mes ?? "");
  const regime = String(body.regime ?? "");
  const dados = body.dados as Record<string, unknown> | undefined;
  if (!/^\d{1,10}$/.test(empresa)) return json({ error: "empresa: código numérico da empresa na Domínio." }, 400);
  if (cnpj.length !== 14 || /^0+$/.test(cnpj)) return json({ error: "cnpj: 14 dígitos." }, 400);
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes)) return json({ error: "mes: AAAA-MM." }, 400);
  if (regime !== "caixa" && regime !== "competencia") return json({ error: "regime: caixa ou competencia." }, 400);
  if (!dados || typeof dados !== "object" || Array.isArray(dados) || !Array.isArray((dados as { blocos?: unknown }).blocos)) return json({ error: "dados.blocos: lista dos blocos do demonstrativo." }, 400);
  if (JSON.stringify(dados).length > 2_000_000) return json({ error: "dados: grande demais." }, 400);

  let empresas: Empresa[];
  try {
    empresas = await empresasDoPortal(admin);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
  const alvos = empresas.filter((e) => e.codigo === empresa && e.cnpj === cnpj);
  if (!alvos.length) return json({ error: `Nenhuma empresa do portal com código ${empresa} e CNPJ ${cnpj}. Nada foi gravado.` }, 409);

  const agora = new Date().toISOString();
  const { error } = await admin.from("interno_contabil").upsert(
    alvos.map((alvo) => ({ company_id: alvo.id, company_codigo: empresa, cnpj, mes, regime, dados, assinatura: String(body.assinatura ?? "").slice(0, 80) || null, synced_at: agora })),
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, tipo: "interno-contabil", empresa, cnpj, mes, regime, empresas: alvos.length });
});
