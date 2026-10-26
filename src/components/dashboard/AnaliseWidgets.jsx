import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cascataDeDepartamentos, folhasDeDeducoes, itensPareto, montarAnalise } from "../../lib/analiseDesempenho.js";
import { carregarCargaDoEscopo, cargaDoPeriodo, COR_IMPOSTO } from "../../lib/cargaEscopo.js";
import { pctCarga } from "../../lib/cargaTributaria.js";
import { money } from "../../lib/format.js";
import { monthLabel } from "../../lib/dashboardData.js";

// Widgets do B.I. e dos slides: Análise de desempenho (o que pesa no faturamento) e Carga tributária. Entram no catálogo (lib/dashboardWidgets.js),
// então valem nas abas do painel e nos slides com o mesmo período do painel. Sem animação (saem certinhos no PDF dos slides).
const pct1 = (value) => (value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const pct2 = (value) => (value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const compacto = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

function Titulo({ children, nota }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <p data-widget-title className="text-[13px] font-medium text-ink-900">{children}</p>
      {nota && <p className="text-[11px] text-ink-400">{nota}</p>}
    </div>
  );
}
const Vazio = ({ texto }) => <div className="flex h-full min-h-[80px] items-center justify-center text-center text-[12px] text-ink-400">{texto}</div>;

function useAnalise(ctx) {
  return useMemo(() => {
    const dados = montarAnalise(ctx);
    return dados && dados.receita ? dados : null;
  }, [ctx]);
}

export function AnaliseCascataWidget({ ctx }) {
  const dados = useAnalise(ctx);
  if (!dados) return <Vazio texto="Sem receita bruta no período." />;
  const passos = cascataDeDepartamentos(dados);
  return (
    <div className="flex h-full flex-col">
      <Titulo nota="% da receita bruta">Para onde vai cada R$ 100 da receita bruta</Titulo>
      <div className="h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={passos} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="nome" tick={{ fontSize: 10.5, fill: "var(--color-ink-600)" }} interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10.5, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
            <Tooltip cursor={false} formatter={(value, name, item) => (name === "base" ? null : [`${pct1(item.payload.pct)} · ${money(item.payload.consumo)}`, item.payload.completo])} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="valor" stackId="c" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {passos.map((p, i) => <Cell key={i} fill={p.cor} />)}
              <LabelList dataKey="pct" position="top" formatter={(v) => pct1(v)} style={{ fontSize: 10.5, fontWeight: 600, fill: "var(--color-ink-800)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AnaliseRankingWidget({ ctx }) {
  const dados = useAnalise(ctx);
  if (!dados) return <Vazio texto="Sem receita bruta no período." />;
  const itens = [...dados.deptos, ...(dados.deducoes && Math.abs(dados.deducoes.consumo) >= 0.005 ? [dados.deducoes] : [])].sort((a, b) => b.consumo - a.consumo);
  const max = Math.max(...itens.map((d) => d.pct || 0), 1);
  return (
    <div className="flex h-full flex-col">
      <Titulo nota="% da receita bruta · ▲ pesando mais no último mês">Ranking dos departamentos</Titulo>
      <div className="flex flex-col">
        {itens.map((d) => {
          const delta = d.tend?.delta;
          return (
            <div key={d.code} className="grid grid-cols-[minmax(110px,1.2fr)_2fr_90px_52px_44px] items-center gap-2 border-b border-line py-1.5 text-[12px] last:border-0">
              <span className="truncate"><span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-middle" style={{ background: d.cor }} />{d.nome}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${(Math.max(d.pct || 0, 0) / max) * 100}%`, background: d.cor }} /></span>
              <span className="text-right tabular-nums text-ink-700">{money(d.consumo)}</span>
              <span className="text-right font-semibold tabular-nums text-ink-900">{pct1(d.pct)}</span>
              <span className={`text-right text-[11px] font-semibold ${delta == null ? "text-ink-300" : delta >= 0.3 ? "text-warning-700" : delta <= -0.3 ? "text-success-600" : "text-ink-400"}`}>{delta == null ? "—" : delta >= 0.3 ? "▲" : delta <= -0.3 ? "▼" : "•"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnaliseParetoWidget({ ctx }) {
  const dados = useAnalise(ctx);
  if (!dados) return <Vazio texto="Sem receita bruta no período." />;
  const { lista, corte80 } = itensPareto(dados, { limite: 10 });
  if (!lista.length) return <Vazio texto="Sem itens no período." />;
  const max = lista[0]?.consumo || 1;
  return (
    <div className="flex h-full flex-col">
      <Titulo nota="% da receita bruta · acumulado">Os itens que mais pesam (Pareto)</Titulo>
      <div className="flex flex-col">
        {lista.map((f, i) => (
          <div key={f.code}>
            <div className="grid grid-cols-[22px_minmax(110px,1.4fr)_2fr_88px_52px_56px] items-center gap-2 border-b border-line py-1.5 text-[12px]">
              <span className="text-center text-[10.5px] text-ink-400">{i + 1}</span>
              <span className="truncate" title={f.grupoNome ? `${f.grupoNome} › ${f.nome}` : f.nome}><span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-middle" style={{ background: f.cor }} />{f.nome}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${(f.consumo / max) * 100}%`, background: f.cor }} /></span>
              <span className="text-right tabular-nums text-ink-700">{money(f.consumo)}</span>
              <span className="text-right font-semibold tabular-nums text-ink-900">{pct2(f.pct)}</span>
              <span className="text-right text-[10.5px] tabular-nums text-ink-400">{pct1(f.acum)}</span>
            </div>
            {i === corte80 && <div className="my-0.5 text-center text-[10px] font-semibold text-warning-700">— até aqui: 80% do total —</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnaliseDeducoesWidget({ ctx }) {
  const dados = useAnalise(ctx);
  if (!dados) return <Vazio texto="Sem receita bruta no período." />;
  const folhas = folhasDeDeducoes(dados);
  if (!folhas.length) return <Vazio texto="Sem deduções no período." />;
  const total = dados.deducoes?.consumo || folhas.reduce((t, f) => t + f.consumo, 0);
  return (
    <div className="flex h-full flex-col">
      <Titulo nota={`${pct1(dados.deducoes?.pct)} · ${money(total)}`}>Deduções da receita bruta</Titulo>
      <div className="mb-2 flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-muted">
        {folhas.map((f, i) => <div key={f.code} title={`${f.nome}: ${money(f.consumo)}`} style={{ width: `${(f.consumo / total) * 100}%`, background: f.cor, opacity: 1 - i * 0.14 }} />)}
      </div>
      {folhas.map((f, i) => (
        <div key={f.code} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[12px] last:border-0">
          <span className="truncate"><span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-middle" style={{ background: f.cor, opacity: 1 - i * 0.14 }} />{f.nome}</span>
          <span className="shrink-0 tabular-nums"><b className="text-ink-900">{pct2(f.pct)}</b> <span className="text-ink-400">· {money(f.consumo)}</span></span>
        </div>
      ))}
    </div>
  );
}

// --- Carga tributária ---
function useCargaPeriodo(ctx) {
  const [carregado, setCarregado] = useState(null); // null = carregando
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    setErro(false);
    carregarCargaDoEscopo()
      .then((resultado) => { if (ativo) setCarregado(resultado || false); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [ctx]);
  const resultado = useMemo(() => (carregado ? cargaDoPeriodo(carregado, ctx?.months || []) : null), [carregado, ctx]);
  return { carregando: carregado === null && !erro, erro, resultado };
}

function EstadoCarga({ estado }) {
  if (estado.carregando) return <Vazio texto="Carregando a carga tributária…" />;
  if (estado.erro) return <Vazio texto="Não consegui carregar a carga tributária agora." />;
  return <Vazio texto="Sem carga tributária apurada neste período." />;
}

export function CargaResumoWidget({ ctx }) {
  const estado = useCargaPeriodo(ctx);
  const { resultado } = estado;
  if (!resultado) return <EstadoCarga estado={estado} />;
  const { periodo, grupos } = resultado;
  const itens = grupos.map((g) => ({ g, v: periodo.imp?.[g.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const fat = periodo.fat?.total || 0;
  return (
    <div className="flex h-full flex-col gap-2">
      <Titulo nota="impostos próprios ÷ faturamento (notas)">Carga tributária</Titulo>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <p className="text-[34px] font-bold leading-none tabular-nums text-ink-900">{pctCarga(periodo.carga)}</p>
          {periodo.carga != null && <p className="mt-1 text-[12px] text-ink-500">A cada R$ 100 faturados, <b className="text-ink-800">{money(periodo.carga * 100)}</b> vão para impostos próprios.</p>}
        </div>
        <div className="flex gap-6 text-[12px]">
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Faturamento</p><p className="font-bold tabular-nums text-ink-900">{money(fat)}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Impostos próprios</p><p className="font-bold tabular-nums text-ink-900">{money(periodo.impTotal)}</p></div>
        </div>
      </div>
      {fat > 0 && itens.length > 0 && (
        <>
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-muted">
            {itens.map(({ g, v }) => <div key={g.id} title={`${g.nome}: ${money(v)}`} style={{ width: `${(v / fat) * 100}%`, background: COR_IMPOSTO[g.id] || "#64748b" }} />)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-500">
            {itens.map(({ g, v }) => <span key={g.id}><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COR_IMPOSTO[g.id] || "#64748b" }} />{String(g.nome).split(" (")[0]} <b className="text-ink-800">{pct2((v / fat) * 100)}</b></span>)}
          </div>
        </>
      )}
    </div>
  );
}

export function CargaMesWidget({ ctx }) {
  const estado = useCargaPeriodo(ctx);
  const { resultado } = estado;
  if (!resultado) return <EstadoCarga estado={estado} />;
  const serie = resultado.meses.map((m) => ({ mes: monthLabel(m.rotulo), carga: m.fat?.total || m.impTotal ? (m.carga == null ? null : Number((m.carga * 100).toFixed(2))) : null }));
  const validos = serie.filter((x) => x.carga != null);
  const media = validos.length ? validos.reduce((t, x) => t + x.carga, 0) / validos.length : null;
  return (
    <div className="flex h-full flex-col">
      <Titulo nota={media != null ? `média ${pct1(media)}` : ""}>Carga tributária por mês</Titulo>
      <div className="h-56 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 18, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="cargaWidgetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="mes" tick={{ fontSize: 10.5, fill: "var(--color-ink-600)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10.5, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, (max) => Math.ceil(max * 1.25)]} />
            <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")}%`, "Carga"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            {media != null && <ReferenceLine y={media} stroke="#94a3b8" strokeDasharray="4 4" />}
            <Area type="monotone" dataKey="carga" stroke="#2563eb" strokeWidth={2.2} fill="url(#cargaWidgetGrad)" dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }} isAnimationActive={false} connectNulls={false}>
              <LabelList dataKey="carga" position="top" formatter={(v) => (v == null ? "" : pct1(v))} style={{ fontSize: 10, fill: "var(--color-ink-600)" }} />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CargaComposicaoWidget({ ctx }) {
  const estado = useCargaPeriodo(ctx);
  const { resultado } = estado;
  if (!resultado) return <EstadoCarga estado={estado} />;
  const { periodo, grupos } = resultado;
  const itens = grupos.map((g) => ({ id: g.id, nome: String(g.nome).split(" (")[0], v: periodo.imp?.[g.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  if (!itens.length) return <Vazio texto="Sem imposto apurado no período." />;
  return (
    <div className="flex h-full flex-col">
      <Titulo nota="% do total de impostos próprios">Composição dos impostos</Titulo>
      <div className="grid flex-1 grid-cols-[150px_1fr] items-center gap-4">
        <div className="relative mx-auto h-[150px] w-[150px]">
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] text-ink-400">Total</span>
            <span className="text-[14px] font-bold text-ink-900">{compacto(periodo.impTotal)}</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={itens} dataKey="v" nameKey="nome" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {itens.map((x) => <Cell key={x.id} fill={COR_IMPOSTO[x.id] || "#64748b"} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col">
          {itens.map((x) => (
            <div key={x.id} className="grid grid-cols-[1fr_auto_44px] items-center gap-2 border-b border-line py-1 text-[12px] last:border-0">
              <span className="truncate"><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COR_IMPOSTO[x.id] || "#64748b" }} />{x.nome}</span>
              <span className="text-right tabular-nums text-ink-700">{money(x.v)}</span>
              <span className="text-right font-semibold tabular-nums text-ink-900">{pct1((x.v / periodo.impTotal) * 100)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
