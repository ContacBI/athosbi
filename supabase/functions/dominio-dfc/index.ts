// Edge Function: dominio-dfc
//
// Modelo de DFC das empresas marcadas como "instituto" no portal: a Central lê
// da Domínio a estrutura (CTGRUPOSDFC_DIRETO) e as contas ligadas a cada
// grupo (CTGRUPOSDFC_DIRETO_CONTAS) e manda pra cá; fica em
// public.dominio_dfc_modelo e o portal copia pra empresa (a DFC passa a ter a
// mesma estrutura e as mesmas contas da Domínio).
//
// Autenticação: cabeçalho `x-sync-token` = segredo DOMINIO_SYNC_TOKEN (o mesmo
// da dominio-sync). Publicada com verify_jwt = false.
//
// GET  → { empresas: [{ codigo, cnpj, nome, assinatura }] } as empresas do
//        portal marcadas como instituto (assinatura = a do modelo já recebido,
//        pra a Central só mandar de novo se mudou).
// POST → { empresa, cnpj, assinatura, estrutura: [{ codigo, ordem, atividade,
//        descricao, natureza }], contas: [{ grupo, codigo, classificacao }] }
//        natureza: "V" título, "S" sintética (subtotal), "A" analítica;
//        atividade: 1 operacional, 2 investimento, 3 financiamento.
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

async function institutos(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("app_storage")
    .select("key, value->>codigo, value->>name, value->>cnpj, value->>dfcModelo")
    .like("key", "portalGerencial.company.%");
  if (error) throw error;
  return (data || [])
    .filter((row: Record<string, string>) => row.key.startsWith("portalGerencial.company.") && row.dfcModelo === "instituto" && normalizeCodigo(row.codigo))
    .map((row: Record<string, string>) => ({ codigo: normalizeCodigo(row.codigo), cnpj: digits(row.cnpj), nome: row.name }));
}

const NATUREZAS = new Set(["V", "S", "A"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    try {
      const lista = await institutos(admin);
      const { data, error } = await admin.from("dominio_dfc_modelo").select("company_codigo, cnpj, assinatura");
      if (error) throw error;
      const assinaturas = new Map((data || []).map((row: Record<string, string>) => [`${row.company_codigo}|${row.cnpj}`, row.assinatura || ""]));
      return json({ empresas: lista.map((item) => ({ ...item, assinatura: assinaturas.get(`${item.codigo}|${item.cnpj}`) || "" })) });
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
  if (!/^\d{1,10}$/.test(empresa)) return json({ error: "empresa: código numérico da empresa na Domínio." }, 400);
  if (cnpj.length !== 14 || /^0+$/.test(cnpj)) return json({ error: "cnpj: 14 dígitos." }, 400);
  if (!Array.isArray(body.estrutura) || !body.estrutura.length || body.estrutura.length > 400) return json({ error: "estrutura: lista de 1 a 400 linhas." }, 400);
  if (!Array.isArray(body.contas) || body.contas.length > 20000) return json({ error: "contas: lista de até 20000 ligações." }, 400);

  let lista;
  try {
    lista = await institutos(admin);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
  if (!lista.some((item) => item.codigo === empresa && item.cnpj === cnpj)) {
    return json({ error: `Nenhuma empresa instituto no portal com código ${empresa} e CNPJ ${cnpj}. Nada foi gravado.` }, 409);
  }

  const codigos = new Set<number>();
  const estrutura = [];
  for (let i = 0; i < body.estrutura.length; i += 1) {
    const raw = body.estrutura[i] as Record<string, unknown>;
    const codigo = Number(raw?.codigo);
    const ordem = Number(raw?.ordem);
    const atividade = Number(raw?.atividade);
    const natureza = String(raw?.natureza ?? "").trim().toUpperCase();
    const descricao = String(raw?.descricao ?? "").trim().slice(0, 200);
    if (!Number.isInteger(codigo) || !Number.isInteger(ordem) || ![1, 2, 3].includes(atividade) || !NATUREZAS.has(natureza) || !descricao) {
      return json({ error: `estrutura[${i}]: codigo/ordem inteiros, atividade 1-3, natureza V/S/A e descricao.` }, 400);
    }
    if (codigos.has(codigo)) return json({ error: `estrutura[${i}]: código ${codigo} repetido.` }, 400);
    codigos.add(codigo);
    estrutura.push({ codigo, ordem, atividade, natureza, descricao });
  }

  const contas = [];
  for (let i = 0; i < body.contas.length; i += 1) {
    const raw = body.contas[i] as Record<string, unknown>;
    const grupo = Number(raw?.grupo);
    const codigo = String(raw?.codigo ?? "").trim();
    const classificacao = String(raw?.classificacao ?? "").trim();
    if (!codigos.has(grupo) || !/^\d{1,12}$/.test(codigo) || !/^\d+(\.\d+)*$/.test(classificacao)) {
      return json({ error: `contas[${i}]: grupo existente na estrutura, codigo numérico e classificacao só com dígitos e pontos.` }, 400);
    }
    contas.push({ grupo, codigo, classificacao });
  }

  const { error } = await admin.from("dominio_dfc_modelo").upsert({
    company_codigo: empresa,
    cnpj,
    metodo: "D",
    estrutura,
    contas,
    qtd_contas: contas.length,
    assinatura: String(body.assinatura ?? "").slice(0, 80) || null,
    synced_at: new Date().toISOString(),
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, tipo: "dfc_modelo", empresa, cnpj, linhas: estrutura.length, contas: contas.length });
});
