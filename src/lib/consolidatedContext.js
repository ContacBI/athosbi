import { state } from "../data/useStore.js";
import { buildDashboardContext } from "./dashboardData.js";

// B.I. is a global screen — it isn't inside any one company's workspace, so
// there's no "active company" ledger to preview against. Instead we
// temporarily point the calculation engine at every company's ledger
// merged together (journal entries already carry each company's own
// resolved codigo_gerencial, so no re-mapping is needed) and run the exact
// same buildDashboardContext() the rest of the app uses. Mutates `state`
// directly and restores it synchronously — same pattern as rowsForPeriod()
// in periodCompare.js — so nothing else ever observes the swap.
export function buildConsolidatedContext() {
  const original = {
    accounts: state.accounts,
    journal: state.journal,
    mappings: state.mappings,
    periodStart: state.periodStart,
    periodEnd: state.periodEnd,
  };

  const mergedAccounts = [];
  const mergedJournal = [];
  const mergedMappings = [];
  state.companies.forEach((company) => {
    mergedAccounts.push(...(company.accounts || []));
    mergedJournal.push(...(company.journal || []));
    mergedMappings.push(...(company.mappings || []));
  });

  state.accounts = mergedAccounts;
  state.journal = mergedJournal;
  state.mappings = mergedMappings;
  state.periodStart = "";
  state.periodEnd = "";

  try {
    return buildDashboardContext();
  } finally {
    state.accounts = original.accounts;
    state.journal = original.journal;
    state.mappings = original.mappings;
    state.periodStart = original.periodStart;
    state.periodEnd = original.periodEnd;
  }
}
