import { useEffect, useState } from "react";

const STORAGE_KEY = "biperformance.theme";

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "light";
  } catch {
    return "light";
  }
}

// A blocking inline script in index.html already stamps this onto <html>
// before first paint (avoids a flash of the wrong theme) — this module
// just needs to agree with whatever it landed on.
let currentTheme = readStoredTheme();
const listeners = new Set();

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Privado/bloqueado — o tema ainda funciona pra essa sessão, só não persiste.
  }
  listeners.forEach((listener) => listener(theme));
}

// Plain module-level pub/sub instead of a Context provider — the toggle
// button shows up in three unrelated chrome components (Landing,
// ParametrosSidebar, CompanyTopBar) that don't share a common wrapper
// close to the root, so a Context would need to sit at the very top of
// App.jsx anyway for no real benefit over this.
export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    listeners.add(setTheme);
    return () => listeners.delete(setTheme);
  }, []);
  function toggleTheme() {
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  }
  return [theme, toggleTheme];
}
