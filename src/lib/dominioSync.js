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

// ── Balancete ──────────────────────────────────────────────────────────
// A Central também manda o balancete da empresa (POST "tipo": "balancete"
// na Edge Function → public.dominio_balancete): período inicio..fim e as
// contas com saldo ou movimento, cada uma com saldo anterior, débitos,
// créditos e saldo atual. Substitui a importação do arquivo de balancete —
// é dele que vêm a lista de contas do De/Para e os saldos do Balanço/DFC.

// Mesma ordem do plano na Domínio: classificação comparada só pelos
// dígitos, como texto ("11102" vem antes de "111020002", que vem antes de
// "11103") — a sintética logo antes das filhas.
const planOrder = (a, b) => {
  const x = String(a.classificacao).replace(/\D/g, "");
  const y = String(b.classificacao).replace(/\D/g, "");
  return x < y ? -1 : x > y ? 1 : 0;
};

// Contas no formato do balancete importado de arquivo (importers/dominio.js
// accountsFromTrialBalance) — o resto do app não distingue um do outro.
function balanceteAccounts(contas) {
  return contas
    .map((conta) => ({
      codigo: String(conta.codigo ?? ""),
      classificacao: String(conta.classificacao ?? "").trim(),
      nome_conta: String(conta.nome ?? "").trim(),
      tipo_sintetica: conta.tipo === "S" ? "sim" : "nao",
      grau: String(String(conta.classificacao ?? "").split(".").length),
      saldo_anterior: Number(conta.saldo_anterior || 0),
      debito: Number(conta.debito || 0),
      credito: Number(conta.credito || 0),
      saldo_atual: Number(conta.saldo_atual || 0),
    }))
    .sort(planOrder);
}

// O balancete que a Central mandou pra essa empresa — o lote COMPLETO mais
// recente (a Edge Function apaga os anteriores quando um novo completa) —
// ou null se não chegou nenhum.
export async function fetchDominioBalancete(codigo, cnpj) {
  if (!codigo || !cnpj) return null;
  const { data, error } = await supabase
    .from("dominio_balancete")
    .select("lote, parte, partes, inicio, fim, contas, synced_at")
    .eq("company_codigo", codigo)
    .eq("cnpj", cnpj)
    .order("parte")
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const lotes = new Map();
  (data || []).forEach((row) => {
    const lote = lotes.get(row.lote) || { lote: row.lote, partes: row.partes, inicio: row.inicio, fim: row.fim, syncedAt: "", contas: [], recebidas: 0 };
    lote.recebidas += 1;
    lote.contas.push(...(row.contas || []));
    if (row.synced_at > lote.syncedAt) lote.syncedAt = row.synced_at;
    lotes.set(row.lote, lote);
  });
  const completo = [...lotes.values()].filter((lote) => lote.recebidas >= lote.partes).sort((a, b) => b.syncedAt.localeCompare(a.syncedAt))[0];
  if (!completo) return null;
  return { lote: completo.lote, inicio: completo.inicio, fim: completo.fim, syncedAt: completo.syncedAt, accounts: balanceteAccounts(completo.contas) };
}

const accountLine = (account) =>
  [account.codigo, account.tipo_sintetica, String(account.nome_conta ?? "").trim(), cents(account.saldo_anterior), cents(account.debito), cents(account.credito), cents(account.saldo_atual)].join("|");

// Balancete da Domínio × balancete atual do portal, conta a conta (código,
// tipo, nome e os quatro valores): "novo" se o portal não tem balancete,
// "pendente" se qualquer conta mudou, entrou ou saiu, "igual" se não.
// Chave = classificação + código: há plano com contas diferentes no mesmo
// número (o da 349/350/351), e o balancete traz as duas.
const accountKey = (account) => `${String(account.classificacao ?? "").trim()}|${String(account.codigo ?? "")}`;
export function compareBalancete(dominio, portalAccounts) {
  if (!portalAccounts?.length) return "novo";
  const portal = new Map(portalAccounts.map((account) => [accountKey(account), accountLine(account)]));
  if (portal.size !== portalAccounts.length || portal.size !== dominio.accounts.length) return "pendente";
  return dominio.accounts.every((account) => portal.get(accountKey(account)) === accountLine(account)) ? "igual" : "pendente";
}

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export function monthLabel(competencia) {
  const [year, month] = String(competencia).split("-");
  return `${MONTH_SHORT[Number(month) - 1]}/${year.slice(2)}`;
}

function monthsBetween(inicio, fim) {
  const months = [];
  let [year, month] = String(inicio).slice(0, 7).split("-").map(Number);
  const last = String(fim).slice(0, 7);
  for (let guard = 0; guard < 240; guard += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > last) break;
    months.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

// Conferência "saldo inicial + lançamentos = saldo final": cada conta do
// balancete já fecha sozinha (a Edge Function recusa conta em que saldo
// anterior + débito - crédito não dá o saldo atual), então basta conferir
// que o movimento de cada conta analítica no balancete é a soma dos
// lançamentos do PORTAL nela entre inicio e fim. Diferença aqui = o que os
// relatórios mostrariam não bate com a Domínio (mês pendente, mês que não
// veio, conta com outra numeração…). Também confere se o próprio balancete
// fecha (soma dos saldos das analíticas = zero) e aponta os meses do
// período que a Central não mandou (`dominioMonths`: competências que
// chegaram, mesmo vazias).
export function checkBalancete(dominio, journal, dominioMonths = []) {
  const movimento = new Map();
  (journal || []).forEach((entry) => {
    const data = String(entry.data || "").slice(0, 10);
    if (data < dominio.inicio || data > dominio.fim) return;
    const classificacao = String(entry.classificacao ?? "").trim();
    movimento.set(classificacao, (movimento.get(classificacao) || 0) + cents(entry.debito) - cents(entry.credito));
  });
  const analiticas = dominio.accounts.filter((account) => account.tipo_sintetica === "nao");
  // Por classificação: o lançamento só traz o número da conta, então contas
  // diferentes no mesmo número (plano da 349/350/351) se somam.
  const porClassificacao = new Map();
  analiticas.forEach((account) => {
    const item = porClassificacao.get(account.classificacao) || { nomes: [], movimento: 0 };
    item.nomes.push(account.nome_conta);
    item.movimento += cents(account.debito) - cents(account.credito);
    porClassificacao.set(account.classificacao, item);
  });
  const diferencas = [];
  porClassificacao.forEach((item, classificacao) => {
    const lancamentos = movimento.get(classificacao) || 0;
    if (item.movimento !== lancamentos) diferencas.push({ classificacao, nome: item.nomes.join(" + "), balancete: item.movimento / 100, lancamentos: lancamentos / 100 });
  });
  movimento.forEach((valor, classificacao) => {
    if (!porClassificacao.has(classificacao) && valor !== 0) diferencas.push({ classificacao, nome: "conta fora do balancete", balancete: 0, lancamentos: valor / 100 });
  });
  diferencas.sort((a, b) => Math.abs(b.balancete - b.lancamentos) - Math.abs(a.balancete - a.lancamentos));
  const recebidos = new Set(dominioMonths.map((month) => month.competencia));
  return {
    contas: analiticas.length,
    diferencas,
    naoFecha: analiticas.reduce((sum, account) => sum + cents(account.saldo_atual), 0) / 100,
    mesesSemEnvio: monthsBetween(dominio.inicio, dominio.fim).filter((month) => !recebidos.has(month)),
  };
}

const sameName = (a, b) => {
  const norm = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) >= 10 && (x.startsWith(y) || y.startsWith(x))));
};

// De/Para que acompanha conta RENUMERADA na Domínio (ex.: a Micromedical,
// cujo plano mudou de versão — o mesmo cliente era 1.1.20.100.0004 e virou
// 1.1.20.100.0186): o vínculo segue o código reduzido da conta
// (codigo_conta = o "Código" do balancete, que não muda entre versões), não
// a classificação. Só segue quando o nome também bate — mesmo código com
// outro nome e outra classificação é conta diferente, não renumeração.
//
// Depois, só nos números que RECEBERAM um vínculo renumerado: fica só o
// vínculo da conta dona do número (mesmo código) — os vínculos antigos de
// outras contas nesse número saem, senão ela herdaria o destino da conta
// antiga. O resto do De/Para fica exatamente como está, inclusive vínculo
// antigo em número reaproveitado (é o que os relatórios já usam hoje;
// tirar deixaria a conta fora deles). Conta nova num número que ficou livre
// fica pendente no De/Para. Sem renumeração, nada muda.
// Devolve o MESMO array quando nada muda.
export function migrateMappings(mappings, accounts) {
  const analiticas = accounts.filter((account) => account.tipo_sintetica === "nao");
  const byCodigo = new Map(analiticas.map((account) => [account.codigo, account]));
  // Códigos das contas de cada número (pode haver mais de uma: plano da
  // 349/350/351 tem contas diferentes no mesmo número).
  const codigosDoNumero = new Map();
  analiticas.forEach((account) => codigosDoNumero.set(account.classificacao, (codigosDoNumero.get(account.classificacao) || new Set()).add(account.codigo)));
  const codigoDe = (row) => String(row.codigo_conta ?? "").trim();
  const ehDona = (row) => Boolean(codigosDoNumero.get(row.classificacao)?.has(codigoDe(row)));
  // Conta que JÁ tem vínculo no número de hoje: esse vínculo vale (é o que
  // os relatórios usam) e vínculo antigo dela em outro número não se move —
  // De/Para costuma guardar vínculo velho da mesma conta, às vezes com
  // outro destino.
  const jaVinculada = new Set((mappings || []).filter(ehDona).map((row) => row.classificacao));
  const renumeradas = [];
  const movidas = (mappings || []).map((row) => {
    const conta = codigoDe(row) ? byCodigo.get(codigoDe(row)) : null;
    if (!conta || conta.classificacao === row.classificacao || jaVinculada.has(conta.classificacao) || !sameName(conta.nome_conta, row.nome_conta)) return row;
    renumeradas.push({ de: row.classificacao, para: conta.classificacao, nome: conta.nome_conta });
    return { ...row, classificacao: conta.classificacao, nome_conta: conta.nome_conta };
  });
  const destinos = new Set(renumeradas.map((item) => item.para));
  const temProprio = new Set(movidas.filter((row) => destinos.has(row.classificacao) && ehDona(row)).map((row) => row.classificacao));
  const removidas = [];
  const vistas = new Set();
  const next = movidas.filter((row) => {
    if (!temProprio.has(row.classificacao)) return true;
    // Fica só UM vínculo, o de uma conta dona do número.
    if (ehDona(row) && !vistas.has(row.classificacao)) {
      vistas.add(row.classificacao);
      return true;
    }
    removidas.push(row);
    return false;
  });
  if (!renumeradas.length && !removidas.length) return { mappings, renumeradas, removidas };
  return { mappings: next, renumeradas, removidas };
}

// Contas analíticas do balancete ainda sem De/Para (com os vínculos já
// migrados) — ficam fora dos relatórios até alguém vincular.
export function unmappedBalanceteAccounts(accounts, mappings) {
  const mapped = new Set((mappings || []).map((row) => row.classificacao));
  return accounts.filter((account) => account.tipo_sintetica === "nao" && !mapped.has(account.classificacao));
}
