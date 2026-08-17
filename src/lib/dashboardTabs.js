import { state, setData } from "../data/useStore.js";
import { persistActiveCompany } from "./companies.js";

function makeTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createTab(name = "Nova aba") {
  const tab = { id: makeTabId(), name, widgets: [] };
  setData({ dashboardTabs: [...(state.dashboardTabs || []), tab] });
  persistActiveCompany();
  return tab;
}

export function updateTab(id, patch) {
  setData({
    dashboardTabs: (state.dashboardTabs || []).map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
  });
  persistActiveCompany();
}

export function deleteTab(id) {
  setData({ dashboardTabs: (state.dashboardTabs || []).filter((tab) => tab.id !== id) });
  persistActiveCompany();
}

export function reorderTab(id, direction) {
  const tabs = [...(state.dashboardTabs || [])];
  const index = tabs.findIndex((tab) => tab.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= tabs.length) return;
  [tabs[index], tabs[target]] = [tabs[target], tabs[index]];
  setData({ dashboardTabs: tabs });
  persistActiveCompany();
}

// A tab is either a flat canvas (its own `widgets`) or a container of
// sub-tabs — never both. The first time a sub-tab is created, whatever was
// already on the tab's own canvas gets carried over as a "Geral" sub-tab
// instead of silently disappearing.
export function createSubTab(tabId, name = "Nova subaba") {
  const newSub = { id: makeTabId(), name, widgets: [] };
  setData({
    dashboardTabs: (state.dashboardTabs || []).map((tab) => {
      if (tab.id !== tabId) return tab;
      const existing = tab.subTabs || [];
      const migrated =
        existing.length === 0 && (tab.widgets || []).length > 0
          ? [{ id: makeTabId(), name: "Geral", widgets: tab.widgets }]
          : existing;
      return { ...tab, subTabs: [...migrated, newSub] };
    }),
  });
  persistActiveCompany();
  return newSub;
}

export function updateSubTab(tabId, subId, patch) {
  setData({
    dashboardTabs: (state.dashboardTabs || []).map((tab) =>
      tab.id === tabId
        ? { ...tab, subTabs: (tab.subTabs || []).map((sub) => (sub.id === subId ? { ...sub, ...patch } : sub)) }
        : tab
    ),
  });
  persistActiveCompany();
}

export function deleteSubTab(tabId, subId) {
  setData({
    dashboardTabs: (state.dashboardTabs || []).map((tab) =>
      tab.id === tabId ? { ...tab, subTabs: (tab.subTabs || []).filter((sub) => sub.id !== subId) } : tab
    ),
  });
  persistActiveCompany();
}

export function reorderSubTab(tabId, subId, direction) {
  setData({
    dashboardTabs: (state.dashboardTabs || []).map((tab) => {
      if (tab.id !== tabId) return tab;
      const subs = [...(tab.subTabs || [])];
      const index = subs.findIndex((sub) => sub.id === subId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= subs.length) return tab;
      [subs[index], subs[target]] = [subs[target], subs[index]];
      return { ...tab, subTabs: subs };
    }),
  });
  persistActiveCompany();
}
