import { Fragment, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { bridgeSentence } from "../lib/cashBridge.js";
import { money } from "../lib/format.js";

// A cascata da "Ponte do lucro ao caixa" (lib/cashBridge.js): o lucro no
// começo, cada etapa somando ou tirando, "Caixa da operação" no meio e a
// variação do caixa no fim. Usada no B.I. (compacta), na tela da DFC
// (completa, com a tabela) e nos slides.

const compactMoney = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return n.toFixed(0);
};

export function bridgeChartData(bridge) {
  let running = 0;
  return (bridge?.items || []).map((item) => {
    if (item.type === "start" || item.type === "subtotal" || item.type === "total") {
      running = item.value;
      return { ...item, label: item.short || item.name, base: Math.min(0, item.value), bar: Math.abs(item.value), raw: item.value, isTotal: true };
    }
    const from = running;
    running += item.value;
    return { ...item, label: item.short || item.name, base: Math.min(from, running), bar: Math.abs(item.value), raw: item.value, isTotal: false };
  });
}

function BridgeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="max-w-[280px] rounded-lg bg-surface-card px-3 py-2 text-[12px] shadow-lg ring-1 ring-line">
      <p className="font-semibold text-ink-900">{item.name}</p>
      <p className={`tabular-nums ${item.raw < 0 ? "text-danger-600" : "text-success-600"}`}>{money(item.raw)}</p>
      {item.help && <p className="mt-1 leading-snug text-ink-500">{item.help}</p>}
      {(item.detail || []).slice(0, 4).map((detail) => (
        <p key={detail.code} className="mt-0.5 flex justify-between gap-3 text-ink-600">
          <span className="truncate">{detail.name}</span>
          <span className="tabular-nums">{money(detail.effect)}</span>
        </p>
      ))}
    </div>
  );
}

export function CashBridgeChart({ bridge, height = 260, animate = true, fontSize = 10 }) {
  const data = bridgeChartData(bridge);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="label" tick={{ fontSize, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} interval={0} angle={-30} textAnchor="end" height={62} />
          <YAxis tick={{ fontSize: fontSize + 1, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<BridgeTooltip />} cursor={{ fill: "var(--color-surface-muted)" }} />
          <Bar dataKey="base" stackId="b" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="bar" stackId="b" radius={[3, 3, 0, 0]} isAnimationActive={animate}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.isTotal ? (entry.raw < 0 ? "var(--color-danger-600)" : "var(--color-navy-700)") : entry.raw < 0 ? "var(--color-danger-500)" : "var(--color-success-500)"} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Versão completa (tela da DFC): frase, cascata e a tabela com a
// explicação de cada etapa e os grupos do Balanço por trás dela.
export function CashBridgePanel({ bridge }) {
  const [open, setOpen] = useState(new Set());
  if (!bridge) return <p className="rounded-xl bg-surface-card p-6 text-center text-[13px] text-ink-400 shadow-sm">Sem balanço para montar a ponte neste período.</p>;
  const toggle = (id) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface-card p-5 shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-600">Do lucro ao caixa</p>
        <p className="cash-bridge-sentence mt-1 text-[16px] leading-snug text-ink-900">{bridgeSentence(bridge)}</p>
        <p className="mt-1 text-[12px] text-ink-400">
          Caixa de {money(bridge.caixaInicio)} no início e {money(bridge.caixaFim)} no fim do período. Montada pelo Balanço (saldo no início x no fim), por isso fecha exatamente com a variação do caixa.
        </p>
        <div className="mt-4">
          <CashBridgeChart bridge={bridge} height={320} fontSize={11} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-surface-card p-4 shadow-sm">
        <table className="cash-bridge-table w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-ink-400">
              <th className="py-2 text-left font-medium">Etapa</th>
              <th className="py-2 text-right font-medium">Efeito no caixa</th>
              <th className="py-2 pl-6 text-left font-medium">O que significa</th>
            </tr>
          </thead>
          <tbody>
            {bridge.items.map((item) => {
              const total = item.type !== "step";
              const hasDetail = (item.detail || []).length > 0;
              const isOpen = open.has(item.id);
              return (
                <Fragment key={item.id}>
                  <tr className={`${total ? "border-t border-line font-semibold text-ink-900" : "text-ink-700"} ${hasDetail ? "cursor-pointer hover:bg-surface-muted" : ""}`} onClick={() => hasDetail && toggle(item.id)}>
                    <td className="py-2">
                      <span className="flex items-center gap-1">
                        {hasDetail ? isOpen ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronRight size={14} className="text-ink-400" /> : <span className="w-[14px]" />}
                        {item.name}
                      </span>
                    </td>
                    <td className={`py-2 text-right tabular-nums ${item.value < -0.5 ? "text-danger-600" : item.value > 0.5 ? "text-success-600" : ""}`}>{money(item.value)}</td>
                    <td className="py-2 pl-6 text-[12px] font-normal text-ink-500">{item.help}</td>
                  </tr>
                  {isOpen &&
                    item.detail.map((detail) => (
                      <tr key={detail.code} className="text-[12px] text-ink-500">
                        <td className="py-1 pl-8">{detail.name}</td>
                        <td className="py-1 text-right tabular-nums">{money(detail.effect)}</td>
                        <td className="py-1 pl-6">
                          de {money(detail.start)} para {money(detail.end)} no Balanço
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!bridge.fecha && <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-[12px] text-warning-700">O balanço não fecha numa das pontas do período; a diferença aparece na etapa "Diferença do balanço". Confira as contas sem De/Para.</p>}
      </div>
    </div>
  );
}
