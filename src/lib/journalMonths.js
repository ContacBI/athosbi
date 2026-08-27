import { state, setData } from "../data/useStore.js";
import { persistActiveCompany } from "./companies.js";

export function monthOf(entry) {
  return String(entry?.data || "").slice(0, 7);
}

export function monthsPresent(entries) {
  return [...new Set((entries || []).map(monthOf).filter(Boolean))].sort();
}

// Every "YYYY-MM" that currently has at least one lançamento imported.
export function journalMonthsPresent() {
  return new Set(monthsPresent(state.journal));
}

export function journalCountForMonth(monthKey) {
  return state.journal.filter((entry) => monthOf(entry) === monthKey).length;
}

// Replaces whichever months are present in `newEntries` — any existing
// lançamentos for those exact months are dropped first, so importing (or
// re-importing) a diário file only ever touches the month(s) it actually
// covers, leaving every other already-imported month untouched. This is
// what makes "só refazer o mês 6" possible instead of forcing a full
// re-import of everything every time one month needs a correction.
//
// Awaits the real Supabase write and THROWS if it ultimately failed (after
// its internal retries) — and, critically, rolls the in-memory journal back
// to what it was before this call. Without that rollback the UI would keep
// showing the newly-imported month as if it were there (state.journal
// already has it) even though the server never got it, so a refresh would
// silently wipe it back out — exactly the bug this was written to close.
// Callers MUST await this and show the user a real error on failure; never
// fire-and-forget it again.
export async function attachJournalMonths(newEntries) {
  const months = new Set(monthsPresent(newEntries));
  if (!months.size) return [];
  const previous = state.journal;
  const kept = previous.filter((entry) => !months.has(monthOf(entry)));
  setData({ journal: [...kept, ...newEntries] });
  try {
    await persistActiveCompany();
  } catch (error) {
    setData({ journal: previous });
    throw error;
  }
  return [...months].sort();
}

// Same contract as attachJournalMonths above: awaits the real write, rolls
// the optimistic local removal back and rethrows if it didn't actually
// persist. Accepts one or several month keys so a bulk "excluir
// selecionados" does a single setData + single Supabase write instead of
// racing several independent persistActiveCompany() calls against each
// other (each of which would have serialized the FULL company/journal at
// whatever half-deleted point it happened to run).
export async function removeJournalMonths(monthKeys) {
  const keys = new Set(Array.isArray(monthKeys) ? monthKeys : [monthKeys]);
  if (!keys.size) return;
  const previous = state.journal;
  const next = previous.filter((entry) => !keys.has(monthOf(entry)));
  setData({ journal: next });
  try {
    await persistActiveCompany();
  } catch (error) {
    setData({ journal: previous });
    throw error;
  }
}

export async function removeJournalMonth(monthKey) {
  return removeJournalMonths([monthKey]);
}
