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
export function attachJournalMonths(newEntries) {
  const months = new Set(monthsPresent(newEntries));
  if (!months.size) return [];
  const kept = state.journal.filter((entry) => !months.has(monthOf(entry)));
  setData({ journal: [...kept, ...newEntries] });
  persistActiveCompany();
  return [...months].sort();
}

export function removeJournalMonth(monthKey) {
  setData({ journal: state.journal.filter((entry) => monthOf(entry) !== monthKey) });
  persistActiveCompany();
}
