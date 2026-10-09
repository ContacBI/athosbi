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

const READ_TIMEOUT_MS = 90000;
const timeoutSignal = () => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined);

// Resumo do que chegou da Domínio pra essa empresa — um item por mês, só
// de lote COMPLETO (todas as partes recebidas). Lê só as colunas leves; os
// lançamentos em si só são baixados em fetchDominioEntries, na hora de
// aplicar.
export async function fetchDominioMonths(codigo) {
  if (!codigo) return [];
  const { data, error } = await supabase
    .from("dominio_sync")
    .select("competencia, lote, parte, partes, qtd, total_debito, total_credito, synced_at")
    .eq("company_codigo", codigo)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const lotes = new Map();
  (data || []).forEach((row) => {
    const id = `${row.competencia}|${row.lote}`;
    const lote = lotes.get(id) || { competencia: row.competencia, lote: row.lote, partes: row.partes, recebidas: 0, qtd: 0, totalDebito: 0, totalCredito: 0, syncedAt: "" };
    lote.recebidas += 1;
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

// Compara o mês da Domínio com o que o razão do portal tem hoje — mesma
// quantidade de linhas e mesmos totais de débito/crédito (em centavos) =
// "igual"; portal sem nada no mês = "novo"; mês VAZIO na Domínio com
// lançamentos no portal = "vazio" (nunca aplicado sozinho: esvaziar um mês
// inteiro fica pra exclusão manual, de propósito); qualquer outra coisa =
// "diferente".
export function compareMonth(dominioMonth, journal) {
  const entries = (journal || []).filter((entry) => String(entry.data || "").slice(0, 7) === dominioMonth.competencia);
  if (!dominioMonth.qtd) return entries.length ? "vazio" : "igual";
  if (!entries.length) return "novo";
  const debito = entries.reduce((sum, entry) => sum + cents(entry.debito), 0);
  const credito = entries.reduce((sum, entry) => sum + cents(entry.credito), 0);
  const same = entries.length === dominioMonth.qtd && debito === cents(dominioMonth.totalDebito) && credito === cents(dominioMonth.totalCredito);
  return same ? "igual" : "diferente";
}

// Baixa os lançamentos dos meses escolhidos e devolve no formato do razão
// do portal (o mesmo que importDiario produz), já carimbados com o De/Para
// atual da empresa.
export async function fetchDominioEntries(codigo, months, mappings) {
  const entries = [];
  for (const month of months) {
    const { data, error } = await supabase
      .from("dominio_sync")
      .select("parte, lancamentos")
      .eq("company_codigo", codigo)
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
