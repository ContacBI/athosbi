// Edge Function: dominio-sync
//
// Recebe os lançamentos lidos DIRETO do banco da Domínio pela Central (o
// app que roda no computador do escritório, com acesso à rede da Domínio)
// e guarda na tabela public.dominio_sync — uma área de espera. Nada aqui
// toca o razão do portal: quem leva esses lançamentos pro razão é a tela
// Dados do AthosBI, quando alguém clica em "Atualizar com a Domínio" (ver
// src/lib/dominioSync.js). Assim a Central nunca consegue corromper o
// razão, e todas as travas de gravação do portal continuam valendo.
//
// Autenticação: cabeçalho `x-sync-token` igual ao segredo
// DOMINIO_SYNC_TOKEN (Edge Functions > Secrets no painel do Supabase). A
// Central não tem login de usuário — por isso esta função é publicada com
// verify_jwt = false e confere o token ela mesma.
//
// ── GET  → { empresas: [{ codigo, codigo_portal, cnpj, nome }] }
//    Empresas cadastradas no AthosBI (código = código da empresa na
//    Domínio, cnpj só dígitos), pra Central saber quais sincronizar e
//    conferir o CNPJ antes de mandar.
//
// ── POST → grava UMA parte de UM mês de UMA empresa:
//    {
//      "empresa": "305",              // código da empresa na Domínio
//      "cnpj": "51636275000157",      // CNPJ da empresa NA DOMÍNIO (só dígitos)
//      "competencia": "2026-07",      // mês, AAAA-MM
//      "lote": "b1f0…",               // id único desta sincronização do mês
//      "parte": 1, "partes": 3,       // mês dividido em partes de até 5000
//      "lancamentos": [{
//        "data": "2026-07-15",        // dentro da competência
//        "classificacao": "1.1.10.300.1",  // IGUAL à do diário exportado
//        "descricao_conta": "CARTÃO - VINDI",
//        "historico": "Taxas de Cartão",
//        "debito": 0, "credito": 3.08,     // um dos dois > 0
//        "origem": "125013"           // opcional: nº do lançamento na Domínio
//      }]
//    }
//    Cada lançamento é UMA linha do diário (uma conta, débito OU crédito) —
//    um lançamento da Domínio com conta débito e conta crédito vira duas.
//    Um mês sem lançamentos na Domínio: partes = 1 e lancamentos = [].
//    Quando todas as partes de um lote chegam, os lotes anteriores daquele
//    mês são apagados — o portal só enxerga lote completo.
//
//    CNPJ: o código sozinho é ambíguo ("001" e "01" no portal viram o mesmo
//    "1"), então o portal só mostra um mês pra empresa com o MESMO CNPJ, e
//    esta função recusa (409) um envio cujo código+CNPJ não bate com nenhuma
//    empresa do portal. Envio sem CNPJ ainda é aceito (compatibilidade), mas
//    fica invisível no portal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_TOKEN = Deno.env.get("DOMINIO_SYNC_TOKEN") || "";

const MAX_LINHAS_POR_PARTE = 5000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-sync-token, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// Comparação em tempo constante — não deixa o tempo de resposta vazar
// quantos caracteres do token estavam certos.
function sameToken(given: string, expected: string) {
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// "0341" e 341 são a mesma empresa — a Domínio guarda o código como número,
// o cadastro do portal às vezes com zero à esquerda.
function normalizeCodigo(value: unknown) {
  return String(value ?? "").trim().replace(/^0+(?=\d)/, "");
}

const cents = (value: number) => Math.round(value * 100) / 100;
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

// Assinatura do conteúdo — IGUAL à de src/lib/dominioSync.js (o portal
// calcula a mesma coisa pro razão dele e compara): duas somas (mod 2^32) de
// hashes de cada linha, uma FNV-1a e uma djb2. Soma não depende da ordem,
// então a assinatura do mês é a soma das assinaturas das partes. Qualquer
// mudança em data, conta, valor ou histórico muda a assinatura — é o que
// faz uma reclassificação (mesmo valor, outra conta) aparecer pendente.
function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
function djb2(text: string) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = (Math.imul(hash, 33) + text.charCodeAt(i)) | 0;
  return hash >>> 0;
}
function assinatura(linhas: Lancamento[]) {
  let a = 0;
  let b = 0;
  for (const linha of linhas) {
    const texto = `${linha.data}|${linha.classificacao}|${Math.round(linha.debito * 100)}|${Math.round(linha.credito * 100)}|${linha.historico}`;
    a = (a + fnv1a(texto)) >>> 0;
    b = (b + djb2(texto)) >>> 0;
  }
  return `${a.toString(16)}.${b.toString(16)}`;
}

async function portalCompanies(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin.from("app_storage").select("key, value->>codigo, value->>name, value->>cnpj").like("key", "portalGerencial.company.%");
  if (error) throw error;
  return (data || [])
    .filter((row: Record<string, string>) => row.key.startsWith("portalGerencial.company.") && normalizeCodigo(row.codigo))
    .map((row: Record<string, string>) => ({ codigo: normalizeCodigo(row.codigo), codigo_portal: row.codigo, cnpj: digits(row.cnpj), nome: row.name }));
}

type Lancamento = {
  data: string;
  classificacao: string;
  descricao_conta: string;
  historico: string;
  debito: number;
  credito: number;
  origem?: string;
};

function validarLancamento(raw: Record<string, unknown>, competencia: string, index: number): Lancamento | string {
  const where = `lancamentos[${index}]`;
  const data = String(raw?.data ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data.slice(0, 7) !== competencia) return `${where}.data "${data}" fora da competência ${competencia}`;
  const classificacao = String(raw?.classificacao ?? "").trim();
  if (!classificacao || classificacao.length > 64) return `${where}.classificacao vazia ou longa demais`;
  const debito = Number(raw?.debito ?? 0);
  const credito = Number(raw?.credito ?? 0);
  if (!Number.isFinite(debito) || !Number.isFinite(credito) || debito < 0 || credito < 0) return `${where}: débito/crédito precisam ser números >= 0`;
  if (debito === 0 && credito === 0) return `${where}: débito e crédito zerados`;
  return {
    data,
    classificacao,
    descricao_conta: String(raw?.descricao_conta ?? "").trim().slice(0, 200),
    historico: String(raw?.historico ?? "").trim().slice(0, 1000),
    debito: cents(debito),
    credito: cents(credito),
    ...(raw?.origem !== undefined && raw?.origem !== null ? { origem: String(raw.origem).slice(0, 40) } : {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    try {
      return json({ empresas: await portalCompanies(admin) });
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
  const cnpj = body.cnpj === undefined || body.cnpj === null || body.cnpj === "" ? null : digits(body.cnpj);
  const competencia = String(body.competencia ?? "");
  const lote = String(body.lote ?? "");
  const parte = Number(body.parte);
  const partes = Number(body.partes);
  const lista = body.lancamentos;
  if (!/^\d{1,10}$/.test(empresa)) return json({ error: "empresa: informe o código numérico da empresa na Domínio." }, 400);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return json({ error: "competencia: use AAAA-MM." }, 400);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(lote)) return json({ error: "lote: 1 a 64 caracteres (letras, números, - ou _)." }, 400);
  if (!Number.isInteger(partes) || partes < 1 || partes > 1000) return json({ error: "partes: inteiro entre 1 e 1000." }, 400);
  if (!Number.isInteger(parte) || parte < 1 || parte > partes) return json({ error: "parte: inteiro entre 1 e partes." }, 400);
  if (!Array.isArray(lista)) return json({ error: "lancamentos: precisa ser uma lista." }, 400);
  if (lista.length > MAX_LINHAS_POR_PARTE) return json({ error: `lancamentos: no máximo ${MAX_LINHAS_POR_PARTE} por parte — divida o mês em mais partes.` }, 400);
  if (lista.length === 0 && partes !== 1) return json({ error: "Mês vazio: mande partes = 1 e lancamentos = []." }, 400);
  if (cnpj !== null) {
    if (cnpj.length !== 14 && cnpj.length !== 11) return json({ error: "cnpj: 14 dígitos (ou 11, se for CPF)." }, 400);
    let empresas;
    try {
      empresas = await portalCompanies(admin);
    } catch (error) {
      return json({ error: (error as Error).message }, 500);
    }
    if (!empresas.some((item) => item.codigo === empresa && item.cnpj === cnpj)) {
      return json({ error: `Nenhuma empresa do portal com código ${empresa} e CNPJ ${cnpj} — confira o cadastro no AthosBI. Nada foi gravado.` }, 409);
    }
  }

  const lancamentos: Lancamento[] = [];
  for (let i = 0; i < lista.length; i += 1) {
    const result = validarLancamento(lista[i] as Record<string, unknown>, competencia, i);
    if (typeof result === "string") return json({ error: result }, 400);
    lancamentos.push(result);
  }
  const totalDebito = cents(lancamentos.reduce((sum, item) => sum + item.debito, 0));
  const totalCredito = cents(lancamentos.reduce((sum, item) => sum + item.credito, 0));

  const { error: upsertError } = await admin.from("dominio_sync").upsert({
    company_codigo: empresa,
    cnpj,
    competencia,
    lote,
    parte,
    partes,
    lancamentos,
    assinatura: assinatura(lancamentos),
    qtd: lancamentos.length,
    total_debito: totalDebito,
    total_credito: totalCredito,
    synced_at: new Date().toISOString(),
  });
  if (upsertError) return json({ error: upsertError.message }, 500);

  // Lote completo? Então ele vira "o" mês dessa empresa: apaga os lotes
  // anteriores. Se faltar parte, o lote anterior (completo) continua sendo
  // o que o portal enxerga até esse terminar.
  const { count, error: countError } = await admin
    .from("dominio_sync")
    .select("parte", { count: "exact", head: true })
    .eq("company_codigo", empresa)
    .eq("competencia", competencia)
    .eq("lote", lote);
  if (countError) return json({ error: countError.message }, 500);
  const completo = (count ?? 0) >= partes;
  if (completo) {
    const { error: cleanupError } = await admin
      .from("dominio_sync")
      .delete()
      .eq("company_codigo", empresa)
      .eq("competencia", competencia)
      .neq("lote", lote);
    if (cleanupError) return json({ error: cleanupError.message }, 500);
  }

  return json({ ok: true, empresa, competencia, lote, parte, partes, recebidas: count ?? 0, completo, qtd: lancamentos.length, total_debito: totalDebito, total_credito: totalCredito });
});
