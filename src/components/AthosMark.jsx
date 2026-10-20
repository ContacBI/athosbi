import { ATHOS_STEPS } from "../lib/brand.js";

// O símbolo da Athos (os seis quadrados em degrau, ver lib/brand.js) — a
// "cara" do app no login, na tela inicial, no menu dos Parâmetros e na aba
// do navegador (public/favicon.svg).
export default function AthosMark({ size = 64, className = "" }) {
  return (
    <svg viewBox="5 4 51 51" width={size} height={size} className={className} role="img" aria-label="Athos">
      {ATHOS_STEPS.map(([x, y, fill]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="15" height="15" rx="3" fill={fill} />
      ))}
    </svg>
  );
}
