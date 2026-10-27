import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { fmtDelta } from "../lib/assistant/analysis.js";

// A variação de um número contra o período de comparação (seta + texto),
// verde quando melhorou e vermelho quando piorou — no resumo do celular e
// nos cartões do Início. `dark`: sobre fundo escuro.
export default function DeltaPill({ metric, invert = false, dark = false }) {
  if (!metric || metric.delta == null || !Number.isFinite(metric.delta)) return null;
  const text = fmtDelta(metric);
  if (!text) return null;
  const flat = Math.abs(metric.delta) < 0.05;
  const good = invert ? !metric.better : metric.better;
  const Icon = metric.delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ${
        dark ? `bg-white/15 ${flat ? "text-white/70" : good ? "text-[#7fe3bd]" : "text-[#ffb3a9]"}` : flat ? "bg-surface-muted text-ink-500" : good ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-700"
      }`}
    >
      {!flat && <Icon size={11} strokeWidth={2.4} />}
      {text}
    </span>
  );
}
