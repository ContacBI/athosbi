import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { buildDfcDirect, buildDfcIndirect } from "../data/calculations.js";
import { money } from "../lib/format.js";

function DfcTable({ rows, mode }) {
  let lastGroup = "";
  return <div className="overflow-hidden rounded-xl bg-surface-card shadow-sm"><div className="flex items-center justify-between border-b border-line bg-surface-muted px-4 py-3"><div><h1 className="text-[18px] font-semibold text-ink-900">DFC {mode === "direct" ? "direta" : "indireta"}</h1><p className="mt-0.5 text-[12px] text-ink-400">{mode === "direct" ? "Fluxos classificados pelos movimentos de caixa." : "Resultado ajustado pelas variações do capital de giro."}</p></div><span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-medium text-accent-700">{rows.length} linhas</span></div><div className="max-h-[68vh] overflow-y-auto">{rows.map((row) => { const group = row.grupo_macro || "Outros"; const first = group !== lastGroup; lastGroup = group; const subtotal = row.natureza === "subtotal"; const heading = row.natureza === "heading"; return <div key={row.codigo_gerencial}>{first && !heading && <p className="border-b border-line bg-surface-muted px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">{group}</p>}<div className={`flex items-center justify-between gap-4 border-b border-line px-4 py-2.5 ${subtotal ? "bg-accent-50 font-semibold" : heading ? "bg-surface-muted font-semibold" : ""}`}><span className="min-w-0 text-[13px] text-ink-800">{row.categoria_gerencial}</span><span className={`shrink-0 tabular-nums text-[13px] ${row.saldo < 0 ? "text-danger-600" : "text-ink-900"}`}>{money(row.saldo)}</span></div></div>; })}{rows.length === 0 && <p className="px-4 py-12 text-center text-[13px] text-ink-400">Não há movimentos para o período selecionado.</p>}</div></div>;
}

export default function Dfc({ lockedMode } = {}) {
  useAppState();
  const [mode, setMode] = useState(lockedMode || "direct");
  const rows = mode === "direct" ? buildDfcDirect() : buildDfcIndirect();
  return <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">{!lockedMode && <div className="inline-flex w-fit rounded-full bg-surface-muted p-1"><button type="button" onClick={() => setMode("direct")} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${mode === "direct" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}><ArrowDownToLine size={14} />DFC direta</button><button type="button" onClick={() => setMode("indirect")} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${mode === "indirect" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}><ArrowUpFromLine size={14} />DFC indireta</button></div>}<DfcTable rows={rows} mode={mode} /></div>;
}
