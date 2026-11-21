// Edge Function: revisa-nota
//
// Produtos e clientes do Revisa Nota (conferidor de NF-e para IBS/CBS) — hoje só da Micromedical. O app local do Revisa Nota (escritório) manda a lista de produtos com a
// classificação decidida e a lista de compradores com o perfil confirmado; o módulo "Revisa Nota" (Ferramentas) do portal só LÊ. Fica em public.revisa_nota, uma linha por empresa do
// portal que tem aquela raiz de CNPJ (as filiais de uma empresa recebem a mesma lista) e por tipo ("produtos" | "clientes").
//
// Autenticação: cabeçalho `x-sync-token` = segredo DOMINIO_SYNC_TOKEN (o mesmo da dominio-sync). verify_jwt = false.
//
// GET  → { raizes: [{ cnpj_raiz, empresas: n, assinaturas: { produtos, clientes } }] } as raízes de CNPJ que existem no portal (com a assinatura já recebida), pra quem envia só mandar de
//        novo o que mudou.
// POST → { cnpj_raiz (8 dígitos), tipo: "produtos" | "clientes", assinatura, dados: { ... } }  (dados é livre, mas precisa ser objeto e ter até 3 MB)
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

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

type Empresa = { id: string; cnpj: string };

async function empresasDoPortal(admin: ReturnType<typeof createClient>): Promise<Empresa[]> {
  const { data, error } = await admin.from("app_storage").select("key, value->>cnpj").like("key", "portalGerencial.company.%");
  if (error) throw error;
  return (data || [])
    .filter((row: Record<string, string>) => row.key.startsWith("portalGerencial.company.") && digits(row.cnpj).length === 14)
    .map((row: Record<string, string>) => ({ id: row.key.slice("portalGerencial.company.".length), cnpj: digits(row.cnpj) }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    try {
      const empresas = await empresasDoPortal(admin);
      const { data, error } = await admin.from("revisa_nota").select("company_id, tipo, cnpj_raiz, assinatura");
      if (error) throw error;
      const raizes = new Map<string, { empresas: number; assinaturas: Record<string, string> }>();
      for (const e of empresas) {
        const raiz = e.cnpj.slice(0, 8);
        const atual = raizes.get(raiz) || { empresas: 0, assinaturas: {} };
        atual.empresas += 1;
        raizes.set(raiz, atual);
      }
      for (const row of (data || []) as Array<{ cnpj_raiz: string; tipo: string; assinatura: string | null }>) {
        const atual = raizes.get(row.cnpj_raiz);
        if (atual) atual.assinaturas[row.tipo] = row.assinatura || "";
      }
      return json({ raizes: [...raizes].map(([cnpj_raiz, v]) => ({ cnpj_raiz, ...v })) });
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

  const raiz = digits(body.cnpj_raiz);
  const tipo = String(body.tipo ?? "");
  const dados = body.dados as Record<string, unknown> | undefined;
  if (raiz.length !== 8 || /^0+$/.test(raiz)) return json({ error: "cnpj_raiz: 8 dígitos." }, 400);
  if (tipo !== "produtos" && tipo !== "clientes") return json({ error: 'tipo: "produtos" ou "clientes".' }, 400);
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return json({ error: "dados: objeto." }, 400);
  const lista = (dados as Record<string, unknown>)[tipo];
  if (!Array.isArray(lista)) return json({ error: `dados.${tipo}: lista.` }, 400);
  if (JSON.stringify(dados).length > 3_000_000) return json({ error: "dados: grande demais." }, 400);

  let empresas: Empresa[];
  try {
    empresas = await empresasDoPortal(admin);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
  const alvos = empresas.filter((e) => e.cnpj.startsWith(raiz));
  if (!alvos.length) return json({ error: `Nenhuma empresa do portal com a raiz de CNPJ ${raiz}. Nada foi gravado.` }, 409);

  const agora = new Date().toISOString();
  const assinatura = String(body.assinatura ?? "").slice(0, 80) || null;
  const { error } = await admin.from("revisa_nota").upsert(
    alvos.map((e) => ({ company_id: e.id, tipo, cnpj_raiz: raiz, dados, assinatura, synced_at: agora })),
    { onConflict: "company_id,tipo" }
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, tipo: "revisa-nota", cnpj_raiz: raiz, dado: tipo, empresas: alvos.length, itens: lista.length });
});
