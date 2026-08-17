import { state, setData } from "../data/useStore.js";
import { ACTIVE_COMPANY_KEY, ACTIVE_GROUP_KEY, GROUPS_KEY, writePersistent } from "./persistence.js";
import { persistActiveCompany } from "./companies.js";

function writeStoredGroups(groups) {
  return writePersistent(GROUPS_KEY, groups);
}

export function activeGroup() {
  if (!state.activeGroupId) return null;
  return state.groups.find((group) => group.id === state.activeGroupId) || null;
}

// Whatever's active right now, a single company or a group — for anywhere a
// report just needs a human name for its title/filename without caring
// which mode produced the data underneath it.
export function activeWorkspaceName() {
  if (state.activeGroupId) {
    const group = state.groups.find((item) => item.id === state.activeGroupId);
    return group?.name || "Grupo";
  }
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  return company?.name || "Empresa";
}

export function groupCompanies(group) {
  const ids = new Set(group?.companyIds || []);
  return state.companies.filter((company) => ids.has(company.id));
}

export function createGroup({ name, companyIds = [] }) {
  const groupName = String(name || "").trim();
  if (!groupName) return null;
  persistActiveCompany();
  const group = {
    id: `grp_${Date.now()}`,
    name: groupName,
    companyIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dashboardTabs: [],
    periodStart: "",
    periodEnd: "",
    hideNonOperatingResults: false,
    excludedNonOperatingCodes: [],
  };
  const groups = state.groups.concat(group);
  writeStoredGroups(groups);
  setData({ groups });
  return group;
}

export function updateGroup(id, { name, companyIds }) {
  const groups = state.groups.map((group) =>
    group.id === id
      ? {
          ...group,
          name: name !== undefined ? String(name || "").trim() || group.name : group.name,
          companyIds: companyIds !== undefined ? companyIds : group.companyIds,
          updatedAt: new Date().toISOString(),
        }
      : group
  );
  writeStoredGroups(groups);
  setData({ groups });
  // Membership changed on the group currently being viewed — rebuild its
  // merged dataset right away instead of waiting for the next selectGroup.
  if (state.activeGroupId === id) selectGroup(id, { skipPersist: true });
  return groups.find((group) => group.id === id) || null;
}

function freshTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Same deep-clone-with-fresh-ids helper as replicateDashboardTabs in
// companies.js (kept duplicated rather than shared — groups and companies
// are different enough elsewhere in this file that a shared import would
// buy little and risk coupling the two for no reason).
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

// The group-mode counterpart of replicateDashboardTabs (companies.js) — use
// one group's consolidated workspace as the model and push it onto other
// groups. Same full-replace semantics: whatever the target groups had gets
// overwritten, caller confirms with the user first.
export function replicateGroupDashboardTabs(sourceId, targetIds) {
  const source = state.groups.find((group) => group.id === sourceId);
  if (!source) return 0;
  const targetSet = new Set(targetIds);
  targetSet.delete(sourceId);
  if (!targetSet.size) return 0;

  let applied = 0;
  const groups = state.groups.map((group) => {
    if (!targetSet.has(group.id)) return group;
    applied += 1;
    return { ...group, dashboardTabs: cloneDashboardTabs(source.dashboardTabs), updatedAt: new Date().toISOString() };
  });
  writeStoredGroups(groups);
  setData({ groups });

  if (targetSet.has(state.activeGroupId)) {
    const updated = groups.find((group) => group.id === state.activeGroupId);
    setData({ dashboardTabs: updated?.dashboardTabs || [] });
  }
  return applied;
}

export function deleteGroup(id) {
  const groups = state.groups.filter((group) => group.id !== id);
  writeStoredGroups(groups);
  setData({ groups });
  if (state.activeGroupId === id) {
    localStorage.removeItem(ACTIVE_GROUP_KEY);
    setData({ activeGroupId: "", accounts: [], journal: [], mappings: [], dashboardTabs: [] });
  }
}

// Every ledger account / mapping row is keyed by `classificacao` — a code
// meaningful only inside its own company's chart of accounts. Two different
// companies can (and do) reuse the same code for two unrelated real
// accounts, so concatenating them as-is would silently collide entries from
// different companies onto one row. Namespacing with the company id keeps
// every row unique across the whole group, while leaving the already-
// standardized managerial fields (`codigo_gerencial` / `categoria_gerencial`
// / `demonstrativo` / `grupo_macro` — the one shared plano gerencial every
// company maps into) completely untouched, since those are what the
// consolidated report actually aggregates on.
function namespaced(companyId, classificacao) {
  return `${companyId}::${classificacao}`;
}

function buildGroupDataset(companies) {
  const accounts = [];
  const journal = [];
  const mappings = [];
  companies.forEach((company) => {
    (company.accounts || []).forEach((account) => {
      accounts.push({
        ...account,
        classificacao: namespaced(company.id, account.classificacao),
        companyId: company.id,
        companyName: company.name,
      });
    });
    (company.mappings || []).forEach((mapping) => {
      mappings.push({ ...mapping, classificacao: namespaced(company.id, mapping.classificacao) });
    });
    (company.journal || []).forEach((entry) => {
      journal.push({
        ...entry,
        classificacao: namespaced(company.id, entry.classificacao),
        companyId: company.id,
        companyName: company.name,
      });
    });
  });
  return { accounts, journal, mappings };
}

// The group-mode equivalent of selectCompany: loads a synthetic, merged
// "company" — every member's accounts/journal/mappings combined — into the
// same global state slots every report already reads from. This is what
// lets Resumo, Demonstrativos, DFC, Indicadores etc. all work unmodified in
// group mode: as far as they can tell, it's just one company with a lot of
// lançamentos. Group mode is intentionally read-only on the source data —
// there's no single company's chart to edit De/Para against — so Relatórios
// mensais / De/Para stay off the group's nav; only its own Resumo/
// Demonstrativos workspace (period, tabs) is editable and saved back onto
// the group record itself (see persistActiveGroupWorkspace in companies.js).
export function selectGroup(id, { skipPersist = false } = {}) {
  if (!skipPersist) persistActiveCompany();
  const group = state.groups.find((item) => item.id === id);
  if (!group) return;
  localStorage.setItem(ACTIVE_GROUP_KEY, id);
  localStorage.removeItem(ACTIVE_COMPANY_KEY);
  const companies = groupCompanies(group);
  const { accounts, journal, mappings } = buildGroupDataset(companies);
  setData({
    activeGroupId: id,
    activeCompanyId: "",
    accounts,
    journal,
    mappings,
    periodStart: group.periodStart || "",
    periodEnd: group.periodEnd || "",
    hideNonOperatingResults: Boolean(group.hideNonOperatingResults),
    excludedNonOperatingCodes: group.excludedNonOperatingCodes || [],
    dashboardTabs: group.dashboardTabs || [],
    selectedLine: null,
    selectedAccount: null,
    expandedLines: new Set(),
  });
}
