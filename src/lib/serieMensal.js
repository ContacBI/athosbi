// Rótulos e contas da série mês a mês de um número (aba "Evolução" da
// explicação no Início: components/GraficoEvolucao.jsx e ExplicaItem.jsx).

import { compactValue } from "./presentations.js";
import { fmtPct } from "./assistant/analysis.js";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

// Eixo e rótulos: "30 mil", "1,2 mi", "850", "21%".
export function valorCurto(valor, formato = "money") {
  if (valor == null || !Number.isFinite(valor)) return "—";
  if (formato === "percent") return `${Math.round(valor)}%`;
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "-" : "";
  if (abs >= 1e6) return `${sinal}${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${sinal}${(abs / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: abs >= 1e5 ? 0 : 1 })} mil`;
  return `${sinal}${Math.round(abs)}`;
}

export const valorCheio = (valor, formato = "money") => (valor == null ? "—" : formato === "percent" ? fmtPct(valor) : compactValue(valor, "money"));

// Variação de um valor pro outro: % (dinheiro) ou p.p. (percentuais).
export function variacaoEntre(antes, depois, formato = "money") {
  if (antes == null || depois == null) return null;
  if (formato === "percent") return { valor: depois - antes, texto: `${depois - antes >= 0 ? "+" : ""}${(depois - antes).toFixed(1).replace(".", ",")} p.p.` };
  if (Math.abs(antes) <= 0.5) return null;
  const pct = ((depois - antes) / Math.abs(antes)) * 100;
  return { valor: pct, texto: `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%` };
}
