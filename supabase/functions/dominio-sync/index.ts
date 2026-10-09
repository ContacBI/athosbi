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
// ── GET  → { empresas: [{ codigo, codigo_portal, cnpj, nome }],
//            reforma: [{ cnpj, nome }] }
//    `empresas`: as cadastradas no B.I. do AthosBI (código = código da
//    empresa na Domínio, cnpj só dígitos), pra Central saber quais
//    sincronizar e conferir o CNPJ antes de mandar.
//    `reforma`: as empresas cadastradas no módulo Reforma Tributária (com
//    CNPJ) — pra essas a Central manda o resumo fiscal (abaixo), achando a
//    empresa na Domínio pelo CNPJ.
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
//
// ── POST com "tipo": "balancete" → grava UMA parte do balancete da empresa
//    (tabela public.dominio_balancete; o portal aplica por clique, igual aos
//    meses):
//    {
//      "tipo": "balancete",
//      "empresa": "305", "cnpj": "51636275000157",   // CNPJ obrigatório aqui
//      "inicio": "2026-01-01", "fim": "2026-09-30",  // período do balancete
//      "lote": "c2a1…", "parte": 1, "partes": 1,     // até 5000 contas por parte
//      "contas": [{
//        "codigo": "12",                  // código reduzido (codi_cta)
//        "classificacao": "1.1.10.200.2", // MESMA regra dos lançamentos
//        "nome": "SICOOB - COOL GIRLS",
//        "tipo": "A",                     // "S" sintética, "A" analítica
//        "saldo_anterior": 136974.37,     // saldo no dia anterior ao início
//        "debito": 3004629.04, "credito": 3014645.51,  // movimento do período
//        "saldo_atual": 126957.90         // saldo no fim
//      }]
//    }
//    Saldos com sinal: devedor positivo, credor negativo. Cada conta precisa
//    fechar: saldo_anterior + debito - credito = saldo_atual (centavo a
//    centavo), senão o envio é recusado (400) com o nome da conta.
//
// ── POST com "tipo": "fiscal" → resumo das notas fiscais (Escrita Fiscal) de
//    uma empresa da Reforma Tributária, pra simulação por NCM (tabela
//    public.dominio_fiscal; um resumo por CNPJ, o novo substitui o anterior):
//    {
//      "tipo": "fiscal",
//      "cnpj": "07326871000220",        // CNPJ cadastrado na Reforma (GET)
//      "empresas": ["341", "332"],      // códigos na Domínio somados (matriz + filiais)
//      "inicio": "2025-10-01", "fim": "2026-09-30", "meses": 12,
//      "vendas": [{                      // uma linha por NCM (produto) ou código de serviço
//        "ncm": "90213190",              // 8 dígitos; "" em serviço ou produto sem NCM
//        "servico": "",                  // código do serviço (LC 116, ex.: "4.03"); "" em produto
//        "descricao": "PLACA DE TITANIO", "produtos": 12,
//        "valor": 1250000.00,            // vendas do período, líquidas de devolução
//        "valor_pj": 1100000.00,         // parte vendida pra CNPJ
//        "icms": 150000.00, "icms_st": false, "ipi": 0, "iss": 0,
//        "pis_cofins": "normal",         // "normal" | "monofasico" | "zero"
//        "cfops": ["6102", "5102"]
//      }],
//      "compras": [{                     // por tipo + fornecedor; mercadoria/insumo também por NCM
//        "tipo": "mercadoria",           // mercadoria | insumo | uso_consumo | ativo |
//                                        // energia | comunicacao | servico | frete | aluguel | outros
//        "fornecedor": "normal",         // "normal" | "simples" (nota com CSOSN = fornecedor do Simples)
//        "ncm": "90213190", "descricao": "PLACA DE TITANIO",
//        "valor": 400000.00,             // compras do período, sem o IPI, líquidas de devolução
//        "icms": 48000.00,               // ICMS destacado nas notas
//        "icms_creditado": 48000.00,     // quanto desse ICMS a empresa se creditou
//        "ipi": 0, "iss": 0              // IPI destacado; ISS (serviço tomado)
//      }]
//    }
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type Admin = SupabaseClient;

async function portalCompanies(admin: Admin) {
  const { data, error } = await admin.from("app_storage").select("key, value->>codigo, value->>name, value->>cnpj").like("key", "portalGerencial.company.%");
  if (error) throw error;
  return (data || [])
    .filter((row: Record<string, string>) => row.key.startsWith("portalGerencial.company.") && normalizeCodigo(row.codigo))
    // CNPJ zerado (empresas de demonstração) sai vazio: não casa com nada.
    .map((row: Record<string, string>) => ({ codigo: normalizeCodigo(row.codigo), codigo_portal: row.codigo, cnpj: digits(row.cnpj).replace(/^0+$/, ""), nome: row.name }));
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

// Código + CNPJ precisam bater com uma empresa do portal (ver o cabeçalho).
// Devolve a resposta de recusa, ou null se está tudo certo.
async function conferirEmpresa(admin: Admin, empresa: string, cnpj: string): Promise<Response | null> {
  if (cnpj.length !== 14 && cnpj.length !== 11) return json({ error: "cnpj: 14 dígitos (ou 11, se for CPF)." }, 400);
  if (/^0+$/.test(cnpj)) return json({ error: "cnpj zerado não identifica empresa nenhuma." }, 400);
  let empresas;
  try {
    empresas = await portalCompanies(admin);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
  if (!empresas.some((item) => item.codigo === empresa && item.cnpj === cnpj)) {
    return json({ error: `Nenhuma empresa do portal com código ${empresa} e CNPJ ${cnpj} — confira o cadastro no AthosBI. Nada foi gravado.` }, 409);
  }
  return null;
}

const MAX_CONTAS_POR_PARTE = 5000;

type Conta = {
  codigo: string;
  classificacao: string;
  nome: string;
  tipo: "S" | "A";
  saldo_anterior: number;
  debito: number;
  credito: number;
  saldo_atual: number;
};

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validarConta(raw: Record<string, unknown>, index: number): Conta | string {
  const where = `contas[${index}]`;
  const codigo = String(raw?.codigo ?? "").trim();
  if (!/^\d{1,12}$/.test(codigo)) return `${where}.codigo "${codigo}": use o código reduzido da conta (só números)`;
  const classificacao = String(raw?.classificacao ?? "").trim();
  if (!/^\d+(\.\d+)*$/.test(classificacao) || classificacao.length > 64) return `${where}.classificacao "${classificacao}": só dígitos e pontos`;
  const nome = String(raw?.nome ?? "").trim().slice(0, 200);
  if (!nome) return `${where}.nome vazio`;
  const tipo = String(raw?.tipo ?? "").trim().toUpperCase();
  if (tipo !== "S" && tipo !== "A") return `${where}.tipo: "S" (sintética) ou "A" (analítica)`;
  const valores = ["saldo_anterior", "debito", "credito", "saldo_atual"].map((campo) => Number(raw?.[campo] ?? 0));
  if (valores.some((valor) => !Number.isFinite(valor))) return `${where}: saldos e movimento precisam ser números`;
  const [saldoAnterior, debito, credito, saldoAtual] = valores.map(cents);
  if (debito < 0 || credito < 0) return `${where}: débito/crédito do período precisam ser >= 0`;
  // Em centavos inteiros — sem erro de arredondamento de ponto flutuante.
  if (Math.round(saldoAnterior * 100) + Math.round(debito * 100) - Math.round(credito * 100) !== Math.round(saldoAtual * 100)) {
    return `${where} (${classificacao} ${nome}): saldo anterior + débito - crédito não dá o saldo atual`;
  }
  return { codigo: String(Number(codigo)), classificacao, nome, tipo: tipo as "S" | "A", saldo_anterior: saldoAnterior, debito, credito, saldo_atual: saldoAtual };
}

// POST "tipo": "balancete" (ver o cabeçalho). Mesmo esquema de lote/partes
// dos meses: quando o lote completa, os balancetes anteriores da empresa
// são apagados — o portal só enxerga o lote completo mais recente.
async function receberBalancete(admin: Admin, body: Record<string, unknown>) {
  const empresa = normalizeCodigo(body.empresa);
  const cnpj = digits(body.cnpj);
  const inicio = String(body.inicio ?? "");
  const fim = String(body.fim ?? "");
  const lote = String(body.lote ?? "");
  const parte = Number(body.parte);
  const partes = Number(body.partes);
  const lista = body.contas;
  if (!/^\d{1,10}$/.test(empresa)) return json({ error: "empresa: informe o código numérico da empresa na Domínio." }, 400);
  if (!cnpj) return json({ error: "cnpj: obrigatório no balancete." }, 400);
  if (!isDate(inicio) || !isDate(fim) || inicio > fim) return json({ error: "inicio/fim: datas AAAA-MM-DD, com inicio <= fim." }, 400);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(lote)) return json({ error: "lote: 1 a 64 caracteres (letras, números, - ou _)." }, 400);
  if (!Number.isInteger(partes) || partes < 1 || partes > 100) return json({ error: "partes: inteiro entre 1 e 100." }, 400);
  if (!Number.isInteger(parte) || parte < 1 || parte > partes) return json({ error: "parte: inteiro entre 1 e partes." }, 400);
  if (!Array.isArray(lista) || !lista.length) return json({ error: "contas: lista com pelo menos uma conta." }, 400);
  if (lista.length > MAX_CONTAS_POR_PARTE) return json({ error: `contas: no máximo ${MAX_CONTAS_POR_PARTE} por parte — divida em mais partes.` }, 400);
  const recusa = await conferirEmpresa(admin, empresa, cnpj);
  if (recusa) return recusa;

  // Classificação PODE repetir: há plano com contas diferentes no mesmo
  // número (o da 349/350/351 tem 44 — o balancete exportado da Domínio
  // também traz as duas linhas, e o portal soma as duas). O código
  // reduzido, não.
  const contas: Conta[] = [];
  const vistas = new Set<string>();
  for (let i = 0; i < lista.length; i += 1) {
    const result = validarConta(lista[i] as Record<string, unknown>, i);
    if (typeof result === "string") return json({ error: result }, 400);
    if (vistas.has(result.codigo)) return json({ error: `contas[${i}]: código ${result.codigo} repetido.` }, 400);
    vistas.add(result.codigo);
    contas.push(result);
  }

  const { error: upsertError } = await admin.from("dominio_balancete").upsert({
    company_codigo: empresa,
    cnpj,
    lote,
    parte,
    partes,
    inicio,
    fim,
    contas,
    qtd: contas.length,
    synced_at: new Date().toISOString(),
  });
  if (upsertError) return json({ error: upsertError.message }, 500);

  const { count, error: countError } = await admin
    .from("dominio_balancete")
    .select("parte", { count: "exact", head: true })
    .eq("company_codigo", empresa)
    .eq("lote", lote);
  if (countError) return json({ error: countError.message }, 500);
  const completo = (count ?? 0) >= partes;
  if (completo) {
    const { error: cleanupError } = await admin.from("dominio_balancete").delete().eq("company_codigo", empresa).neq("lote", lote);
    if (cleanupError) return json({ error: cleanupError.message }, 500);
  }

  return json({ ok: true, tipo: "balancete", empresa, inicio, fim, lote, parte, partes, recebidas: count ?? 0, completo, qtd: contas.length });
}

// ── Resumo fiscal (Reforma Tributária) ─────────────────────────────────────

const MAX_LINHAS_FISCAL = 5000;
const PIS_COFINS = new Set(["normal", "monofasico", "zero"]);
const TIPOS_COMPRA = new Set(["mercadoria", "insumo", "uso_consumo", "ativo", "energia", "comunicacao", "servico", "frete", "aluguel", "outros"]);

async function reformaCompanies(admin: Admin) {
  const { data, error } = await admin.from("reforma_empresas").select("nome, cnpj").not("cnpj", "is", null);
  if (error) throw error;
  const vistos = new Set<string>();
  return (data || [])
    .map((row: Record<string, string>) => ({ cnpj: digits(row.cnpj), nome: row.nome }))
    .filter((row: { cnpj: string }) => row.cnpj.length === 14 && !vistos.has(row.cnpj) && vistos.add(row.cnpj));
}

const numero = (raw: Record<string, unknown>, campo: string) => Number(raw?.[campo] ?? 0);

function validarVendaFiscal(raw: Record<string, unknown>, index: number) {
  const where = `vendas[${index}]`;
  const ncm = digits(raw?.ncm);
  if (ncm && ncm.length !== 8) return `${where}.ncm "${raw?.ncm}": 8 dígitos (ou "" em serviço)`;
  const servico = String(raw?.servico ?? "").trim().slice(0, 20);
  const valores = ["valor", "valor_pj", "icms", "ipi", "iss"].map((campo) => numero(raw, campo));
  if (valores.some((valor) => !Number.isFinite(valor) || valor < 0)) return `${where}: valores precisam ser números >= 0`;
  const [valor, valorPj, icms, ipi, iss] = valores.map(cents);
  if (valor <= 0) return `${where}: valor precisa ser > 0 (não mande NCM sem venda líquida)`;
  if (valorPj > valor + 0.01) return `${where}: valor_pj maior que o valor`;
  const pisCofins = String(raw?.pis_cofins ?? "normal");
  if (!PIS_COFINS.has(pisCofins)) return `${where}.pis_cofins: "normal", "monofasico" ou "zero"`;
  const cfops = Array.isArray(raw?.cfops) ? (raw.cfops as unknown[]).map((cfop) => digits(cfop)).filter((cfop) => cfop.length === 4).slice(0, 10) : [];
  return {
    ncm,
    servico,
    descricao: String(raw?.descricao ?? "").trim().slice(0, 200),
    produtos: Math.max(0, Math.round(numero(raw, "produtos")) || 0),
    valor,
    valor_pj: Math.min(valorPj, valor),
    icms,
    icms_st: Boolean(raw?.icms_st),
    ipi,
    iss,
    pis_cofins: pisCofins,
    cfops,
  };
}

function validarCompraFiscal(raw: Record<string, unknown>, index: number) {
  const where = `compras[${index}]`;
  const tipo = String(raw?.tipo ?? "");
  if (!TIPOS_COMPRA.has(tipo)) return `${where}.tipo "${tipo}": ${[...TIPOS_COMPRA].join(", ")}`;
  const fornecedor = String(raw?.fornecedor ?? "normal");
  if (fornecedor !== "normal" && fornecedor !== "simples") return `${where}.fornecedor: "normal" ou "simples"`;
  const ncm = digits(raw?.ncm);
  if (ncm && ncm.length !== 8) return `${where}.ncm "${raw?.ncm}": 8 dígitos (ou "")`;
  const valores = ["valor", "icms", "icms_creditado", "ipi", "iss"].map((campo) => numero(raw, campo));
  if (valores.some((valor) => !Number.isFinite(valor) || valor < 0)) return `${where}: valores precisam ser números >= 0`;
  const [valor, icms, icmsCreditado, ipi, iss] = valores.map(cents);
  if (valor <= 0) return `${where}: valor precisa ser > 0`;
  if (icmsCreditado > icms + 0.01) return `${where}: icms_creditado maior que o ICMS destacado`;
  return { tipo, fornecedor, ncm, descricao: String(raw?.descricao ?? "").trim().slice(0, 200), valor, icms, icms_creditado: Math.min(icmsCreditado, icms), ipi, iss };
}

// POST "tipo": "fiscal" (ver o cabeçalho). CNPJ é a identidade: precisa ser
// de uma empresa cadastrada na Reforma Tributária ou no B.I. do portal.
async function receberFiscal(admin: Admin, body: Record<string, unknown>) {
  const cnpj = digits(body.cnpj);
  const inicio = String(body.inicio ?? "");
  const fim = String(body.fim ?? "");
  const meses = Number(body.meses);
  const empresas = Array.isArray(body.empresas) ? (body.empresas as unknown[]).map(normalizeCodigo) : [];
  if (cnpj.length !== 14 || /^0+$/.test(cnpj)) return json({ error: "cnpj: 14 dígitos." }, 400);
  if (!empresas.length || empresas.length > 50 || empresas.some((codigo) => !/^\d{1,10}$/.test(codigo))) return json({ error: "empresas: lista (1 a 50) com os códigos numéricos na Domínio que foram somados." }, 400);
  if (!isDate(inicio) || !isDate(fim) || inicio > fim) return json({ error: "inicio/fim: datas AAAA-MM-DD, com inicio <= fim." }, 400);
  if (!Number.isInteger(meses) || meses < 1 || meses > 24) return json({ error: "meses: inteiro entre 1 e 24 (meses do período)." }, 400);
  if (!Array.isArray(body.vendas) || !Array.isArray(body.compras)) return json({ error: "vendas e compras: listas (podem ser vazias)." }, 400);
  if (body.vendas.length > MAX_LINHAS_FISCAL || body.compras.length > MAX_LINHAS_FISCAL) return json({ error: `vendas/compras: no máximo ${MAX_LINHAS_FISCAL} linhas cada.` }, 400);

  try {
    const [reforma, portal] = await Promise.all([reformaCompanies(admin), portalCompanies(admin)]);
    if (!reforma.some((item) => item.cnpj === cnpj) && !portal.some((item) => item.cnpj === cnpj)) {
      return json({ error: `CNPJ ${cnpj} não está cadastrado no AthosBI (nem na Reforma, nem no B.I.). Nada foi gravado.` }, 409);
    }
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }

  const vendas = [];
  for (let i = 0; i < body.vendas.length; i += 1) {
    const result = validarVendaFiscal(body.vendas[i] as Record<string, unknown>, i);
    if (typeof result === "string") return json({ error: result }, 400);
    vendas.push(result);
  }
  const compras = [];
  for (let i = 0; i < body.compras.length; i += 1) {
    const result = validarCompraFiscal(body.compras[i] as Record<string, unknown>, i);
    if (typeof result === "string") return json({ error: result }, 400);
    compras.push(result);
  }
  const totalVendas = cents(vendas.reduce((soma, item) => soma + item.valor, 0));
  const totalCompras = cents(compras.reduce((soma, item) => soma + item.valor, 0));

  const { error } = await admin.from("dominio_fiscal").upsert({
    cnpj,
    empresas,
    inicio,
    fim,
    meses,
    vendas,
    compras,
    total_vendas: totalVendas,
    total_compras: totalCompras,
    synced_at: new Date().toISOString(),
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, tipo: "fiscal", cnpj, inicio, fim, meses, vendas: vendas.length, compras: compras.length, total_vendas: totalVendas, total_compras: totalCompras });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (!SYNC_TOKEN) return json({ error: "DOMINIO_SYNC_TOKEN não configurado no Supabase." }, 500);
  if (!sameToken(req.headers.get("x-sync-token") || "", SYNC_TOKEN)) return json({ error: "Token inválido." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (req.method === "GET") {
    try {
      // A lista da Reforma nunca derruba a do B.I. (a sincronização dos
      // lançamentos depende só de `empresas`).
      const [empresas, reforma] = await Promise.all([
        portalCompanies(admin),
        reformaCompanies(admin).catch((error) => {
          console.error("Falha ao listar as empresas da Reforma:", error);
          return [];
        }),
      ]);
      return json({ empresas, reforma });
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

  if (body.tipo === "balancete") return receberBalancete(admin, body);
  if (body.tipo === "fiscal") return receberFiscal(admin, body);

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
    const recusa = await conferirEmpresa(admin, empresa, cnpj);
    if (recusa) return recusa;
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
