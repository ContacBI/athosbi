import { ATHOS_STEPS } from "../lib/brand.js";

// O símbolo da Athos (os seis quadrados em degrau, ver lib/brand.js) — a
// "cara" do app no login, na tela inicial, no menu dos Parâmetros e na aba
// do navegador (public/favicon.svg).
// `animado`: os quadrados entram um a um, de baixo à esquerda até o topo,
// montando o degrau (animação em hub/hub.css, .athos-degrau).
const ORDEM_DE_MONTAR = ["7-39", "24-39", "40-39", "24-22", "40-22", "40-6"];

export default function AthosMark({ size = 64, className = "", animado = false, atraso = 0 }) {
  return (
    <svg viewBox="5 4 51 51" width={size} height={size} className={className} role="img" aria-label="Athos">
      {ATHOS_STEPS.map(([x, y, fill]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="15"
          height="15"
          rx="3"
          fill={fill}
          className={animado ? "athos-degrau" : undefined}
          style={animado ? { animationDelay: `${atraso + ORDEM_DE_MONTAR.indexOf(`${x}-${y}`) * 0.11}s` } : undefined}
        />
      ))}
    </svg>
  );
}
