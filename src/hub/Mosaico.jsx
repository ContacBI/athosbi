import { useRef } from "react";

// O símbolo da Athos (seis quadrados em degrau, ver lib/brand.js) em
// tamanho de vitrine: uma grade de ladrilhos em que o degrau de baixo à
// direita acende nas cores da marca — mais claro em cima, mais fundo
// embaixo, igual à logo — e respira em onda na diagonal. Os outros
// ladrilhos piscam de leve, cada um no seu tempo. Inclina um pouco com o
// mouse. Sem animação para quem pediu menos movimento ao sistema (hub.css).

const PARADAS = [
  [0, [242, 138, 66]],
  [0.35, [231, 82, 32]],
  [1, [126, 52, 26]],
];

function corDoDegrau(t) {
  for (let i = 1; i < PARADAS.length; i += 1) {
    const [fim, b] = PARADAS[i];
    const [inicio, a] = PARADAS[i - 1];
    if (t <= fim) {
      const k = (t - inicio) / (fim - inicio || 1);
      return `rgb(${a.map((valor, j) => Math.round(valor + (b[j] - valor) * k)).join(",")})`;
    }
  }
  return `rgb(${PARADAS[PARADAS.length - 1][1].join(",")})`;
}

// Ladrilhos de uma grade colunas × linhas, com o degrau de `degraus`
// ladrilhos de lado encostado no canto de baixo à direita.
export function ladrilhosDoMosaico(colunas, linhas, degraus) {
  const lista = [];
  for (let linha = 0; linha < linhas; linha += 1) {
    for (let coluna = 0; coluna < colunas; coluna += 1) {
      const r = linha - (linhas - degraus);
      const c = coluna - (colunas - degraus);
      const noDegrau = r >= 0 && c >= 0 && c >= degraus - 1 - r;
      const t = noDegrau ? (r + (degraus - 1 - c)) / Math.max(1, 2 * (degraus - 1)) : 0;
      lista.push({
        chave: `${linha}-${coluna}`,
        linha,
        coluna,
        degrau: noDegrau,
        cor: noDegrau ? corDoDegrau(t) : null,
        // Onda na diagonal pros degraus; pros outros, um tempo "aleatório" fixo por posição.
        atraso: noDegrau ? (linha + coluna) * 0.22 : ((linha * 7 + coluna * 13) % 23) * 0.31,
      });
    }
  }
  return lista;
}

// `icones`: { "linha-coluna": ÍconeLucide } — ladrilhos fora do degrau que
// mostram um ícone (as áreas do hub, na abertura).
export default function Mosaico({ colunas = 6, linhas = 6, degraus = 4, icones = {}, className = "" }) {
  const grade = useRef(null);
  const ladrilhos = ladrilhosDoMosaico(colunas, linhas, degraus);

  function inclinar(event) {
    const el = grade.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const caixa = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - caixa.left) / caixa.width - 0.5;
    const y = (event.clientY - caixa.top) / caixa.height - 0.5;
    el.style.transform = `rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg)`;
  }
  function endireitar() {
    if (grade.current) grade.current.style.transform = "";
  }

  return (
    <div className={`[perspective:1100px] ${className}`} onPointerMove={inclinar} onPointerLeave={endireitar} aria-hidden="true">
      <div ref={grade} className="hub-mosaico" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {ladrilhos.map((ladrilho) => {
          if (ladrilho.degrau) return <span key={ladrilho.chave} className="hub-ladrilho hub-ladrilho-degrau" style={{ "--cor": ladrilho.cor, "--atraso": `${ladrilho.atraso}s` }} />;
          const Icone = icones[ladrilho.chave];
          if (Icone)
            return (
              <span key={ladrilho.chave} className="hub-ladrilho hub-ladrilho-icone">
                <Icone strokeWidth={1.7} />
              </span>
            );
          return <span key={ladrilho.chave} className="hub-ladrilho" style={{ "--atraso": `${ladrilho.atraso}s` }} />;
        })}
      </div>
    </div>
  );
}
