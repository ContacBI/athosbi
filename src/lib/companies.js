import { state, setData } from "../data/useStore.js";
import {
  COMPANIES_KEY,
  ACTIVE_COMPANY_KEY,
  GROUPS_KEY,
  ACTIVE_GROUP_KEY,
  readStoredArray,
  writePersistent,
} from "./persistence.js";
import { DEFAULT_NATURE_RULES } from "./accountNature.js";
import { supabase, MONTHLY_REPORTS_BUCKET } from "./supabaseClient.js";

function writeStoredCompanies(companies) {
  return writePersistent(COMPANIES_KEY, companies);
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
export async function loadCompanies() {
  const companies = await readStoredArray(COMPANIES_KEY);
  const groups = await readStoredArray(GROUPS_KEY);
  const storedGroupId = localStorage.getItem(ACTIVE_GROUP_KEY);
  const groupValid = Boolean(storedGroupId) && groups.some((group) => group.id === storedGroupId);
  setData({ companies, groups, activeCompanyId: "", activeGroupId: "" });
  if (groupValid) return { groupId: storedGroupId };
  const activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY) || companies[0]?.id || "";
  if (activeCompanyId) selectCompany(activeCompanyId, { skipPersist: true });
  return { groupId: null };
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

export function selectCompany(id, { skipPersist = false } = {}) {
  if (!skipPersist) persistActiveCompany();
  const company = state.companies.find((item) => item.id === id);
  if (!company) return;
  localStorage.setItem(ACTIVE_COMPANY_KEY, id);
  localStorage.removeItem(ACTIVE_GROUP_KEY);
  setData({
    activeCompanyId: id,
    activeGroupId: "",
    mappings: company.mappings || [],
    accounts: company.accounts || [],
    journal: remapJournal(company.journal || [], company.mappings || []),
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
export function replicateDashboardTabs(sourceId, targetIds) {
  const source = state.companies.find((company) => company.id === sourceId);
  if (!source) return 0;
  const sourceTabs = migrateDashboardTabs(source);
  const targetSet = new Set(targetIds);
  targetSet.delete(sourceId);
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

export function deleteCompany(id) {
  const companies = state.companies.filter((company) => company.id !== id);
  writeStoredCompanies(companies);
  const nextActive = state.activeCompanyId === id ? companies[0]?.id || "" : state.activeCompanyId;
  setData({ companies });
  if (state.activeCompanyId === id) {
    if (nextActive) selectCompany(nextActive, { skipPersist: true });
    else setData({ activeCompanyId: "", mappings: [], accounts: [], journal: [] });
  }
}

export async function importBackupFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const companies = Array.isArray(payload.companies) ? payload.companies : [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  writeStoredCompanies(companies);
  writeStoredGroups(groups);
  const activeCompanyId = payload.activeCompanyId && companies.some((company) => company.id === payload.activeCompanyId)
    ? payload.activeCompanyId
    : companies[0]?.id || "";
  localStorage.setItem(ACTIVE_COMPANY_KEY, activeCompanyId);
  localStorage.removeItem(ACTIVE_GROUP_KEY);
  setData({ companies, groups, activeCompanyId, activeGroupId: "" });
  if (activeCompanyId) selectCompany(activeCompanyId, { skipPersist: true });
  return companies.length;
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
