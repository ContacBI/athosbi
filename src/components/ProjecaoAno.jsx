import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Copy, Telescope } from "lucide-react";
import { contextForPeriod } from "../lib/assistant/context.js";
import { PROJECTION_HEADLINE, PROJECTION_METHODS, compactMoneyPt, projectYear, projectionSentence, projectionSettings } from "../lib/projecao.js";
import { setData, state } from "../data/useStore.js";
import { persistActiveCompany } from "../lib/companies.js";
import { monthShort } from "../lib/budget.js";
import { money } from "../lib/format.js";

// Aba "Projeção do ano" do Orçamento (ver lib/projecao.js): realizado dos
// meses fechados + estimativa dos que faltam, com faixa e frase pronta.

const whole = (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const LOOKBACKS = [
  { id: 3, label: "3 meses" },
  { id: 6, label: "6 meses" },
  { id: 0, label: "O ano todo" },
];

// O método fica no cadastro da empresa: o card do B.I. e o assistente usam
// o mesmo (ver projectionSettings em lib/projecao.js).
function remember(next) {
  if (state.activeGroupId || !state.activeCompanyId) return;
  const companies = state.companies.map((company) => (company.id === state.activeCompanyId ? { ...company, projecao: { ...projectionSettings(), ...next } } : company));
  setData({ companies });
  persistActiveCompany();
}

export default function ProjecaoAno({ ano, ctx, list, empresa, canEdit = false }) {
  const [method, setMethodState] = useState(() => projectionSettings().method);
  const [lookback, setLookbackState] = useState(() => projectionSettings().lookback);
  const setMethod = (value) => {
    setMethodState(value);
    if (canEdit) remember({ method: value });
  };
  const setLookback = (value) => {
    setLookbackState(value);
    if (canEdit) remember({ lookback: value });
  };
  const [copied, setCopied] = useState(false);
  const [prev, setPrev] = useState(null);

  // O ano anterior (para a sazonalidade e a comparação) fora do clique.
  useEffect(() => {
    const handle = setTimeout(() => setPrev({ ano, ctx: contextForPeriod(`${ano - 1}-01-01`, `${ano - 1}-12-31`) }), 40);
    return () => clearTimeout(handle);
  }, [ano]);
  const prevCtx = prev?.ano === ano ? prev.ctx : null;

  const projection = useMemo(() => (ctx ? projectYear({ ano, ctx, prevCtx, budgets: list, method, lookback }) : null), [ano, ctx, prevCtx, list, method, lookback]);
  const sentence = projection ? projectionSentence(projection, { empresa }) : "";

  if (!projection) return <p className="py-16 text-center text-[13px] text-ink-400">Calculando o realizado de {ano}…</p>;

  const { receita, resultado, caixa, last, remaining } = projection;
  const hasBudgetColumn = projection.lines.some((line) => line.orcado != null);
  const hasPrevColumn = projection.lines.some((line) => line.anoAnterior != null);
  const lastLabel = last ? monthShort(last) : "";
  const restLabel = remaining.length ? `${monthShort(remaining[0])}${remaining.length > 1 ? ` a ${monthShort(remaining[remaining.length - 1])}` : ""}` : "";

  async function copySentence() {
    try {
      await navigator.clipboard.writeText(sentence);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie a frase:", sentence);
    }
  }

  if (!projection.method) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-card px-6 py-14 text-center">
        <Telescope size={26} className="text-ink-300" />
        <p className="text-[14px] font-medium text-ink-800">Ainda não dá para projetar {ano}</p>
        <p className="max-w-md text-[13px] text-ink-500">A projeção precisa de pelo menos um mês fechado com lançamento, ou de um orçamento de {ano} para os meses que faltam.</p>
      </div>
    );
  }

  return (
    <div className="projecao flex flex-col gap-4">
      {!projection.finished && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 md:grid-cols-3">
            {Object.entries(PROJECTION_METHODS).map(([id, info]) => {
              const active = projection.method === id;
              const enabled = projection.available[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setMethod(id)}
                  title={enabled ? "" : projection.unavailable[id]}
                  className={`projecao-metodo rounded-xl px-3.5 py-2.5 text-left ring-1 transition-colors disabled:cursor-not-allowed ${active ? "bg-accent-50 ring-2 ring-accent-500" : enabled ? "bg-surface-card ring-line hover:bg-surface-muted" : "bg-surface-muted/50 ring-line"}`}
                >
                  <span className={`block text-[13px] font-semibold ${enabled ? "text-ink-900" : "text-ink-400"}`}>{info.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">
                    {!enabled
                      ? projection.unavailable[id]
                      : id === "media"
                        ? "Repete a média mensal dos meses fechados mais recentes."
                        : id === "sazonal"
                          ? `Repete ${ano - 1} nos meses que faltam${projection.growth ? `, corrigido pelo crescimento de ${((projection.growth - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0, signDisplay: "always" })}%` : ""}.`
                          : `Usa o orçamento ${projection.budget?.versao ? `“${projection.budget.versao}” ` : ""}nos meses que faltam.`}
                  </span>
                </button>
              );
            })}
          </div>
          {projection.method === "media" && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
              <span>Média de:</span>
              <div className="inline-flex rounded-lg bg-surface-muted p-0.5">
                {LOOKBACKS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setLookback(item.id)} className={`projecao-janela rounded-md px-2.5 py-1 font-medium ${lookback === item.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sentence && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-accent-50 px-4 py-3">
          <p className="projecao-frase text-[13.5px] leading-relaxed text-ink-800">{sentence}</p>
          <button type="button" onClick={copySentence} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-accent-700 hover:bg-accent-100" title="Copiar a frase para usar num e-mail ou slide">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiada" : "Copiar"}
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <ProjectionCard title={`Receita bruta em ${ano}`} item={receita} lastLabel={lastLabel} finished={projection.finished} />
        <ProjectionCard title={`Resultado líquido em ${ano}`} item={resultado} lastLabel={lastLabel} finished={projection.finished} signed />
        {caixa && (
          <div className="projecao-card rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
            <p className="text-[12px] font-medium text-ink-500">Caixa no fim de {ano}</p>
            <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-ink-900">{compactMoneyPt(caixa.provavel)}</p>
            {!projection.finished && Math.abs(caixa.otimista - caixa.pessimista) > 1 && (
              <p className="text-[11.5px] text-ink-500">
                entre {compactMoneyPt(caixa.pessimista)} e {compactMoneyPt(caixa.otimista)}
              </p>
            )}
            <p className="mt-2 border-t border-line pt-2 text-[11.5px] text-ink-400">
              Hoje ({monthShort(caixa.ate)}): {compactMoneyPt(caixa.atual)} · variação média de {compactMoneyPt(caixa.mediaMensal)}/mês
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <div className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
          <p className="text-[13px] font-medium text-ink-900">Resultado mês a mês e acumulado</p>
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projection.series.map((item) => ({ ...item, valor: item.realizado ?? item.projetado }))} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(value) => compactMoneyPt(value).replace("R$ ", "")} axisLine={false} tickLine={false} width={66} />
                <Tooltip
                  formatter={(value, name, entry) => [money(value), name === "acumulado" ? "Acumulado no ano" : entry?.payload?.realizado != null ? "Realizado no mês" : "Projetado no mês"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="valor" radius={[3, 3, 0, 0]} maxBarSize={30}>
                  {projection.series.map((item) => (
                    <Cell key={item.key} fill={item.realizado != null ? "var(--color-accent-500)" : "var(--color-accent-200)"} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="acumulado" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2.5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 flex flex-wrap justify-center gap-4 text-[11px] text-ink-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-accent-500" /> Realizado</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-accent-200" /> Projetado</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-navy-700" /> Acumulado no ano</span>
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
          <table className="projecao-tabela w-full min-w-[560px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-ink-400">
                <th className="py-1.5 text-left font-medium">Linha</th>
                <th className="py-1.5 text-right font-medium">{projection.finished ? "Realizado" : `Realizado${lastLabel ? ` até ${lastLabel}` : ""}`}</th>
                {!projection.finished && <th className="py-1.5 text-right font-medium">Projeção {restLabel}</th>}
                <th className="py-1.5 text-right font-semibold text-ink-600">Ano {projection.finished ? "" : "projetado"}</th>
                {hasBudgetColumn && <th className="py-1.5 text-right font-medium">Orçado</th>}
                {hasPrevColumn && <th className="py-1.5 text-right font-medium">{ano - 1}</th>}
              </tr>
            </thead>
            <tbody>
              {projection.lines.map((line) => {
                const headline = PROJECTION_HEADLINE.includes(line.code);
                return (
                  <tr key={line.code} className={headline ? "border-t border-line font-semibold text-ink-900" : "text-ink-600"}>
                    <td className="py-1.5">{line.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{whole(line.realizado)}</td>
                    {!projection.finished && <td className="py-1.5 text-right tabular-nums text-ink-500">{whole(line.projetado)}</td>}
                    <td className="py-1.5 text-right tabular-nums">{whole(line.provavel)}</td>
                    {hasBudgetColumn && <td className="py-1.5 text-right tabular-nums text-ink-500">{line.orcado == null ? "—" : whole(line.orcado)}</td>}
                    {hasPrevColumn && <td className="py-1.5 text-right tabular-nums text-ink-500">{line.anoAnterior == null ? "—" : whole(line.anoAnterior)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11.5px] leading-snug text-ink-400">
        Só entram como realizado os meses já fechados (o mês corrente, ainda pela metade, é projetado). A faixa “entre … e …” usa o quanto cada linha oscilou mês a mês até aqui: se o ano continuar oscilando assim, ele fecha dentro dela em cerca de 2 a cada 3 vezes. O caixa segue a variação média dos mesmos meses usados na média (o orçamento não tem caixa).
      </p>
    </div>
  );
}

function ProjectionCard({ title, item, lastLabel, finished, signed }) {
  const tone = signed ? (item.provavel >= 0 ? "text-success-600" : "text-danger-600") : "text-ink-900";
  return (
    <div className="projecao-card rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
      <p className="text-[12px] font-medium text-ink-500">{title}</p>
      <p className={`mt-1 font-mono text-[22px] font-semibold tabular-nums ${tone}`}>{compactMoneyPt(item.provavel)}</p>
      {!finished && item.margin > 0.5 && (
        <p className="text-[11.5px] text-ink-500">
          entre {compactMoneyPt(item.pessimista)} e {compactMoneyPt(item.otimista)}
        </p>
      )}
      <p className="mt-2 border-t border-line pt-2 text-[11.5px] text-ink-400">
        {lastLabel ? `Realizado até ${lastLabel}: ${compactMoneyPt(item.realizado)}` : "Sem realizado ainda"}
        {item.orcado != null && ` · orçado ${compactMoneyPt(item.orcado)}`}
        {item.anoAnterior != null && ` · ano anterior ${compactMoneyPt(item.anoAnterior)}`}
      </p>
    </div>
  );
}
