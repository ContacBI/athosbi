import { state, setData } from "../data/useStore.js";
import {
  COMPANIES_KEY,
  ACTIVE_COMPANY_KEY,
  GROUPS_KEY,
  ACTIVE_GROUP_KEY,
  readStoredArray,
  readPersistent,
  writePersistent,
  readPersistentByPrefix,
  deletePersistent,
  companyKey,
  companyJournalKey,
  COMPANY_KEY_PREFIX,
} from "./persistence.js";
import { DEFAULT_NATURE_RULES } from "./accountNature.js";
import { supabase, MONTHLY_REPORTS_BUCKET } from "./supabaseClient.js";

// Remembers, per company id, the exact array/object reference last sent to
// Supabase for that company's journal and for the rest of its record — so a
// save that didn't touch a given company (the vast majority of saves: a
// De/Para edit or a dashboard tweak only ever changes the active company)
// skips re-uploading it entirely. `.map()` calls that leave a company
// untouched hand back the very same object/array reference, so a `!==`
// check reliably tells "actually edited" apart from "just along for the
// ride in the same companies array". This is also what makes it SAFE for
// two tabs/devices to be open at once: each company now lives in its own
// Supabase row (companyKey), so a tab only ever writes the rows it actually
// changed — it can never blast a stale in-memory copy of some OTHER
// company over a newer row it never even read.
const lastWrittenJournals = new Map();
const lastWrittenRecords = new Map();

function writeStoredCompanies(companies) {
  const writes = companies.map((company) => {
    // Compared against the COMPANY object itself, not a `{ ...company }`
    // copy — object-rest-spread always allocates a new object, so
    // comparing copies would never match and this whole skip-what-didn't-
    // change mechanism would silently do nothing. Comparing the real
    // reference works because a `.map()` that leaves a given company
    // untouched hands back that exact same object every time.
    const recordChanged = lastWrittenRecords.get(company.id) !== company;
    // journalLoadFailed (ver loadCompanies) trava a escrita do razão dessa
    // empresa por completo, mesmo que a referência pareça "mudada" — foi
    // exatamente essa combinação (leitura falhou -> vira [] -> qualquer
    // ação de salvar reescreve [] por cima do razão de verdade) que quase
    // apagou o razão de empresas inteiras. Sem o razão de verdade em mãos,
    // não tem "salvar mesmo assim" seguro aqui: melhor a edição do usuário
    // não persistir agora (ele recarrega a página e tenta de novo) do que
    // arriscar sobrescrever dado real com um array vazio.
    const journalChanged = !company.journalLoadFailed && lastWrittenJournals.get(company.id) !== company.journal;
    if (company.journalLoadFailed) {
      console.error(`Empresa "${company.name}" (${company.id}): razão não carregou direito — pulando a escrita do razão pra não sobrescrever com vazio. Recarregue a página pra tentar de novo.`);
    }
    if (!journalChanged && !recordChanged) return null;
    const pending = [];
    if (journalChanged) {
      lastWrittenJournals.set(company.id, company.journal);
      pending.push(writePersistent(companyJournalKey(company.id), company.journal || []));
    }
    // Grava o registro sempre que o razão mudou também (mesmo se mais nada
    // mudou) — é onde `journalCount` fica atualizado. loadCompanies() lê só
    // esse número pra mostrar "X lançamentos" na lista, sem baixar o razão
    // inteiro de cada empresa — sem isso aqui, o contador ficaria
    // desatualizado toda vez que o razão muda sozinho (ex.: importar um
    // mês novo de diário).
    if (recordChanged || journalChanged) {
      lastWrittenRecords.set(company.id, company);
      const { journal, journalLoadFailed, journalLoaded, ...record } = company; // nenhum dos 3 é persistido — journal tem write própria, os outros dois são só sinal local desta aba
      pending.push(writePersistent(companyKey(company.id), { ...record, journalCount: (company.journal || []).length }));
    }
    return Promise.all(pending);
  });
  return Promise.all(writes.filter(Boolean));
}

function writeStoredGroups(groups) {
  return writePersistent(GROUPS_KEY, groups);
}

export function activeCompany() {
  if (state.activeGroupId) return null;
  return state.companies.find((company) => company.id === state.activeCompanyId) || null;
}

// A journal imported with an older/partial de-para can carry stale
// codigo_gerencial values. Re-stamp every entry from the company's current
// mapping so reports always reflect the latest de/para. Exported so the
// De/Para editor can re-stamp the already-loaded journal the instant a
// mapping changes, without requiring a company reselect/reload.
export function remapJournal(journal, mappings) {
  const mapping = new Map(mappings.map((row) => [row.classificacao, row]));
  return journal.map((entry) => {
    const map = mapping.get(entry.classificacao);
    // An unmapped account must not retain a former managerial destination.
    // This is especially important after a plano account is edited/deleted:
    // its old De/Para is intentionally invalidated across every company.
    if (!map) {
      return {
        ...entry,
        codigo_gerencial: "",
        categoria_gerencial: "",
        demonstrativo: "",
        grupo_macro: "",
      };
    }
    return {
      ...entry,
      codigo_gerencial: map.codigo_gerencial || "",
      categoria_gerencial: map.categoria_gerencial || "",
      demonstrativo: map.demonstrativo || "",
      grupo_macro: map.grupo_macro || "",
    };
  });
}

// The plano gerencial is shared by all companies, but each company owns its
// own De/Para. When a target line changes, prior links to its old definition
// are deliberately discarded instead of silently pointing to a new meaning.
// Returns how many links were removed, so callers can give the user a clear
// confirmation message.
export function invalidateMappingsForPlanoCodes(codes) {
  const invalidCodes = new Set((Array.isArray(codes) ? codes : [codes]).filter(Boolean));
  if (!invalidCodes.size) return 0;
  let removed = 0;
  const companies = state.companies.map((company) => {
    const previous = company.mappings || [];
    const hasInvalidLink = previous.some((mapping) => invalidCodes.has(mapping.codigo_gerencial));
    // Companies with nothing to invalidate pass through as the exact same
    // object — building a new one for every company regardless (even when
    // nothing on it actually changed) is what writeStoredCompanies uses to
    // decide what needs re-saving, so touching all of them here would mean
    // this one plano edit rewrites every company's row, stale in-memory
    // copies included.
    if (!hasInvalidLink) return company;
    const mappings = previous.filter((mapping) => !invalidCodes.has(mapping.codigo_gerencial));
    removed += previous.length - mappings.length;
    return { ...company, mappings, journal: remapJournal(company.journal || [], mappings), updatedAt: new Date().toISOString() };
  });
  if (!removed) return 0;
  const active = companies.find((company) => company.id === state.activeCompanyId);
  setData({
    companies,
    ...(active ? { mappings: active.mappings, journal: active.journal } : {}),
  });
  writeStoredCompanies(companies);
  return removed;
}

// Returns { groupId } when a group was the last active workspace — App.jsx
// finishes restoring it via groups.js's selectGroup (kept out of this file
// to avoid a circular import, since selectGroup itself calls back into
// persistActiveCompany above).
// Leitura pura (sem tocar em state.activeCompanyId/activeGroupId nem nos
// caches de "já salvo") do que loadCompanies também faz — extraído pra
// exportFullBackup (lib/fullBackup.js) poder buscar companies+groups
// FRESCOS do banco na hora do backup, sem os efeitos colaterais de
// loadCompanies (que reseta a empresa/grupo ativo — errado no meio de um
// export, expulsaria o usuário da tela que ele está vendo).
export async function fetchCompaniesAndGroups() {
  let records = await readPersistentByPrefix(COMPANY_KEY_PREFIX);
  // One-time migration: nothing under the new per-company keys yet means
  // this account still has its companies under the old shared-array key
  // (COMPANIES_KEY) — read that once, split every company into its own row
  // right away, and never touch the old key again. Safe to run from more
  // than one tab/device at once: it only ever re-writes rows from data it
  // just read, the same as any other save.
  if (records.length === 0) {
    const legacyLight = await readStoredArray(COMPANIES_KEY);
    if (legacyLight.length > 0) {
      records = legacyLight.map(({ journal, ...rest }) => rest);
      await Promise.all(records.map((record) => writePersistent(companyKey(record.id), record)));
    }
  }
  const companies = await Promise.all(
    records.map(async (record) => {
      let journal;
      let journalLoadFailed = false;
      try {
        journal = await readPersistent(companyJournalKey(record.id));
      } catch (error) {
        // Não dá pra saber se essa empresa realmente não tem lançamento
        // nenhum ou se a leitura só falhou (rede, timeout — mais comum
        // quanto maior o razão). Tratar como "vazio" aqui já causou um
        // susto de perda de dado real: fica marcada como falha, mostra []
        // só pra não quebrar a tela, e writeStoredCompanies recusa
        // escrever o razão dela enquanto isso não for corrigido (recarregar
        // a página tenta de novo).
        console.error(`Empresa "${record.name}" (${record.id}): não consegui ler o razão do Supabase.`, error);
        journal = [];
        journalLoadFailed = true;
      }
      // `journal` embedded on the legacy record itself is only present for
      // companies saved before the ledger was split into its own key.
      if (journal === undefined) journal = record.journal || [];
      const { journal: _legacyJournal, ...rest } = record;
      const company = { ...rest, journal, journalLoadFailed, journalLoaded: !journalLoadFailed };
      // Pre-populate the "already saved" trackers with the exact object
      // this tab is about to hold in state.companies — otherwise every
      // company, not just the one actually edited, would look "changed"
      // (and get needlessly rewritten) the very first time anything in
      // this tab gets saved.
      lastWrittenJournals.set(record.id, journal);
      lastWrittenRecords.set(record.id, company);
      return company;
    })
  );
  const groups = await readStoredArray(GROUPS_KEY);
  return { companies, groups };
}

// Carrega o razão de UMA empresa sob demanda — chamado só quando ela é de
// fato aberta (selectCompany) ou entra num grupo (selectGroup/
// buildGroupDataset). `loadCompanies()` (abaixo) NUNCA baixa o razão de
// ninguém — só o `journalCount` já salvo no registro da empresa — porque
// a tela "Escolha uma empresa" só precisa mostrar a contagem, não o razão
// inteiro. Antes dessa mudança, logar com 10 empresas somando 200 mil+
// lançamentos baixava TUDO isso de uma vez só pra montar aquela lista.
// Idempotente: chamar de novo numa empresa já carregada é um no-op.
export async function ensureCompanyJournalLoaded(company) {
  if (!company || company.journalLoaded) return company;
  let journal;
  let journalLoadFailed = false;
  try {
    journal = await readPersistent(companyJournalKey(company.id));
  } catch (error) {
    console.error(`Empresa "${company.name}" (${company.id}): não consegui ler o razão do Supabase.`, error);
    journalLoadFailed = true;
  }
  if (journal === undefined) journal = [];
  const updated = {
    ...company,
    journal,
    journalLoaded: !journalLoadFailed,
    journalLoadFailed,
    journalCount: journalLoadFailed ? company.journalCount : journal.length,
  };
  // Só sincroniza os caches de "já salvo" quando a leitura deu certo — numa
  // falha, updated.journal fica [] só pra não quebrar a tela (ver
  // writeStoredCompanies, que recusa escrever o razão dela enquanto
  // journalLoadFailed for true, exatamente pra não deixar esse [] de
  // exibição vazar pro banco de dados).
  if (!journalLoadFailed) lastWrittenJournals.set(company.id, journal);
  lastWrittenRecords.set(company.id, updated);
  setData({ companies: state.companies.map((item) => (item.id === company.id ? updated : item)) });
  return updated;
}

export async function loadCompanies() {
  let records = await readPersistentByPrefix(COMPANY_KEY_PREFIX);
  // Mesma migração de uma vez só que fetchCompaniesAndGroups faz — ver lá
  // em cima. Duplicada aqui (em vez de compartilhada) porque essa versão
  // não carrega razão nenhum, só monta os registros leves.
  if (records.length === 0) {
    const legacyLight = await readStoredArray(COMPANIES_KEY);
    if (legacyLight.length > 0) {
      records = legacyLight.map(({ journal, ...rest }) => rest);
      await Promise.all(records.map((record) => writePersistent(companyKey(record.id), record)));
    }
  }
  const companies = records.map((record) => {
    // Registro de antes da separação do razão ainda carrega ele embutido —
    // esse já está "carregado" de graça, sem precisar de busca nenhuma.
    const hasEmbeddedJournal = Array.isArray(record.journal);
    const { journal: embeddedJournal, ...rest } = record;
    // `journalCount` é um campo novo — todo registro já existente antes
    // dessa mudança não tem ele salvo ainda. `null` aqui (não 0!) marca
    // "ainda não sei", pra distinguir de uma empresa que realmente não tem
    // nenhum lançamento — backfillMissingJournalCounts (chamado logo
    // abaixo) descobre e preenche isso sozinho em segundo plano.
    const company = {
      ...rest,
      journal: hasEmbeddedJournal ? embeddedJournal : [],
      journalLoaded: hasEmbeddedJournal,
      journalLoadFailed: false,
      journalCount: record.journalCount ?? (hasEmbeddedJournal ? embeddedJournal.length : null),
    };
    if (hasEmbeddedJournal) lastWrittenJournals.set(record.id, company.journal);
    lastWrittenRecords.set(record.id, company);
    return company;
  });
  const groups = await readStoredArray(GROUPS_KEY);
  const storedGroupId = localStorage.getItem(ACTIVE_GROUP_KEY);
  const groupValid = Boolean(storedGroupId) && groups.some((group) => group.id === storedGroupId);
  setData({ companies, groups, activeCompanyId: "", activeGroupId: "" });
  // Não trava o carregamento por causa disso — cada empresa que ainda não
  // tem journalCount salvo é resolvida em paralelo, em segundo plano, e a
  // tela vai se corrigindo sozinha conforme cada uma resolve. Só acontece
  // de verdade uma vez por empresa (depois disso journalCount já fica
  // salvo e loadCompanies nunca mais precisa buscar o razão dela à toa).
  backfillMissingJournalCounts().catch((error) => console.error("Falha ao recalcular contagens de lançamentos:", error));
  if (groupValid) return { groupId: storedGroupId };
  const activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY) || companies[0]?.id || "";
  if (activeCompanyId) selectCompany(activeCompanyId, { skipPersist: true });
  return { groupId: null };
}

// Migração de uma vez só, por empresa: quem ainda não tem journalCount
// salvo (todo registro de antes dessa mudança) tem o razão buscado uma
// única vez pra descobrir o tamanho de verdade, e esse número é gravado de
// volta — sem reescrever o razão em si, só o registro leve da empresa.
// Depois disso, loadCompanies nunca mais precisa tocar no razão dela.
async function backfillMissingJournalCounts() {
  const targets = state.companies.filter((company) => company.journalCount == null && !company.journalLoaded);
  await Promise.all(
    targets.map(async (company) => {
      const loaded = await ensureCompanyJournalLoaded(company);
      if (loaded.journalLoadFailed) return;
      const current = state.companies.find((item) => item.id === company.id);
      if (!current) return;
      const { journal, journalLoadFailed, journalLoaded, ...record } = current;
      try {
        await writePersistent(companyKey(company.id), { ...record, journalCount: loaded.journal.length });
      } catch (error) {
        console.error(`Não consegui salvar a contagem de lançamentos de "${company.name}":`, error);
      }
    })
  );
}

export function createCompany({
  name,
  cnpj = "",
  codigo = "",
  atividade = "",
  municipio = "",
  uf = "",
  representanteIds = [],
  natureRules = DEFAULT_NATURE_RULES,
}) {
  const companyName = String(name || "").trim();
  if (!companyName) return null;
  persistActiveCompany();
  const company = {
    id: `emp_${Date.now()}`,
    name: companyName,
    cnpj,
    codigo,
    atividade,
    municipio,
    uf,
    representanteIds,
    natureRules,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mappings: [],
    dfcOverrides: [],
    accounts: [],
    journal: [],
    periodStart: "",
    periodEnd: "",
    hideNonOperatingResults: false,
    excludedNonOperatingCodes: [],
    dashboardTabs: [],
  };
  const companies = state.companies.concat(company);
  writeStoredCompanies(companies);
  localStorage.setItem(ACTIVE_COMPANY_KEY, company.id);
  localStorage.removeItem(ACTIVE_GROUP_KEY);
  setData({
    companies,
    activeCompanyId: company.id,
    activeGroupId: "",
    mappings: [],
    dfcOverrides: [],
    accounts: [],
    journal: [],
    periodStart: "",
    periodEnd: "",
    natureRules,
  });
  return company;
}

export function updateCompany(
  id,
  { name, cnpj = "", codigo = "", atividade = "", municipio = "", uf = "", representanteIds = [], natureRules = DEFAULT_NATURE_RULES }
) {
  const companyName = String(name || "").trim();
  if (!companyName) return null;
  const companies = state.companies.map((company) =>
    company.id === id
      ? { ...company, name: companyName, cnpj, codigo, atividade, municipio, uf, representanteIds, natureRules, updatedAt: new Date().toISOString() }
      : company
  );
  writeStoredCompanies(companies);
  setData({ companies, ...(id === state.activeCompanyId ? { natureRules } : {}) });
  return companies.find((company) => company.id === id) || null;
}

// One-time upgrade path from the earlier single-list "dashboardWidgets"
// shape (briefly shipped before the multi-tab workspace) into a tab named
// "Resumo" — keeps anyone who already customized their dashboard from
// losing it.
export function migrateDashboardTabs(company) {
  if (Array.isArray(company.dashboardTabs)) return company.dashboardTabs;
  if (Array.isArray(company.dashboardWidgets) && company.dashboardWidgets.length) {
    return [{ id: `tab_${company.id}_resumo`, name: "Resumo", widgets: company.dashboardWidgets }];
  }
  return [];
}

export async function selectCompany(id, { skipPersist = false } = {}) {
  if (!skipPersist) persistActiveCompany();
  const company = state.companies.find((item) => item.id === id);
  if (!company) return;
  localStorage.setItem(ACTIVE_COMPANY_KEY, id);
  localStorage.removeItem(ACTIVE_GROUP_KEY);
  // Tudo que já está disponível sem buscar nada no Supabase (registro leve
  // de loadCompanies — contas, mappings, configurações) entra já, síncrono:
  // trocar de empresa não pode esperar o razão pra sequer navegar pra tela
  // certa (o CompanyLayout chuta de volta pra /empresas se activeCompanyId
  // ainda não tiver sido setado). O razão em si só chega depois, na
  // continuação abaixo, e atualiza a tela sozinho quando terminar.
  setData({
    activeCompanyId: id,
    activeGroupId: "",
    mappings: company.mappings || [],
    dfcOverrides: company.dfcOverrides || [],
    accounts: company.accounts || [],
    journal: company.journalLoaded ? remapJournal(company.journal || [], company.mappings || []) : [],
    // Ver loadCompanies/ensureCompanyJournalLoaded — true quando a leitura
    // do razão desta empresa falhou (não confirma "vazia"). CompanyTopBar
    // mostra um aviso; nenhum save toca no razão dela enquanto isso ficar
    // true (ver writeStoredCompanies).
    journalLoadFailed: Boolean(company.journalLoadFailed),
    periodStart: company.periodStart || "",
    periodEnd: company.periodEnd || "",
    hideNonOperatingResults: Boolean(company.hideNonOperatingResults),
    excludedNonOperatingCodes: company.excludedNonOperatingCodes || [],
    reportCompare: company.reportCompare ?? true,
    showPreviousBalanceBP: company.showPreviousBalanceBP ?? true,
    showPreviousBalanceDRE: company.showPreviousBalanceDRE ?? false,
    showReportTotalBP: company.showReportTotalBP ?? false,
    showReportTotalDRE: company.showReportTotalDRE ?? true,
    showReportTotalDFC: company.showReportTotalDFC ?? false,
    bpMonthlyMode: company.bpMonthlyMode === "movement" ? "movement" : "accumulated",
    dashboardTabs: migrateDashboardTabs(company),
    natureRules: company.natureRules || DEFAULT_NATURE_RULES,
    selectedLine: null,
    selectedAccount: null,
    expandedLines: new Set(),
  });
  if (company.journalLoaded) return;
  const loaded = await ensureCompanyJournalLoaded(company);
  // O usuário pode ter trocado de empresa de novo enquanto essa busca
  // ainda estava em andamento — não pisa no que já é outra tela agora.
  if (state.activeCompanyId !== id) return;
  setData({
    journal: remapJournal(loaded.journal || [], state.mappings || []),
    journalLoadFailed: Boolean(loaded.journalLoadFailed),
  });
}

// Saves whatever workspace is currently active back to storage — a single
// company, or (see below) a group's own consolidated workspace settings.
// Kept under its original name since every call site (dashboardTabs.js,
// Depara.jsx, RelatoriosMensais.jsx, journalMonths.js) already calls it
// unconditionally after an edit; dispatching internally means none of them
// need to know or care whether a company or a group is currently active.
export function persistActiveCompany() {
  if (state.activeGroupId) {
    persistActiveGroupWorkspace();
    return;
  }
  if (!state.activeCompanyId) return;
  const companies = state.companies.map((company) => {
    if (company.id !== state.activeCompanyId) return company;
    const { dashboardWidgets, ...rest } = company;
    return {
      ...rest,
      updatedAt: new Date().toISOString(),
      mappings: state.mappings || [],
      dfcOverrides: state.dfcOverrides || [],
      accounts: state.accounts || [],
      journal: state.journal || [],
      periodStart: state.periodStart || "",
      periodEnd: state.periodEnd || "",
      hideNonOperatingResults: Boolean(state.hideNonOperatingResults),
      excludedNonOperatingCodes: state.excludedNonOperatingCodes || [],
      reportCompare: state.reportCompare !== false,
      showPreviousBalanceBP: state.showPreviousBalanceBP !== false,
      showPreviousBalanceDRE: Boolean(state.showPreviousBalanceDRE),
      showReportTotalBP: Boolean(state.showReportTotalBP),
      showReportTotalDRE: state.showReportTotalDRE !== false,
      showReportTotalDFC: Boolean(state.showReportTotalDFC),
      bpMonthlyMode: state.bpMonthlyMode === "movement" ? "movement" : "accumulated",
      dashboardTabs: state.dashboardTabs || [],
    };
  });
  setData({ companies });
  writeStoredCompanies(companies);
}

// A group has no accounts/journal/mappings of its own to save — those are
// always rebuilt live from its member companies (see groups.js) — just its
// own workspace settings: period, tab layout, non-operating filter.
function persistActiveGroupWorkspace() {
  if (!state.activeGroupId) return;
  const groups = state.groups.map((group) => {
    if (group.id !== state.activeGroupId) return group;
    return {
      ...group,
      updatedAt: new Date().toISOString(),
      periodStart: state.periodStart || "",
      periodEnd: state.periodEnd || "",
      hideNonOperatingResults: Boolean(state.hideNonOperatingResults),
      excludedNonOperatingCodes: state.excludedNonOperatingCodes || [],
      dashboardTabs: state.dashboardTabs || [],
    };
  });
  setData({ groups });
  writeStoredGroups(groups);
}

function freshTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Deep clone with fresh ids for every tab/subtab — each target company gets
// its own independent copy, not a shared reference to the source's arrays.
function cloneDashboardTabs(tabs) {
  return (tabs || []).map((tab) => ({
    ...tab,
    id: freshTabId(),
    widgets: (tab.widgets || []).map((widget) => ({ ...widget })),
    ...(tab.subTabs
      ? {
          subTabs: tab.subTabs.map((sub) => ({
            ...sub,
            id: freshTabId(),
            widgets: (sub.widgets || []).map((widget) => ({ ...widget })),
          })),
        }
      : {}),
  }));
}

// "Replicar relatórios": pick one company as the model and push its whole
// workspace (every aba/subaba/widget, i.e. what Personalizar builds) onto
// other companies in one go, instead of rebuilding the same dashboard by
// hand for each client. A full replace, not a merge — whatever the target
// companies had gets overwritten, same as any other bulk-replace action in
// this app (balancete, plano gerencial); the caller confirms with the user
// first. Returns how many companies actually got updated.
// Shared by "empresa modelo -> outras empresas" and "grupo modelo -> empresas
// avulsas" — the source's tabs are already resolved by the caller (a
// migrateDashboardTabs(company) or a group's own dashboardTabs), this only
// ever needs to know what to stamp and onto which company ids.
function applyDashboardTabsToCompanies(sourceTabs, targetIds, excludeId) {
  const targetSet = new Set(targetIds);
  if (excludeId) targetSet.delete(excludeId);
  if (!targetSet.size) return 0;

  let applied = 0;
  const companies = state.companies.map((company) => {
    if (!targetSet.has(company.id)) return company;
    applied += 1;
    return { ...company, dashboardTabs: cloneDashboardTabs(sourceTabs), updatedAt: new Date().toISOString() };
  });
  writeStoredCompanies(companies);
  setData({ companies });

  // If the active company was itself one of the targets, refresh the live
  // workspace too so the change is visible without a reselect.
  if (targetSet.has(state.activeCompanyId)) {
    const updated = companies.find((company) => company.id === state.activeCompanyId);
    setData({ dashboardTabs: updated?.dashboardTabs || [] });
  }
  return applied;
}

export function replicateDashboardTabs(sourceId, targetIds) {
  const source = state.companies.find((company) => company.id === sourceId);
  if (!source) return 0;
  return applyDashboardTabsToCompanies(migrateDashboardTabs(source), targetIds, sourceId);
}

// A group's consolidated workspace used as the model for individual member
// (or non-member) companies — same "replicar" mechanics as company-to-company,
// just sourced from lib/groups.js's replicateGroupDashboardTabsToCompanies
// instead of another company, since a group's tabs live in state.groups, not
// state.companies.
export function replicateTabsToCompanies(sourceTabs, targetIds) {
  return applyDashboardTabsToCompanies(sourceTabs, targetIds);
}

// Called when a representante is deleted (see lib/representantes.js) —
// drops that id from every company's representanteIds. Routed through here
// (rather than representantes.js writing to company storage directly, which
// it used to) so it goes through writeStoredCompanies and gets the same
// per-row, only-what-actually-changed treatment as every other company
// edit — companies with no reference to this representante pass through
// untouched instead of every single one being rewritten.
export function unlinkRepresentanteFromCompanies(representanteId) {
  const companies = state.companies.map((company) => {
    if (!(company.representanteIds || []).includes(representanteId)) return company;
    return { ...company, representanteIds: company.representanteIds.filter((id) => id !== representanteId) };
  });
  writeStoredCompanies(companies);
  setData({ companies });
}

export function deleteCompany(id) {
  const companies = state.companies.filter((company) => company.id !== id);
  // Each company is its own row now (see companyKey) — simply leaving it
  // out of a future write no longer removes it, its row has to be deleted
  // explicitly.
  deletePersistent(companyKey(id));
  deletePersistent(companyJournalKey(id));
  lastWrittenRecords.delete(id);
  lastWrittenJournals.delete(id);
  const nextActive = state.activeCompanyId === id ? companies[0]?.id || "" : state.activeCompanyId;
  setData({ companies });
  if (state.activeCompanyId === id) {
    if (nextActive) selectCompany(nextActive, { skipPersist: true });
    else setData({ activeCompanyId: "", mappings: [], accounts: [], journal: [] });
  }
}

// Full replace of every company + group — shared by the plain JSON backup
// below and the comprehensive zip backup (lib/fullBackup.js). Any company
// that exists today but isn't in `companies` gets its row deleted
// explicitly: writeStoredCompanies only ever writes rows for what's handed
// to it, it has no way to know a company simply absent from this list
// should be removed rather than left alone (each company is its own row;
// see companyKey). Every incoming company is force-written regardless of
// reference tracking — a restore should always land exactly as the backup
// says, never silently skipped because some unrelated earlier write
// happened to leave a matching cached reference.
export async function restoreCompaniesAndGroups({ companies, groups, activeCompanyId: preferredActiveId }) {
  const nextCompanies = Array.isArray(companies) ? companies : [];
  const nextGroups = Array.isArray(groups) ? groups : [];
  const incomingIds = new Set(nextCompanies.map((company) => company.id));
  const staleIds = state.companies.map((company) => company.id).filter((id) => !incomingIds.has(id));
  await Promise.all(
    staleIds.map((id) => {
      lastWrittenRecords.delete(id);
      lastWrittenJournals.delete(id);
      return Promise.all([deletePersistent(companyKey(id)), deletePersistent(companyJournalKey(id))]);
    })
  );
  nextCompanies.forEach((company) => {
    lastWrittenRecords.delete(company.id);
    lastWrittenJournals.delete(company.id);
  });
  await writeStoredCompanies(nextCompanies);
  await writeStoredGroups(nextGroups);
  const activeCompanyId = preferredActiveId && nextCompanies.some((company) => company.id === preferredActiveId)
    ? preferredActiveId
    : nextCompanies[0]?.id || "";
  localStorage.setItem(ACTIVE_COMPANY_KEY, activeCompanyId);
  localStorage.removeItem(ACTIVE_GROUP_KEY);
  setData({ companies: nextCompanies, groups: nextGroups, activeCompanyId, activeGroupId: "" });
  if (activeCompanyId) selectCompany(activeCompanyId, { skipPersist: true });
  return nextCompanies.length;
}

export async function importBackupFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  return restoreCompaniesAndGroups({
    companies: payload.companies,
    groups: payload.groups,
    activeCompanyId: payload.activeCompanyId,
  });
}

export function exportBackupPayload() {
  persistActiveCompany();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeCompanyId: state.activeCompanyId,
    activeGroupId: state.activeGroupId,
    // Monthly report attachments live in Supabase Storage, not in this jsonb
    // (see attachMonthlyReport) — a portable backup restored into a
    // different project wouldn't have those files anyway, so their metadata
    // is left out here rather than pointing at storage paths that don't exist.
    companies: state.companies.map(({ monthlyReports, ...company }) => company),
    groups: state.groups,
  };
}

// `kind` tags what the attached file actually is — "diario"/"balancete" (the
// real, processed imports, kept here purely as a per-month audit trail of
// which raw file produced today's data) vs "outro" (just a document parked
// for safekeeping, never parsed). Defaults to "outro" for the general-purpose
// archive use this already had.
export async function attachMonthlyReport(monthKey, file, kind = "outro") {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  if (!company) return;
  const reportId = `rep_${Date.now()}`;
  // The only real binary file this app handles — everything else is JSON
  // that rides along in the app_storage blob, but a Blob can't survive
  // JSON.stringify, so this one goes to Supabase Storage instead and only
  // its storage path gets remembered here.
  const storagePath = `${company.id}/${monthKey}/${reportId}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(MONTHLY_REPORTS_BUCKET).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw uploadError;

  const report = {
    id: reportId,
    name: file.name,
    size: file.size,
    type: file.type,
    kind,
    uploadedAt: new Date().toISOString(),
    storagePath,
  };
  const monthlyReports = { ...(company.monthlyReports || {}) };
  monthlyReports[monthKey] = [...(monthlyReports[monthKey] || []), report];
  const companies = state.companies.map((item) => (item.id === company.id ? { ...item, monthlyReports } : item));
  writeStoredCompanies(companies);
  setData({ companies });
}

// Fetches the actual file back from Storage for the "abrir"/"baixar" action
// in Relatórios mensais — report.blob doesn't exist anymore (see above), so
// this is now async instead of a plain URL.createObjectURL(report.blob).
export async function fetchMonthlyReportBlob(report) {
  const { data, error } = await supabase.storage.from(MONTHLY_REPORTS_BUCKET).download(report.storagePath);
  if (error) throw error;
  return data;
}

// A balancete replaces the whole chart of accounts wholesale (it's a single
// point-in-time/cumulative snapshot, not something that decomposes cleanly
// into one-file-per-month the way the diário does) — this just remembers
// which file produced the current one, for a simple "enviado em..." status
// line instead of pretending it's a per-month attachment.
export function setLastBalanceteMeta(meta) {
  const companies = state.companies.map((item) => (item.id === state.activeCompanyId ? { ...item, lastBalanceteMeta: meta } : item));
  writeStoredCompanies(companies);
  setData({ companies });
}

// A wrong balancete upload is a real, easy-to-make mistake (wrong file,
// wrong month, wrong company) — and since a balancete replace is a full
// wholesale swap of the chart of accounts, there was previously no way back
// short of tracking down and re-importing the old file by hand. This keeps
// exactly ONE snapshot of whatever was just replaced — a single "undo",
// not a full version history — overwritten every time a new balancete
// comes in, so it only ever protects against the most recent mistake.
export function replaceAccounts(newAccounts, meta) {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  if (!company) return;
  const previousBalancete = (company.accounts || []).length
    ? { accounts: company.accounts, meta: company.lastBalanceteMeta || null, savedAt: new Date().toISOString() }
    : company.previousBalancete || null;
  const companies = state.companies.map((item) => (item.id === company.id ? { ...item, previousBalancete } : item));
  writeStoredCompanies(companies);
  setData({ companies, accounts: newAccounts });
  persistActiveCompany();
  setLastBalanceteMeta(meta);
}

// Consumes the backup on restore — it's a one-shot undo, not a toggle, so
// "restaurar" twice in a row does nothing the second time (nothing further
// back to recover) rather than bouncing between two states forever.
export function restorePreviousBalancete() {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const backup = company?.previousBalancete;
  if (!backup) return false;
  const companies = state.companies.map((item) => (item.id === company.id ? { ...item, previousBalancete: null } : item));
  writeStoredCompanies(companies);
  setData({ companies, accounts: backup.accounts });
  persistActiveCompany();
  setLastBalanceteMeta(backup.meta);
  return true;
}

export function removeMonthlyReport(monthKey, reportId) {
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  if (!company) return;
  const existing = company.monthlyReports?.[monthKey] || [];
  const target = existing.find((report) => report.id === reportId);
  const monthlyReports = { ...(company.monthlyReports || {}) };
  monthlyReports[monthKey] = existing.filter((report) => report.id !== reportId);
  const companies = state.companies.map((item) => (item.id === company.id ? { ...item, monthlyReports } : item));
  writeStoredCompanies(companies);
  setData({ companies });
  // Best-effort — the metadata is already gone from the company record
  // either way, so a failed/slow storage delete never blocks the UI.
  if (target?.storagePath) supabase.storage.from(MONTHLY_REPORTS_BUCKET).remove([target.storagePath]);
}
