import { useEffect, useState } from "react";

// "Instalar no celular": no Android/Chrome o navegador entrega um aviso
// (beforeinstallprompt, guardado em main.jsx) que abre a instalação; no
// iPhone não existe esse aviso — o jeito é Compartilhar → "Adicionar à Tela
// de Início", então o botão mostra esse passo a passo.

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstallApp() {
  const [prompt, setPrompt] = useState(() => (typeof window !== "undefined" ? window.__athosInstallPrompt || null : null));
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const ready = () => setPrompt(window.__athosInstallPrompt || null);
    const done = () => {
      window.__athosInstallPrompt = null;
      setPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("athos-install-ready", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("athos-install-ready", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) return "manual";
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    window.__athosInstallPrompt = null;
    setPrompt(null);
    if (choice?.outcome === "accepted") setInstalled(true);
    return choice?.outcome || "dismissed";
  }
  return { installed, canPrompt: Boolean(prompt), ios: isIos(), install };
}

// No celular o início da empresa abre o resumo (/empresa/celular). Quem
// toca em "Painel completo" fica no painel até fechar o navegador.
const FULL_PANEL_KEY = "athosbi.painelCompleto";

export function prefersFullPanel() {
  try {
    return sessionStorage.getItem(FULL_PANEL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPrefersFullPanel(flag) {
  try {
    if (flag) sessionStorage.setItem(FULL_PANEL_KEY, "1");
    else sessionStorage.removeItem(FULL_PANEL_KEY);
  } catch {
    // sem sessionStorage (aba anônima restrita): segue sem lembrar
  }
}
