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
// POST → { acao: "pedidos" | "observar" | "atualizar", cnpj_raiz, ... } = pedidos do cliente (lê, responde na conversa, muda a situação);
// POST → { cnpj_raiz (8 dígitos), tipo: "produtos" | "clientes", assinatura, dados: { ... } }  (dados é livre, mas precisa ser objeto e ter até 4 MB); tipo também pode ser "resumos" (lista em dados.produtos) ou "lei" (lista em dados.anexos)
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

// tipo → campo de `dados` que tem a lista: "resumos" (somas de vendas e compras por produto) e "lei" (base da LC 214: anexos com os itens)
const TIPOS: Record<string, string> = { produtos: "produtos", clientes: "clientes", resumos: "produtos", lei: "anexos" };

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

  // Pedidos do cliente (etapa 3): o app do escritório lê os pedidos e as conversas, responde e muda a situação. Sempre pela raiz do CNPJ (as filiais do portal compartilham os pedidos).
  const acao = String(body.acao ?? "");
  if (acao) {
    const raizPedidos = digits(body.cnpj_raiz);
    if (raizPedidos.length !== 8 || /^0+$/.test(raizPedidos)) return json({ error: "cnpj_raiz: 8 dígitos." }, 400);
    try {
      if (acao === "pedidos") {
        const { data: pedidos, error: e1 } = await admin.from("revisa_nota_pedidos").select("id, company_id, tipo, alvo, descricao, ncm, unidade, proposta, status, resposta, criado_por, criado_em, atualizado_em").eq("cnpj_raiz", raizPedidos).order("criado_em", { ascending: false }).limit(500);
        if (e1) throw e1;
        const ids = (pedidos || []).map((p: { id: string }) => p.id);
        const { data: obs, error: e2 } = ids.length ? await admin.from("revisa_nota_observacoes").select("id, pedido_id, autor, autor_nome, texto, criado_em").in("pedido_id", ids).order("criado_em", { ascending: true }).limit(5000) : { data: [], error: null };
        if (e2) throw e2;
        const porPedido = new Map<string, unknown[]>();
        for (const o of (obs || []) as Array<{ pedido_id: string }>) porPedido.set(o.pedido_id, [...(porPedido.get(o.pedido_id) || []), o]);
        return json({ pedidos: (pedidos || []).map((p: { id: string }) => ({ ...p, observacoes: porPedido.get(p.id) || [] })) });
      }
      const pedidoId = String(body.pedido_id ?? "");
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(pedidoId)) return json({ error: "pedido_id inválido." }, 400);
      const { data: pedido, error: e3 } = await admin.from("revisa_nota_pedidos").select("id, company_id, cnpj_raiz").eq("id", pedidoId).maybeSingle();
      if (e3) throw e3;
      if (!pedido || pedido.cnpj_raiz !== raizPedidos) return json({ error: "Pedido não encontrado." }, 404);
      const agora = new Date().toISOString();
      if (acao === "observar") {
        const texto = String(body.texto ?? "").trim();
        if (texto.length < 1 || texto.length > 1000) return json({ error: "Escreva de 1 a 1000 caracteres." }, 400);
        const nome = String(body.autor_nome ?? "").trim().slice(0, 80);
        const { error } = await admin.from("revisa_nota_observacoes").insert({ pedido_id: pedidoId, company_id: pedido.company_id, autor: "escritorio", autor_nome: nome, texto });
        if (error) throw error;
        await admin.from("revisa_nota_pedidos").update({ atualizado_em: agora }).eq("id", pedidoId);
        return json({ ok: true });
      }
      if (acao === "atualizar") {
        const status = String(body.status ?? "");
        if (!["enviado", "em_analise", "cadastrado", "recusado"].includes(status)) return json({ error: "status inválido." }, 400);
        const resposta = body.resposta == null ? null : String(body.resposta).trim().slice(0, 500);
        const { error } = await admin.from("revisa_nota_pedidos").update({ status, ...(resposta !== null ? { resposta } : {}), atualizado_em: agora }).eq("id", pedidoId);
        if (error) throw error;
        return json({ ok: true });
      }
      return json({ error: "acao inválida." }, 400);
    } catch (error) {
      return json({ error: (error as Error).message || "Falha." }, 500);
    }
  }

  const raiz = digits(body.cnpj_raiz);
  const tipo = String(body.tipo ?? "");
  const dados = body.dados as Record<string, unknown> | undefined;
  if (raiz.length !== 8 || /^0+$/.test(raiz)) return json({ error: "cnpj_raiz: 8 dígitos." }, 400);
  const campoDaLista = TIPOS[tipo];
  if (!campoDaLista) return json({ error: 'tipo: "produtos", "clientes", "resumos" ou "lei".' }, 400);
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return json({ error: "dados: objeto." }, 400);
  const lista = (dados as Record<string, unknown>)[campoDaLista];
  if (!Array.isArray(lista)) return json({ error: `dados.${campoDaLista}: lista.` }, 400);
  if (JSON.stringify(dados).length > 4_000_000) return json({ error: "dados: grande demais." }, 400);

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
