import { useEffect, useState } from "react";

// Compartilhado por qualquer tela que precise de um layout diferente no
// celular (grade de widgets vira coluna única, barra de topo vira menu
// compacto etc.) em vez de depender só de classes responsivas do Tailwind —
// útil quando a decisão não é só CSS (ex.: mudar `cols` do react-grid-layout,
// que precisa de um número em JS, não dá pra fazer só com media query CSS).
export function useIsMobile(breakpointPx = 768) {
  const query = `(max-width: ${breakpointPx - 1}px)`;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpointPx]);

  return isMobile;
}
