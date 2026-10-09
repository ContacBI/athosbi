import { supabase } from "./supabaseClient.js";
import { remapJournal } from "./companies.js";

// Integração com a Domínio sem arquivo: a Central (no computador do
// escritório, com acesso ao banco da Domínio) lê os lançamentos e manda pra
// Edge Function dominio-sync (supabase/functions/dominio-sync), que guarda
// tudo em public.dominio_sync — uma ÁREA DE ESPERA, por empresa e mês. Nada
// entra no razão sozinho: a tela Dados mostra o que chegou e alguém clica em
// "Atualizar com a Domínio", que passa pelo mesmo attachJournalMonths da
// importação de diário (troca só os meses escolhidos, todas as travas de
// gravação valendo). Ver RelatoriosMensais.jsx.

// Mesmo critério da Edge Function: "0341" e 341 são a mesma empresa (a
// Domínio guarda o código como número).
export function dominioCodigo(company) {
  return String(company?.codigo ?? "").trim().replace(/^0+(?=\d)/, "");
}

// O código sozinho é ambíguo — "001" (MODELO 1) e "01" (TERMOPLEX) viram o
// mesmo "1" — então um mês da Domínio só aparece pra empresa do portal com
// o MESMO CNPJ (a Central manda o CNPJ cadastrado na Domínio). CNPJ vazio
// ou zerado (empresas de demonstração) nunca casa com nada.
export function dominioCnpj(company) {
  const cnpj = String(company?.cnpj ?? "").replace(/\D/g, "");
  return /^0*$/.test(cnpj) ? "" : cnpj;
}

const READ_TIMEOUT_MS = 90000;
const timeoutSignal = () => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined);

// Resumo do que chegou da Domínio pra essa empresa — um item por mês, só
// de lote COMPLETO (todas as partes recebidas). Lê só as colunas leves; os
// lançamentos em si só são baixados em fetchDominioEntries, na hora de
// aplicar.
export async function fetchDominioMonths(codigo, cnpj) {
  if (!codigo || !cnpj) return [];
  const { data, error } = await supabase
    .from("dominio_sync")
    .select("competencia, lote, parte, partes, qtd, total_debito, total_credito, assinatura, synced_at")
    .eq("company_codigo", codigo)
    .eq("cnpj", cnpj)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const lotes = new Map();
  (data || []).forEach((row) => {
    const id = `${row.competencia}|${row.lote}`;
    const lote = lotes.get(id) || { competencia: row.competencia, lote: row.lote, partes: row.partes, recebidas: 0, qtd: 0, totalDebito: 0, totalCredito: 0, sigA: 0, sigB: 0, temAssinatura: true, syncedAt: "" };
    lote.recebidas += 1;
    // Assinatura do mês = soma das assinaturas das partes (ver assinatura()
    // na Edge Function). Parte enviada antes de existir assinatura deixa o
    // mês sem ela — aí a comparação cai pra quantidade + totais.
    const [a, b] = String(row.assinatura || "").split(".");
    if (row.assinatura && a && b) {
      lote.sigA = (lote.sigA + parseInt(a, 16)) >>> 0;
      lote.sigB = (lote.sigB + parseInt(b, 16)) >>> 0;
    } else {
      lote.temAssinatura = false;
    }
    lote.qtd += Number(row.qtd || 0);
    lote.totalDebito += Number(row.total_debito || 0);
    lote.totalCredito += Number(row.total_credito || 0);
    if (row.synced_at > lote.syncedAt) lote.syncedAt = row.synced_at;
    lotes.set(id, lote);
  });
  // Mais de um lote completo pro mesmo mês só existe por um instante (a
  // Edge Function apaga o anterior assim que o novo completa) — fica com o
  // mais recente.
  const porMes = new Map();
  [...lotes.values()]
    .filter((lote) => lote.recebidas >= lote.partes)
    .forEach((lote) => {
      const atual = porMes.get(lote.competencia);
      if (!atual || lote.syncedAt > atual.syncedAt) porMes.set(lote.competencia, lote);
    });
  return [...porMes.values()].sort((a, b) => a.competencia.localeCompare(b.competencia));
}

const cents = (value) => Math.round(Number(value || 0) * 100);

// Mesma assinatura da Edge Function dominio-sync (supabase/functions/
// dominio-sync/index.ts) — mudar uma sem a outra deixa TODO mês "pendente".
function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
function djb2(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = (Math.imul(hash, 33) + text.charCodeAt(i)) | 0;
  return hash >>> 0;
}
// Mesma normalização que a Edge Function aplica antes de guardar (trim,
// histórico até 1000 caracteres, valores em centavos).
function lineText(entry) {
  const classificacao = String(entry.classificacao ?? "").trim();
  const historico = String(entry.historico ?? "").trim().slice(0, 1000);
  return `${String(entry.data || "").slice(0, 10)}|${classificacao}|${cents(entry.debito)}|${cents(entry.credito)}|${historico}`;
}

// Resumo do razão do portal por mês (quantidade, totais e assinatura) —
// calculado UMA vez por razão (useDominioSync memoriza pela referência).
export function journalMonthStats(journal) {
  const stats = new Map();
  (journal || []).forEach((entry) => {
    const month = String(entry.data || "").slice(0, 7);
    const item = stats.get(month) || { qtd: 0, debito: 0, credito: 0, sigA: 0, sigB: 0 };
    const text = lineText(entry);
    item.qtd += 1;
    item.debito += cents(entry.debito);
    item.credito += cents(entry.credito);
    item.sigA = (item.sigA + fnv1a(text)) >>> 0;
    item.sigB = (item.sigB + djb2(text)) >>> 0;
    stats.set(month, item);
  });
  return stats;
}

// Compara o mês da Domínio com o razão do portal:
//   "igual"    — mesma assinatura (data, conta, valor e histórico de cada
//                linha batem); mês antigo sem assinatura: mesma quantidade e
//                mesmos totais;
//   "novo"     — o portal não tem nada nesse mês;
//   "pendente" — qualquer diferença: lançamento novo/excluído, valor,
//                reclassificação de conta, histórico editado;
//   "vazio"    — vazio na Domínio com lançamentos no portal (nunca aplicado
//                sozinho: esvaziar um mês inteiro fica pra exclusão manual).
export const isDominioPending = (status) => status === "novo" || status === "pendente";

export function compareMonth(dominioMonth, stats) {
  const portal = stats.get(dominioMonth.competencia);
  if (!dominioMonth.qtd) return portal ? "vazio" : "igual";
  if (!portal) return "novo";
  if (dominioMonth.temAssinatura) {
    return portal.sigA === dominioMonth.sigA && portal.sigB === dominioMonth.sigB && portal.qtd === dominioMonth.qtd ? "igual" : "pendente";
  }
  const same = portal.qtd === dominioMonth.qtd && portal.debito === cents(dominioMonth.totalDebito) && portal.credito === cents(dominioMonth.totalCredito);
  return same ? "igual" : "pendente";
}

// Baixa os lançamentos dos meses escolhidos e devolve no formato do razão
// do portal (o mesmo que importDiario produz), já carimbados com o De/Para
// atual da empresa.
export async function fetchDominioEntries(codigo, cnpj, months, mappings) {
  const entries = [];
  for (const month of months) {
    const { data, error } = await supabase
      .from("dominio_sync")
      .select("parte, lancamentos")
      .eq("company_codigo", codigo)
      .eq("cnpj", cnpj)
      .eq("competencia", month.competencia)
      .eq("lote", month.lote)
      .order("parte")
      .abortSignal(timeoutSignal());
    if (error) throw error;
    // O lote pode ter sido trocado por um mais novo entre o resumo e agora
    // (a Central sincronizou de novo no meio) — aí faltam partes; melhor
    // pedir pra recarregar do que aplicar um mês pela metade.
    if ((data || []).length !== month.partes) {
      throw new Error(`O mês ${month.competencia} mudou na Domínio enquanto carregava — recarregue a página e tente de novo.`);
    }
    const origem = `Domínio (sincronizado em ${new Date(month.syncedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })})`;
    data.forEach((row) => {
      (row.lancamentos || []).forEach((item, index) => {
        const debito = Number(item.debito || 0);
        const credito = Number(item.credito || 0);
        entries.push({
          linha_origem: String(item.origem ?? `${row.parte}.${index + 1}`),
          data: item.data,
          classificacao: item.classificacao,
          descricao_conta: item.descricao_conta || "",
          historico: item.historico || "",
          debito,
          credito,
          valor_liquido: debito - credito,
          arquivo_origem: origem,
        });
      });
    });
  }
  return remapJournal(entries, mappings || []);
}

// Contas que chegaram da Domínio e ainda não têm De/Para nessa empresa — um
// número alto aqui é o sinal de que a classificação veio num formato
// diferente do diário exportado (ex.: sem os pontos), antes de aplicar.
export function unmappedAccounts(entries, mappings) {
  const mapped = new Set((mappings || []).map((row) => row.classificacao));
  return [...new Set(entries.map((entry) => entry.classificacao).filter((code) => !mapped.has(code)))];
}
