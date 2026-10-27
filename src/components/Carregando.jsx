import { ATHOS_STEPS } from "../lib/brand.js";

// Carregando com a cara da Athos: os seis quadrados do símbolo se montam em
// degrau (de baixo pra cima) e somem juntos, em loop, com uma barra correndo
// embaixo. Animação em index.css (.athos-degrau / .athos-barra) — parada pra
// quem pede menos movimento no sistema.
//  - tela: ocupa a tela toda (abrir o portal);
//  - escuro: fundo azul-marinho (apresentação);
//  - compacto: uma linha só, pra dentro de um cartão ou lista.

// Ordem em que os quadrados aparecem: a base da esquerda pra direita, depois
// subindo o degrau.
const ORDEM = ["7-39", "24-39", "40-39", "24-22", "40-22", "40-6"];

export function MarcaAnimada({ size = 56, className = "" }) {
  return (
    <svg viewBox="5 4 51 51" width={size} height={size} className={className} aria-hidden="true">
      {ATHOS_STEPS.map(([x, y, fill]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="15"
          height="15"
          rx="3"
          fill={fill}
          className="athos-degrau"
          style={{ animationDelay: `${ORDEM.indexOf(`${x}-${y}`) * 0.11}s` }}
        />
      ))}
    </svg>
  );
}

export function BarraCorrendo({ escuro = false, className = "" }) {
  return (
    <div className={`h-1 w-40 overflow-hidden rounded-full ${escuro ? "bg-white/10" : "bg-surface-muted"} ${className}`}>
      <div className="athos-barra h-full w-2/5 rounded-full bg-accent-500" />
    </div>
  );
}

export default function Carregando({ texto = "Carregando…", tela = false, escuro = false, compacto = false, className = "" }) {
  if (compacto) {
    return (
      <div role="status" aria-live="polite" className={`flex items-center gap-2.5 text-[13px] text-ink-400 ${className}`}>
        <MarcaAnimada size={18} />
        <span>{texto}</span>
      </div>
    );
  }
  const fundo = escuro ? "bg-[#081d33] text-white/70" : tela ? "bg-surface-page text-ink-500" : "text-ink-500";
  return (
    <div role="status" aria-live="polite" className={`flex ${tela || escuro ? "h-screen" : "h-[60vh]"} flex-col items-center justify-center gap-5 px-6 ${fundo} ${className}`}>
      <MarcaAnimada size={tela || escuro ? 64 : 48} />
      <div className="flex flex-col items-center gap-3">
        <p className="text-[13px] tracking-wide">{texto}</p>
        <BarraCorrendo escuro={escuro} />
      </div>
    </div>
  );
}
