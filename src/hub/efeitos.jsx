import { useEffect, useRef } from "react";

// Bloco que entra suave (sobe e aparece) quando chega na tela — uma vez só.
export function Revelar({ as: Tag = "div", atraso = 0, className = "", style, children, ...resto }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("hub-revelado");
      return undefined;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          el.classList.add("hub-revelado");
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`hub-revelar ${className}`} style={{ "--atraso": `${atraso}s`, ...style }} {...resto}>
      {children}
    </Tag>
  );
}

// Seção de página: rótulo pequeno, título com a palavra em itálico laranja
// e, à direita, uma ação opcional. `id` vira âncora (o índice "Nesta
// página" da Reforma), descontando a altura do topo fixo.
export function Secao({ id, rotulo, titulo, italico, depois = "", acao, children, className = "" }) {
  return (
    <section id={id} className={`mx-auto hub-largura scroll-mt-24 px-5 sm:px-8 ${className}`}>
      <Revelar className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="hub-rotulo">{rotulo}</p>
          <h2 className="hub-display mt-3 text-[30px] font-bold leading-[1.08] sm:text-[40px]">
            {titulo} {italico && <span className="hub-italico">{italico}</span>}
            {depois && <span className="hub-pontuacao">{depois}</span>}
          </h2>
        </div>
        {acao}
      </Revelar>
      {children}
    </section>
  );
}

// A luz que acompanha o mouse dentro de um .hub-cartao.
export function moverLuz(event) {
  const caixa = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--mx", `${event.clientX - caixa.left}px`);
  event.currentTarget.style.setProperty("--my", `${event.clientY - caixa.top}px`);
}
