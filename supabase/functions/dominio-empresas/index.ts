// Edge Function: dominio-empresas
//
// Lista das empresas cadastradas na DOMÍNIO (código, razão social, CNPJ, cidade, UF e situação): a Central lê de bethadba.geempre (SOMENTE SELECT) e manda pra cá
// uma vez por dia. Fica em public.dominio_empresas. O cadastro de empresa do portal usa essa lista: digita o código da Domínio e já vêm o nome e o CNPJ (e o CNPJ
// completa o resto); também evita código/CNPJ que não batem com a Domínio (a Central recusa o envio nesse caso, erro 409).
//
// Autenticação: cabeçalho `x-sync-token` = segredo DOMINIO_SYNC_TOKEN (o mesmo da dominio-sync). verify_jwt = false.
//
// GET  → { total, atualizado_em } o que já foi recebido (a Central usa pra saber se precisa mandar).
// POST → { empresas: [{ codigo, nome, razao, cnpj, cidade, uf, situacao }] }   (até 2000 por chamada; a Central manda em lotes)
//        codigo = código numérico na Domínio; cnpj = só dígitos (vazio quando a empresa não tem); situacao = "A" (ativa) ou "I" (inativa).
//        Só acrescenta/atualiza (upsert por código); nunca apaga.
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
const texto = (value: unknown, max: number) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    const { count, error } = await admin.from("dominio_empresas").select("codigo", { count: "exact", head: true });
    if (error) return json({ error: error.message }, 500);
    const { data } = await admin.from("dominio_empresas").select("synced_at").order("synced_at", { ascending: false }).limit(1);
    return json({ total: count ?? 0, atualizado_em: (data?.[0] as { synced_at?: string } | undefined)?.synced_at ?? null });
  }

  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo não é um JSON válido." }, 400);
  }

  const lista = body.empresas;
  if (!Array.isArray(lista) || !lista.length || lista.length > 2000) return json({ error: "empresas: lista de 1 a 2000 empresas." }, 400);
  const agora = new Date().toISOString();
  const linhas = [];
  const vistos = new Set<string>();
  for (let i = 0; i < lista.length; i += 1) {
    const e = lista[i] as Record<string, unknown>;
    const codigo = String(Number(String(e?.codigo ?? "").trim()));
    if (!/^\d{1,10}$/.test(codigo) || codigo === "0") return json({ error: `empresas[${i}].codigo: número da empresa na Domínio.` }, 400);
    if (vistos.has(codigo)) continue; // duplicada no mesmo lote: fica a primeira
    vistos.add(codigo);
    const cnpj = digits(e?.cnpj);
    if (cnpj && (cnpj.length !== 14 || /^0+$/.test(cnpj))) return json({ error: `empresas[${i}].cnpj: 14 dígitos (ou vazio).` }, 400);
    const nome = texto(e?.razao, 200) || texto(e?.nome, 200);
    if (!nome) return json({ error: `empresas[${i}]: sem razão social/nome.` }, 400);
    const situacao = String(e?.situacao ?? "A").trim().toUpperCase() === "I" ? "I" : "A";
    linhas.push({ codigo, nome, cnpj: cnpj || null, cidade: texto(e?.cidade, 80) || null, uf: texto(e?.uf, 2).toUpperCase() || null, situacao, synced_at: agora });
  }

  const { error } = await admin.from("dominio_empresas").upsert(linhas, { onConflict: "codigo" });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, tipo: "empresas", recebidas: linhas.length });
});
