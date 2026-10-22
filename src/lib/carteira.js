// Saúde da carteira (página /carteira): o estado dos dados de cada empresa
// — balancete em dia, balanço fechando, contas sem De/Para, lançamentos,
// responsável — calculado a partir do registro leve que já vem no login
// (loadCompanies), sem baixar o razão de ninguém. A análise dos lançamentos
// (meses sem movimento, lançamentos em contas sem De/Para) é opcional: lê o
// razão de uma empresa por vez, guarda só o resumo neste navegador e solta
// o razão da memória.

import { state } from "../data/store.js";
import { kpis, missingMappingAccounts } from "../data/calculations.js";
import { effectivePlano } from "./planosPadrao.js";
import { readCompanyJournal } from "./persistence.js";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthLabel(key) {
  const [year, month] = String(key || "").split("-");
  return year && month ? `${MONTHS[Number(month) - 1]}/${year.slice(2)}` : key;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(key, n) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + n, 1);
  return monthKey(date);
}

function monthsBetween(fromKey, toKey) {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function daysAgo(iso, today) {
  const time = Date.parse(iso || "");
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((today.getTime() - time) / 86400000));
}

function whenText(days) {
  if (days == null) return "";
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  return months <= 1 ? "há 1 mês" : `há ${months} meses`;
}

// Roda `fn` com o estado global trocado pros dados de UMA empresa (mesma
// ideia de withCompanyScope em groupExport.js), sem razão — o balanço e as
// contas sem De/Para saem do balancete. Mutação direta (sem setData) e
// restauração no finally: nenhum componente chega a ver o estado trocado.
const SCOPED_KEYS = ["activeCompanyId", "activeGroupId", "accounts", "mappings", "journal", "plano", "periodStart", "periodEnd", "natureRules", "dfcOverrides", "hideNonOperatingResults", "excludedNonOperatingCodes"];

function withCompanyScope(company, fn) {
  const snapshot = Object.fromEntries(SCOPED_KEYS.map((key) => [key, state[key]]));
  const meta = company.lastBalanceteMeta || {};
  try {
    Object.assign(state, {
      activeCompanyId: company.id,
      activeGroupId: "",
      accounts: company.accounts || [],
      mappings: company.mappings || [],
      journal: [],
      plano: effectivePlano(company.planoPadraoId),
      // O período do próprio balancete: assim o balanço é o dele, intacto
      // (sem o razão não dá pra andar o saldo pra outro período).
      periodStart: String(meta.inicio || "").slice(0, 10),
      periodEnd: String(meta.fim || "").slice(0, 10),
      natureRules: company.natureRules || null,
      dfcOverrides: company.dfcOverrides || [],
      hideNonOperatingResults: Boolean(company.hideNonOperatingResults),
      excludedNonOperatingCodes: company.excludedNonOperatingCodes || [],
    });
    return fn();
  } finally {
    Object.assign(state, snapshot);
  }
}

// ---------------------------------------------------------------------------
// Resumo do razão (análise opcional), guardado neste navegador por empresa.
// Vale enquanto a quantidade de lançamentos for a mesma do registro.

const STATS_KEY = "athosbi.carteira.razao.v1";

function readStatsCache() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeStatsCache(cache) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(cache));
  } catch {
    // Sem espaço/bloqueado: a análise continua valendo nesta tela.
  }
}

export function journalStatsFromEntries(entries, mappings) {
  const mapped = new Set((mappings || []).map((row) => String(row.classificacao)));
  const months = {};
  const unmapped = new Map();
  let first = "";
  let last = "";
  (entries || []).forEach((entry) => {
    const date = String(entry.data || "").slice(0, 10);
    if (date.length === 10) {
      const key = date.slice(0, 7);
      months[key] = (months[key] || 0) + 1;
      if (!first || date < first) first = date;
      if (!last || date > last) last = date;
    }
    const account = String(entry.classificacao || "");
    if (account && !mapped.has(account)) {
      const current = unmapped.get(account) || { classificacao: account, nome: entry.nome_conta || entry.descricao_conta || "", count: 0 };
      current.count += 1;
      unmapped.set(account, current);
    }
  });
  const unmappedList = [...unmapped.values()].sort((a, b) => b.count - a.count);
  return {
    count: (entries || []).length,
    months,
    first,
    last,
    unmappedEntries: unmappedList.reduce((sum, item) => sum + item.count, 0),
    unmappedAccounts: unmappedList.slice(0, 8),
    unmappedAccountCount: unmappedList.length,
    analyzedAt: new Date().toISOString(),
  };
}

// O resumo que já existe: do cache (se a contagem bate) ou da empresa que
// já está com o razão na memória (a que está aberta).
export function cachedJournalStats(company) {
  const loaded = state.companies.find((item) => item.id === company.id);
  if (loaded?.journalLoaded && (loaded.journal || []).length) return journalStatsFromEntries(loaded.journal, loaded.mappings);
  const cached = readStatsCache()[company.id];
  if (cached && company.journalCount != null && cached.count === company.journalCount) return cached;
  return null;
}

export async function analyzeCompanyJournal(company, { onProgress } = {}) {
  const loaded = state.companies.find((item) => item.id === company.id);
  const entries = loaded?.journalLoaded ? loaded.journal : await readCompanyJournal(company.id, { onProgress });
  const stats = journalStatsFromEntries(entries || [], company.mappings);
  const cache = readStatsCache();
  cache[company.id] = stats;
  writeStatsCache(cache);
  return stats;
}

// ---------------------------------------------------------------------------
// Saúde de uma empresa.

export const LEVELS = { ok: 0, info: 1, atencao: 2, critico: 3 };

export function companyHealth(company, { today = new Date(), journalStats = null } = {}) {
  const checks = [];
  const add = (id, level, title, detail = "", action = null) => checks.push({ id, level, title, detail, action });
  const meta = company.lastBalanceteMeta || null;
  const accounts = company.accounts || [];
  const currentMonth = monthKey(today);
  const lastClosed = addMonths(currentMonth, -1);

  // 1) Balancete: existe? até quando? veio da Domínio ou de planilha?
  const updatedAt = meta?.syncedAt || meta?.uploadedAt || "";
  const updatedDays = daysAgo(updatedAt, today);
  const fim = String(meta?.fim || "").slice(0, 10);
  let dataAte = "";
  if (!accounts.length) {
    add("balancete", "critico", "Sem balancete", "Nenhum balancete importado — o balanço e os indicadores ficam vazios.", { label: "Abrir empresa", path: "/empresa" });
  } else if (fim) {
    dataAte = fim.slice(0, 7);
    const behind = monthsBetween(dataAte, lastClosed);
    const origem = meta?.origem === "dominio" ? "Domínio" : "planilha";
    if (behind <= 0) add("balancete", "ok", `Dados até ${monthLabel(dataAte)}`, `Balancete da ${origem}${updatedDays != null ? `, atualizado ${whenText(updatedDays)}` : ""}.`);
    else if (behind === 1) add("balancete", "atencao", `Falta ${monthLabel(lastClosed)}`, `O balancete vai até ${monthLabel(dataAte)} (${origem}${updatedDays != null ? `, atualizado ${whenText(updatedDays)}` : ""}).`, { label: "Abrir empresa", path: "/empresa" });
    else add("balancete", "critico", `${behind} meses sem atualizar`, `O balancete vai até ${monthLabel(dataAte)} (${origem}${updatedDays != null ? `, atualizado ${whenText(updatedDays)}` : ""}).`, { label: "Abrir empresa", path: "/empresa" });
  } else {
    const old = updatedDays != null && updatedDays > 60;
    add("balancete", old ? "atencao" : "info", "Balancete por planilha", `Sem o período de cobertura${updatedDays != null ? `; enviado ${whenText(updatedDays)}` : ""}. Pela Domínio o app sabe até que data vão os dados.`, old ? { label: "Abrir empresa", path: "/empresa" } : null);
  }

  // 2) Balanço fechando e 3) contas sem De/Para — do balancete, sem razão.
  let dif = 0;
  let missing = [];
  if (accounts.length) {
    try {
      withCompanyScope(company, () => {
        dif = Number(kpis().diferencaBalanco || 0);
        missing = missingMappingAccounts();
      });
    } catch (error) {
      console.error(`Carteira: falha ao calcular ${company.name}`, error);
      add("calculo", "atencao", "Não consegui calcular", "Abra a empresa para conferir o balanço e o De/Para.", { label: "Abrir empresa", path: "/empresa" });
    }
    if (Math.abs(dif) >= 1) add("balanco", "critico", "Balanço não fecha", `Ativo e passivo + PL têm diferença de ${money(dif)}${missing.length ? " — provavelmente pelas contas sem De/Para" : ""}.`, { label: "Ver demonstrativos", path: "/empresa/demonstrativos" });
    else add("balanco", "ok", "Balanço fechando");
    if (missing.length) {
      const share = accounts.length ? missing.length / accounts.filter((account) => account.tipo_sintetica === "nao").length : 0;
      add("depara", missing.length > 10 || share > 0.05 ? "critico" : "atencao", `${missing.length} conta${missing.length === 1 ? "" : "s"} sem De/Para`, missing.slice(0, 4).map((account) => `${account.classificacao} ${account.nome_conta || ""}`.trim()).join(" · ") + (missing.length > 4 ? " · …" : ""), { label: "Abrir De/Para", path: "/empresa/de-para" });
    } else add("depara", "ok", "De/Para completo");
  }

  // 4) Lançamentos (razão).
  const count = company.journalCount;
  if (company.journalLoadFailed) add("razao", "critico", "Razão não carregou", "A leitura dos lançamentos falhou — recarregue a página ou abra a empresa.", { label: "Abrir empresa", path: "/empresa" });
  else if (count === 0) add("razao", "atencao", "Sem lançamentos", "Sem o razão, a DRE mês a mês e a DFC ficam vazias.", { label: "Abrir empresa", path: "/empresa" });
  else if (count != null) add("razao", "ok", `${Number(count).toLocaleString("pt-BR")} lançamentos`);

  // 5) Resumo do razão (quando analisado): meses sem lançamento e
  // lançamentos em contas sem De/Para.
  if (journalStats) {
    const start = String(meta?.inicio || "").slice(0, 7) || (journalStats.first ? `${journalStats.first.slice(0, 4)}-01` : "");
    const end = dataAte || (journalStats.last ? journalStats.last.slice(0, 7) : "");
    const gaps = [];
    if (start && end && start <= end) {
      for (let key = start, guard = 0; key <= end && guard < 120; key = addMonths(key, 1), guard += 1) if (!journalStats.months[key]) gaps.push(key);
    }
    if (gaps.length) add("meses", gaps.length >= 2 ? "critico" : "atencao", `${gaps.length} ${gaps.length === 1 ? "mês" : "meses"} sem lançamento`, gaps.map(monthLabel).join(", "), { label: "Abrir empresa", path: "/empresa" });
    else if (start && end) add("meses", "ok", "Todos os meses com lançamento", `${monthLabel(start)} a ${monthLabel(end)}`);
    if (journalStats.last && dataAte && journalStats.last.slice(0, 7) < dataAte) add("razao_atrasado", "atencao", "Razão atrás do balancete", `Lançamentos até ${monthLabel(journalStats.last.slice(0, 7))}, balancete até ${monthLabel(dataAte)}.`, { label: "Abrir empresa", path: "/empresa" });
    if (journalStats.unmappedEntries) add("razao_depara", "atencao", `${journalStats.unmappedEntries.toLocaleString("pt-BR")} lançamentos em contas sem De/Para`, journalStats.unmappedAccounts.slice(0, 4).map((item) => `${item.classificacao}${item.nome ? ` ${item.nome}` : ""} (${item.count})`).join(" · "), { label: "Abrir De/Para", path: "/empresa/de-para" });
  }

  // 6) Responsável e plano padrão.
  const responsaveis = company.responsaveis || [];
  if (!responsaveis.length) add("responsavel", "atencao", "Sem responsável", "Ninguém do escritório está como responsável por esta empresa.", { label: "Cadastro", path: "/parametros/responsaveis" });
  if (!company.planoPadraoId) add("plano", "info", "Sem plano padrão", "Usa só o plano gerencial global.", { label: "Cadastro", path: "/parametros/empresas" });

  const worst = checks.reduce((max, check) => Math.max(max, LEVELS[check.level]), 0);
  const status = worst >= 3 ? "critico" : worst >= 2 ? "atencao" : "ok";
  return {
    id: company.id,
    status,
    checks: checks.sort((a, b) => LEVELS[b.level] - LEVELS[a.level]),
    problems: checks.filter((check) => LEVELS[check.level] >= 2).length,
    metrics: {
      dif,
      missing: missing.length,
      dataAte,
      origem: meta?.origem === "dominio" ? "Domínio" : accounts.length ? "Planilha" : "",
      updatedAt,
      updatedDays,
      count,
      responsaveis,
      journalStats,
    },
  };
}
