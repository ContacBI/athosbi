import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// Lets whatever page is currently on screen (Resumo, Demonstrativos, a
// custom tab...) tell the persistent top bar what "download" means right
// now. The top bar never knows about reports/widgets/rows itself — it just
// renders a "Baixar" button that calls whichever {pdf, excel} pair is
// currently registered, so downloading always exports whatever the user is
// actually looking at.
const PageActionsContext = createContext(null);

export function PageActionsProvider({ children }) {
  const [downloadHandlers, setDownloadHandlers] = useState(null);
  const value = useMemo(() => ({ downloadHandlers, setDownloadHandlers }), [downloadHandlers]);
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>;
}

export function usePageActions() {
  return useContext(PageActionsContext);
}

// Call with `{ pdf, excel }` (functions with no args) while a page has
// something exportable, or with `null`/`undefined` while it doesn't (no
// data yet, an empty tab, a chart-only view...). Registration is scoped to
// the calling component's lifetime — unmounting (or passing null) clears it
// automatically, so switching tabs/screens never leaves a stale handler
// pointing at content that's no longer on screen.
//
// `handlers` is expected to be a fresh object every render (callers close
// over live state). The effect below keys off `setDownloadHandlers` itself
// (a useState setter — guaranteed referentially stable by React for the
// component's whole lifetime) and the boolean `hasHandlers`, never off the
// `handlers`/`ctx` objects — those change every render (`ctx` even changes
// *because* this effect calls setDownloadHandlers), so depending on them
// would re-fire the effect every render and loop forever. A ref always
// hands the top bar the latest pdf/excel functions without needing to
// re-register when they change.
export function useDownloadHandlers(handlers) {
  const ctx = usePageActions();
  const setDownloadHandlers = ctx?.setDownloadHandlers;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const hasHandlers = Boolean(handlers);

  useEffect(() => {
    if (!setDownloadHandlers || !hasHandlers) return undefined;
    const proxy = {
      pdf: handlersRef.current?.pdf ? () => handlersRef.current.pdf() : undefined,
      excel: handlersRef.current?.excel ? () => handlersRef.current.excel() : undefined,
    };
    setDownloadHandlers(proxy);
    return () => setDownloadHandlers((current) => (current === proxy ? null : current));
  }, [setDownloadHandlers, hasHandlers]);
}
