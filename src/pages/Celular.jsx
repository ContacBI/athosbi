import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bar, Cell, ComposedChart, ResponsiveContainer, XAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  LayoutGrid,
  MessageSquare,
  MoreVertical,
  Presentation,
  Settings2,
  Share,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { sharedDashboardContext } from "../lib/dashboardData.js";
import { analyze, fmtDelta, fmtPct, monthName } from "../lib/assistant/analysis.js";
import { comparisonPeriod, contextForPeriod, dataMonths, shortPeriod } from "../lib/assistant/context.js";
import { bridgeSentence } from "../lib/cashBridge.js";
import { budgetFor } from "../lib/budget.js";
import { apresentacoesVisiveis, compactValue } from "../lib/presentations.js";
import { money } from "../lib/format.js";
import { setPrefersFullPanel, useInstallApp } from "../lib/installApp.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { alertasDoResumo, blocosVisiveis } from "../lib/resumoCelular.js";
import DrillModal from "../components/dashboard/DrillModal.jsx";
import ResumoCelularConfig from "../components/ResumoCelularConfig.jsx";
import { useGravarResumo } from "../lib/useGravarResumo.js";

// Resumo no celular: os números principais do período, o que pede
// atenção, o caixa e a última apresentação — em uma coluna, sem rolar pro
// lado. Cada número abre a composição até o lançamento (DrillModal). O app
// pode ser instalado na tela inicial (manifest + public/sw.js). O que
// aparece (blocos, ordem, números, alertas, recado) é configurável por
// empresa/grupo pela equipe — ver lib/resumoCelular.js.

const F = {
  lucro: { kind: "sum", format: "money", numerator: [{ code: "DRE.18", sign: 1 }] },
  receita: { kind: "sum", format: "money", numerator: [{ code: "DRE.03", sign: 1 }] },
  despesas: { kind: "sum", format: "money", numerator: ["DRE.06", "DRE.07", "DRE.08", "DRE.09", "DRE.10"].map((code) => ({ code, sign: 1 })) },
  ebitda: { kind: "sum", format: "money", numerator: [{ code: "DEX.08", sign: 1 }, { code: "DEX.09", sign: 1 }] },
  caixa: { kind: "sum", format: "money", numerator: [{ code: "01.01.01", sign: 1 }] },
  margem: { kind: "ratio", format: "percent", numerator: [{ code: "DRE.18", sign: 1 }], denominator: [{ code: "DRE.03", sign: 1 }] },
  lucroBruto: { kind: "sum", format: "money", numerator: [{ code: "DRE.05", sign: 1 }] },
  custos: { kind: "sum", format: "money", numerator: [{ code: "DRE.04", sign: 1 }] },
  receitaBruta: { kind: "sum", format: "money", numerator: [{ code: "DRE.01", sign: 1 }] },
};

function lastDay(year, month) {
  return new Date(year, month, 0).getDate();
}
function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  return { start: `${month}-01`, end: `${month}-${String(lastDay(y, m)).padStart(2, "0")}` };
}
function monthsBetween(start, end) {
  const out = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const [ye, me] = end.slice(0, 7).split("-").map(Number);
  for (let guard = 0; guard < 240 && (y < ye || (y === ye && m <= me)); guard += 1) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// As opções do seletor: cada mês com dados (do mais novo pro mais antigo,
// até 12) e o acumulado do ano do mês mais novo; o período que já estiver
// escolhido entra também, se não for nenhum desses.
function periodOptions(months, current) {
  const sorted = [...months].sort().reverse();
  const options = [];
  if (sorted.length) {
    const latest = sorted[0];
    const year = latest.slice(0, 4);
    const firstOfYear = sorted.filter((month) => month.startsWith(year)).sort()[0];
    if (firstOfYear && firstOfYear !== latest) options.push({ ...monthRange(latest), start: `${firstOfYear}-01`, label: `Acumulado de ${year} (${shortPeriod(`${firstOfYear}-01`, monthRange(latest).end)})` });
  }
  sorted.slice(0, 12).forEach((month) => options.push({ ...monthRange(month), label: monthName(month) }));
  if (current.start && current.end && !options.some((item) => item.start === current.start && item.end === current.end)) {
    options.unshift({ ...current, label: shortPeriod(current.start, current.end) });
  }
  return options;
}

// Período de comparação: mês contra o mês anterior; acumulado (começando
// em janeiro) contra o mesmo período do ano passado. Só quando os meses
// dele existem nos dados — senão a variação seria contra zero.
function comparisonFor(period, months) {
  const length = monthsBetween(period.start, period.end).length;
  const kind = length > 1 && period.start.slice(5, 7) === "01" ? "yoy" : "anterior";
  const prev = comparisonPeriod(period, kind);
  if (!prev) return null;
  const available = new Set(months);
  if (!monthsBetween(prev.start, prev.end).every((month) => available.has(month))) return null;
  return { ...prev, kind };
}

function Delta({ metric, invert = false, dark = false }) {
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

function KpiTile({ label, value, sub, metric, onOpen, className = "" }) {
  return (
    <button type="button" onClick={onOpen} className={`celular-kpi flex min-w-0 flex-col gap-1 rounded-2xl bg-surface-card p-3.5 text-left shadow-sm ring-1 ring-line active:scale-[0.99] ${className}`}>
      <span className="text-[11.5px] font-medium text-ink-400">{label}</span>
      <span className="truncate text-[19px] font-semibold tabular-nums leading-tight text-ink-900">{value}</span>
      <span className="flex min-h-[18px] flex-wrap items-center gap-1">
        <Delta metric={metric} />
        {sub && <span className="truncate text-[10.5px] text-ink-400">{sub}</span>}
      </span>
    </button>
  );
}

function Card({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`rounded-2xl bg-surface-card p-4 shadow-sm ring-1 ring-line ${className}`}>
      {title && (
        <h2 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">
          {Icon && <Icon size={14} />}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function InstallSheet({ ios, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-navy-950/40" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-surface-card p-5 pb-8 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-[16px] font-semibold text-ink-900">Instalar o AthosBI no celular</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-ink-400">
            <X size={18} />
          </button>
        </div>
        {ios ? (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13.5px] text-ink-700">
            <li>
              Toque em <Share size={14} className="inline align-[-2px]" /> <strong>Compartilhar</strong>, na barra do Safari.
            </li>
            <li>
              Role e toque em <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>
              Confirme em <strong>Adicionar</strong>. O ícone do AthosBI aparece junto dos seus aplicativos.
            </li>
          </ol>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13.5px] text-ink-700">
            <li>
              Abra o menu do navegador (<MoreVertical size={14} className="inline align-[-2px]" /> no Chrome).
            </li>
            <li>
              Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
            </li>
            <li>Confirme. O ícone do AthosBI aparece junto dos seus aplicativos.</li>
          </ol>
        )}
        <p className="mt-3 text-[12px] text-ink-400">Aberto pelo ícone, o AthosBI vem direto para este resumo, em tela cheia.</p>
      </div>
    </div>
  );
}

// `previa`: dentro da moldura de celular de Personalizar › Resumo do
// celular (ResumoCelularModal) — sem menu, sem engrenagem, sem abrir
// composição; `comoCliente` esconde o que só a equipe vê; `onAnalysis`
// devolve as análises do período pro painel de configuração ao lado.
export default function Celular({ previa = false, comoCliente = false, onAnalysis } = {}) {
  const appState = useAppState();
  const navigate = useNavigate();
  const { installed, canPrompt, ios, install } = useInstallApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [drill, setDrill] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const company = appState.companies.find((item) => item.id === appState.activeCompanyId) || null;
  const group = appState.activeGroupId ? appState.groups.find((item) => item.id === appState.activeGroupId) : null;

  // Configuração do resumo: quem pode editar esta empresa/grupo (admin ou
  // responsável) abre o painel; a equipe vê os alertas de conferência que o
  // cliente não vê — a não ser em "Ver como o cliente vê".
  const canConfigure = Boolean(
    appState.isAdmin || (company && !group && (company.responsaveis || []).includes(appState.userEmail)) || (group && isResponsavelForGroup(appState, group.id))
  );
  const configurando = !previa && canConfigure && searchParams.get("configurar") === "1";
  const [verComoCliente, setVerComoCliente] = useState(false);
  const { config, mudar: mudarConfig, salvo } = useGravarResumo();
  const equipe = (appState.isAdmin || appState.isColaborador) && !verComoCliente && !(previa && comoCliente);

  function abrirConfig(aberto) {
    const next = new URLSearchParams(searchParams);
    if (aberto) next.set("configurar", "1");
    else next.delete("configurar");
    setSearchParams(next, { replace: true });
    if (!aberto) setVerComoCliente(false);
  }
  const name = group?.name || company?.name || "";
  const hasData = appState.accounts.length > 0 || appState.journal.length > 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const months = useMemo(() => (hasData ? dataMonths().sort() : []), [hasData, appState.journal, appState.companies, appState.activeCompanyId, appState.activeGroupId]);
  const period = { start: appState.periodStart, end: appState.periodEnd };
  const options = periodOptions(months, period);

  // Sem período escolhido (ou fora dos dados), começa no último mês com dados.
  useEffect(() => {
    if (!months.length) return;
    const inData = period.start && period.end && months.includes(period.start.slice(0, 7)) && months.includes(period.end.slice(0, 7));
    if (!inData) {
      const range = monthRange(months[months.length - 1]);
      setData({ periodStart: range.start, periodEnd: range.end });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const ctx = useMemo(() => (hasData && period.start ? sharedDashboardContext() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasData, appState.mappings, appState.accounts, appState.journal, appState.periodStart, appState.periodEnd, appState.indicatorOverrides, appState.hideNonOperatingResults]);

  // Comparação e tendência ficam pra depois da primeira pintura: a tela
  // aparece com os números do período e as setinhas chegam em seguida.
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    setExtra(null);
    if (!ctx || !period.start) return undefined;
    const timer = setTimeout(() => {
      const prev = comparisonFor(period, months);
      const prevCtx = prev ? contextForPeriod(prev.start, prev.end) : null;
      const endMonth = period.end.slice(0, 7);
      const trendMonths = months.filter((month) => month <= endMonth).slice(-6);
      let trend = [];
      if (trendMonths.length > 1) {
        const trendCtx = contextForPeriod(`${trendMonths[0]}-01`, period.end);
        const row = (code) => trendCtx.dre.find((item) => item.codigo_gerencial === code);
        const lucro = row("DRE.18");
        trend = trendMonths.map((month) => ({ month, label: monthName(month, false).slice(0, 3), lucro: Number(lucro?.monthValues?.[month] || 0), current: month >= period.start.slice(0, 7) }));
      }
      setExtra({ prev, prevCtx, trend });
    }, 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  const label = shortPeriod(period.start, period.end);
  const analysis = useMemo(() => {
    if (!ctx) return null;
    try {
      return analyze(ctx, { period, label, prevCtx: extra?.prevCtx || null, prevPeriod: extra?.prev || {}, prevLabel: extra?.prev ? shortPeriod(extra.prev.start, extra.prev.end) : "" });
    } catch (error) {
      console.error("celular: falha na análise", error);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, extra]);
  const budget = useMemo(() => (ctx ? budgetFor(ctx) : null), [ctx]);
  useEffect(() => {
    if (onAnalysis) onAnalysis(analysis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const facts = analysis?.facts;
  const cmp = analysis?.comparison;
  const decks = [...apresentacoesVisiveis(appState.presentations, previa && comoCliente ? {} : appState)].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const lastDeck = decks[0] || null;
  const open = (title, formula) => {
    if (!previa) setDrill({ label: title, formula });
  };

  function openFullPanel() {
    if (previa) return;
    setPrefersFullPanel(true);
    navigate("/empresa");
  }

  async function handleInstall() {
    setMenuOpen(false);
    const result = await install();
    if (result === "manual") setInstallHelp(true);
  }

  const { alertas: alerts, positivos: positives } = alertasDoResumo(analysis, config, { equipe });
  // Os quadrinhos possíveis (quais e em que ordem: config.numeros).
  const kpi = facts
    ? {
        receita: { id: "receita", label: "Receita líquida", value: compactValue(facts.receitaLiquida, "money"), metric: cmp?.receita, formula: F.receita },
        despesas: { id: "despesas", label: "Despesas operacionais", value: compactValue(Math.abs(facts.despesasOp), "money"), metric: cmp?.despesas, formula: F.despesas },
        ebitda: { id: "ebitda", label: "EBITDA", value: compactValue(facts.ebitda, "money"), sub: facts.receitaLiquida > 0.5 ? `${fmtPct(facts.margemEbitda)} da receita` : "", metric: cmp?.ebitda, formula: F.ebitda },
        caixa: { id: "caixa", label: "Caixa no fim", value: compactValue(facts.caixa.end, "money"), metric: cmp?.caixa, formula: F.caixa },
        lucroBruto: { id: "lucroBruto", label: "Lucro bruto", value: compactValue(facts.lucroBruto, "money"), sub: facts.receitaLiquida > 0.5 ? `${fmtPct(facts.margemBruta)} da receita` : "", metric: cmp?.lucroBruto, formula: F.lucroBruto },
        margem: { id: "margem", label: "Margem líquida", value: fmtPct(facts.margemLiquida), metric: cmp?.margemLiquida, formula: F.margem },
        custos: { id: "custos", label: "Custos", value: compactValue(Math.abs(facts.custos), "money"), metric: cmp?.custos, formula: F.custos },
        receitaBruta: { id: "receitaBruta", label: "Receita bruta", value: compactValue(facts.receitaBruta, "money"), metric: cmp?.receitaBruta, formula: F.receitaBruta },
      }
    : {};
  const prevLabel = extra?.prev ? (extra.prev.kind === "yoy" ? "vs. mesmo período do ano passado" : `vs. ${shortPeriod(extra.prev.start, extra.prev.end)}`) : "";

  return (
    <div className={`celular bg-surface-page pb-10 ${previa ? "min-h-full" : "min-h-screen"} ${configurando ? "sm:pr-[400px]" : ""}`} style={previa ? undefined : { paddingTop: "env(safe-area-inset-top)" }}>
      <header className="sticky top-0 z-30 bg-navy-950 px-4 pb-3 pt-3 text-white shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-[15px] font-bold">A</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold leading-tight">{name || "AthosBI"}</p>
            <p className="truncate text-[11px] text-white/50">{group ? "Grupo de empresas" : company?.cnpj || "Resumo no celular"}</p>
          </div>
          {canConfigure && !configurando && !previa && (
            <button type="button" onClick={() => abrirConfig(true)} aria-label="Configurar o resumo" title="Configurar o que aparece para o cliente" className="celular-configurar flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10">
              <Settings2 size={18} />
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={() => !previa && setMenuOpen((value) => !value)} aria-label="Menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-60 rounded-xl bg-surface-card p-1.5 text-ink-800 shadow-xl ring-1 ring-line">
                  <button type="button" onClick={openFullPanel} className="celular-painel flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] hover:bg-surface-muted">
                    <LayoutGrid size={16} className="text-ink-400" /> Painel completo
                  </button>
                  <button type="button" onClick={() => navigate("/empresas")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] hover:bg-surface-muted">
                    <Building2 size={16} className="text-ink-400" /> Trocar de empresa
                  </button>
                  {canConfigure && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        abrirConfig(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] hover:bg-surface-muted"
                    >
                      <Settings2 size={16} className="text-ink-400" /> Configurar o resumo
                    </button>
                  )}
                  {!installed && (
                    <button type="button" onClick={handleInstall} className="celular-instalar flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] hover:bg-surface-muted">
                      <Download size={16} className="text-ink-400" /> Instalar no celular
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {options.length > 0 && (
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">Período</span>
            <select
              value={`${period.start}|${period.end}`}
              onChange={(event) => {
                const [start, end] = event.target.value.split("|");
                setData({ periodStart: start, periodEnd: end });
              }}
              className="celular-periodo min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-white outline-none [&>option]:text-ink-900"
            >
              {options.map((option) => (
                <option key={`${option.start}|${option.end}`} value={`${option.start}|${option.end}`}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {!hasData || !facts ? (
        <p className="px-6 py-16 text-center text-[14px] text-ink-400">{hasData ? "Calculando…" : "Ainda não há dados importados para esta empresa."}</p>
      ) : (
<main className="mx-auto flex max-w-xl flex-col gap-3 px-3 pt-3">
          {verComoCliente && (
            <p className="rounded-full bg-accent-50 px-3 py-1.5 text-center text-[12px] font-medium text-accent-700">Você está vendo o resumo como o cliente vê.</p>
          )}
          {blocosVisiveis(config).map((id) => {
            let bloco = null;
            if (id === "recado") {
              bloco = (
                <section className="celular-recado flex gap-3 rounded-2xl bg-accent-50 p-4 ring-1 ring-accent-200">
                  <MessageSquare size={18} className="mt-0.5 shrink-0 text-accent-600" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Recado do escritório</p>
                    <p className="mt-1 whitespace-pre-line text-[13.5px] leading-snug text-ink-800">{config.recado}</p>
                  </div>
                </section>
              );
            } else if (id === "resultado") {
              bloco = (
                <button type="button" onClick={() => open(facts.lucro < 0 ? "Prejuízo do período" : "Lucro do período", F.lucro)} className="celular-hero flex flex-col gap-1 rounded-3xl bg-navy-900 p-5 text-left text-white shadow-md active:scale-[0.99]">
                  <span className="text-[12px] font-medium uppercase tracking-wide text-white/60">{facts.lucro < -0.5 ? "Prejuízo" : "Lucro"} · {label}</span>
                  <span className={`text-[32px] font-semibold leading-tight tabular-nums ${facts.lucro < -0.5 ? "text-[#ffb3a9]" : "text-white"}`}>{money(facts.lucro)}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-white/70">
                    {facts.receitaLiquida > 0.5 && <span>Margem de {fmtPct(facts.margemLiquida)} da receita</span>}
                    <Delta metric={cmp?.lucro} dark />
                  </span>
                  {prevLabel && <span className="text-[10.5px] text-white/40">{prevLabel}</span>}
                </button>
              );
            } else if (id === "numeros") {
              const tiles = config.numeros.map((numero) => kpi[numero]).filter(Boolean);
              bloco = tiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {tiles.map((tile, index) => (
                    <KpiTile key={tile.id} label={tile.label} value={tile.value} sub={tile.sub} metric={tile.metric} onOpen={() => open(tile.label, tile.formula)} className={tiles.length % 2 === 1 && index === tiles.length - 1 ? "col-span-2" : ""} />
                  ))}
                </div>
              );
            } else if (id === "tendencia") {
              bloco = extra?.trend?.length > 1 && (
                <Card title="Resultado mês a mês">
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={extra.trend} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} />
                        <Bar dataKey="lucro" radius={[5, 5, 5, 5]} maxBarSize={34} isAnimationActive={false}>
                          {extra.trend.map((item) => (
                            <Cell key={item.month} fill={item.lucro < 0 ? "var(--color-danger-500)" : item.current ? "var(--color-accent-500)" : "var(--color-navy-700)"} fillOpacity={item.current ? 1 : 0.55} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-ink-400">
                    {extra.trend.map((item) => (
                      <span key={item.month} className={`w-full text-center ${item.lucro < 0 ? "text-danger-600" : ""}`}>
                        {compactValue(item.lucro, "money").replace("R$ ", "")}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            } else if (id === "atencao") {
              bloco = (
                <Card title={alerts.length ? "Pede atenção" : "Tudo em ordem"} icon={alerts.length ? AlertTriangle : CheckCircle2}>
                  <div className="flex flex-col gap-2.5">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="celular-alerta flex gap-2.5">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.severity >= 3 ? "bg-danger-500" : alert.severity === 2 ? "bg-warning-500" : "bg-ink-300"}`} />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-ink-900">
                            {alert.title}
                            {alert.soEquipe && <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 align-[1px] text-[10px] font-medium text-ink-400">só a equipe vê</span>}
                          </p>
                          <p className="text-[12.5px] leading-snug text-ink-500">{alert.text}</p>
                        </div>
                      </div>
                    ))}
                    {!alerts.length && !positives.length && <p className="text-[13px] text-ink-500">Nenhum alerta neste período.</p>}
                    {positives.map((item) => (
                      <div key={item.id} className="flex gap-2.5">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success-500" />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-ink-900">{item.title}</p>
                          <p className="text-[12.5px] leading-snug text-ink-500">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            } else if (id === "caixa") {
              bloco = facts.bridge && (
                <Card title="Do lucro ao caixa" icon={Wallet}>
                  <p className="text-[13.5px] leading-snug text-ink-700">{bridgeSentence(facts.bridge)}</p>
                </Card>
              );
            } else if (id === "orcamento") {
              bloco = budget && (
                <Card title={`Orçamento ${budget.ano}`} icon={Target}>
                  <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                    {[
                      { label: "Receita", item: budget.receita },
                      { label: "Resultado", item: budget.resultado },
                    ].map(({ label: itemLabel, item }) => (
                      <div key={itemLabel}>
                        <p className="text-ink-400">{itemLabel}</p>
                        <p className="text-[15px] font-semibold tabular-nums text-ink-900">{compactValue(item.realizado, "money")}</p>
                        <p className={item.tone === "bom" ? "text-success-600" : item.tone === "ruim" ? "text-danger-700" : item.tone === "atencao" ? "text-warning-700" : "text-ink-500"}>
                          de {compactValue(item.orcado, "money")} orçados{item.reach != null && item.orcado > 0 && item.reach >= 0 && item.reach <= 300 ? ` · ${Math.round(item.reach)}%` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            } else if (id === "apresentacao") {
              bloco = lastDeck && (
                <button type="button" onClick={() => navigate(`/empresa/apresentacoes/${lastDeck.id}?apresentar=1&voltar=celular`)} className="celular-deck flex items-center gap-3 rounded-2xl bg-surface-card p-4 text-left shadow-sm ring-1 ring-line">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                    <Presentation size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-400">Última apresentação</span>
                    <span className="block truncate text-[14px] font-semibold text-ink-900">{lastDeck.name}</span>
                  </span>
                  <ChevronRight size={18} className="text-ink-300" />
                </button>
              );
            }
            return bloco ? <Fragment key={id}>{bloco}</Fragment> : null;
          })}

          <div className="mt-1 flex flex-col gap-2">
            <button type="button" onClick={openFullPanel} className="flex items-center justify-center gap-2 rounded-xl bg-surface-card py-3 text-[13.5px] font-medium text-ink-700 shadow-sm ring-1 ring-line">
              <LayoutGrid size={16} /> Abrir o painel completo
            </button>
            {!installed && !previa && (
              <button type="button" onClick={handleInstall} className="celular-instalar-rodape flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium text-accent-600">
                <Download size={15} /> {canPrompt ? "Instalar o AthosBI no celular" : "Como instalar no celular"}
              </button>
            )}
            <p className="text-center text-[11px] text-ink-400">Toque em qualquer número para ver de onde ele vem.</p>
          </div>
        </main>
      )}

      {installHelp && <InstallSheet ios={ios} onClose={() => setInstallHelp(false)} />}
      {drill && ctx && <DrillModal target={drill} ctx={ctx} onClose={() => setDrill(null)} />}
      {configurando && (
        <ResumoCelularConfig config={config} onChange={mudarConfig} onClose={() => abrirConfig(false)} verComoCliente={verComoCliente} onVerComoCliente={setVerComoCliente} salvo={salvo} nome={name} analysis={analysis} />
      )}
    </div>
  );
}
