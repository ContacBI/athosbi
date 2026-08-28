import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../data/useStore.js";
import RGL, { WidthProvider } from "react-grid-layout/legacy";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, ArrowUpRight, ChevronRight, X, CheckCircle2, Circle, TriangleAlert } from "lucide-react";
import { WIDGET_CATALOG, formatWidgetValue } from "../../lib/dashboardWidgets.js";
import { isSingleLineFormula, describeIndicatorFormula } from "../../lib/indicatorFormula.js";
import { useIsMobile } from "../../lib/useIsMobile.js";
import { directChildren } from "../../lib/reportTree.js";
import { buildDfcDirect, buildDfcIndirect } from "../../data/calculations.js";
import { money } from "../../lib/format.js";
import { columnLabel, columnValue, reportColumns, isZeroNoMovement } from "../../lib/reportColumns.js";
import ReportSettingsMenu from "../ReportSettingsMenu.jsx";
import { GRID_COLS, ROW_HEIGHT, layoutFor, marginPxFor, DEFAULT_SPACING } from "./gridLayout.js";

const GridLayout = WidthProvider(RGL);

function moneyClass(value) {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) < 0.005) return "text-ink-600";
  return numeric < 0 ? "text-danger-600" : "text-success-600";
}

function compactMoney(value) {
  const numeric = Number(value || 0);
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(numeric / 1_000).toFixed(0)}k`;
  return numeric.toFixed(0);
}

function DetailModal({ detail, onClose }) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/20 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface-card p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[16px] font-medium text-ink-900">{detail.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700"
          >
            <X size={15} />
          </button>
        </div>
        <p className="mt-2 text-[28px] font-medium text-ink-900">{detail.value}</p>
        <p className="mt-1 text-[12px] italic text-ink-400">{detail.formula}</p>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
          {detail.rows.length === 0 && <p className="text-[12px] text-ink-400">Sem dados para detalhar.</p>}
          {detail.rows.map((row, index) => (
            <div
              key={index}
              className={`flex items-center justify-between gap-3 text-[13px] ${
                row.bold ? "border-t border-line pt-2 font-semibold text-ink-900" : "text-ink-600"
              }`}
            >
              <span className="truncate">{row.label}</span>
              <span className={`shrink-0 tabular-nums ${row.bold ? "" : moneyClass(row.value)}`}>{row.display ?? money(row.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PALETTE = [
  "var(--color-accent-500)",
  "var(--color-navy-700)",
  "var(--color-success-500)",
  "var(--color-warning-500)",
  "var(--color-danger-500)",
  "var(--color-accent-300)",
];

function BalanceChartWidget({ ctx }) {
  const [path, setPath] = useState([]);

  const segments = useMemo(() => {
    const bp = ctx.bp;
    if (path.length === 0) {
      const ativo = bp.find((row) => row.codigo_gerencial === "01");
      const passivo = bp.find((row) => row.codigo_gerencial === "02");
      const pl = bp.find((row) => row.codigo_gerencial === "03");
      return [
        {
          code: "01",
          label: "Ativo",
          value: Math.abs(Number(ativo?.saldo || 0)) || Math.abs(ctx.indicators.totalAtivo) || 0.0001,
          drillable: directChildren(bp, "01").some((child) => Math.abs(Number(child.saldo || 0)) > 0.005),
        },
        {
          code: "02",
          label: "Passivo",
          value: Math.abs(Number(passivo?.saldo || 0)) || 0.0001,
          drillable: directChildren(bp, "02").some((child) => Math.abs(Number(child.saldo || 0)) > 0.005),
        },
        {
          code: "03",
          label: "Patrimônio líquido",
          value: Math.abs(Number(pl?.saldo || 0)) || 0.0001,
          drillable: directChildren(bp, "03").some((child) => Math.abs(Number(child.saldo || 0)) > 0.005),
        },
      ];
    }
    const last = path[path.length - 1];
    const children = directChildren(bp, last.code).filter((row) => Math.abs(Number(row.saldo || 0)) > 0.005);
    if (!children.length) return null;
    return children.map((row) => ({
      code: row.codigo_gerencial,
      label: row.categoria_gerencial,
      value: Math.abs(Number(row.saldo || 0)) || 0.0001,
      drillable: directChildren(bp, row.codigo_gerencial).some((child) => Math.abs(Number(child.saldo || 0)) > 0.005),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.bp, path]);

  const activeSegments = segments || [];

  function handleSliceClick(entry) {
    if (!entry?.drillable) return;
    setPath((prev) => [...prev, { code: entry.code, label: entry.label }]);
  }

  return (
    <div className="flex h-full flex-col items-center">
      <div className="mb-1 flex w-full items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-900">Composição do balanço</p>
        {path.length > 0 && (
          <button
            type="button"
            onClick={() => setPath((prev) => prev.slice(0, -1))}
            className="flex items-center gap-1 text-[11px] font-medium text-accent-600 hover:underline"
          >
            <ArrowLeft size={11} /> Voltar
          </button>
        )}
      </div>
      <div className="mb-1 flex w-full flex-wrap items-center gap-1 text-[11px] text-ink-400">
        <button type="button" onClick={() => setPath([])} className={path.length ? "hover:text-accent-600 hover:underline" : "text-ink-600"}>
          Balanço
        </button>
        {path.map((step, index) => (
          <span key={step.code} className="flex items-center gap-1">
            <ChevronRight size={10} />
            <button
              type="button"
              onClick={() => setPath((prev) => prev.slice(0, index + 1))}
              className={index === path.length - 1 ? "text-ink-600" : "hover:text-accent-600 hover:underline"}
            >
              {step.label}
            </button>
          </span>
        ))}
      </div>
      <div className="h-48 w-full">
        {activeSegments.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={activeSegments} dataKey="value" nameKey="label" innerRadius={50} outerRadius={78} paddingAngle={2} onClick={handleSliceClick} style={{ cursor: "pointer" }}>
                {activeSegments.map((entry, index) => (
                  <Cell key={entry.code} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-400">Sem subgrupos abaixo deste nível.</div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-ink-600">
        {activeSegments.map((entry, index) => (
          <button key={entry.code} type="button" onClick={() => handleSliceClick(entry)} disabled={!entry.drillable} className={`flex items-center gap-1.5 ${entry.drillable ? "hover:text-accent-600" : "cursor-default"}`}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
            {entry.label}
            <span className="tabular-nums text-ink-400">{money(entry.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function renderLineOrBarChart(kind, ctx) {
  const grid = <CartesianGrid vertical={false} stroke="var(--color-line)" />;
  const tooltipMoney = <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />;
  const moneyAxis = <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />;

  if (kind === "receita_evolucao") {
    return (
      <ComposedChart data={ctx.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <Line dataKey="receita" name="Receita líquida" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (kind === "ebitda_evolucao") {
    return (
      <ComposedChart data={ctx.ebitdaSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <Bar dataKey="ebitda" name="EBITDA" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
        <Line dataKey="revenue" name="Receita líquida" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    );
  }
  if (kind === "margem_ebitda") {
    return (
      <ComposedChart data={ctx.ebitdaSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => `${Number(value).toFixed(1).replace(".", ",")}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line dataKey="margin" name="Margem EBITDA" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (kind === "lucro_evolucao") {
    return (
      <ComposedChart data={ctx.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <Bar dataKey="resultado" name="Lucro líquido" radius={[3, 3, 0, 0]}>
          {ctx.series.map((entry, index) => (
            <Cell key={index} fill={entry.resultado < 0 ? "var(--color-danger-500)" : "var(--color-success-500)"} />
          ))}
        </Bar>
      </ComposedChart>
    );
  }
  if (kind === "margens_comparativo") {
    const data = [
      { name: "Margem bruta", value: ctx.margemBruta },
      { name: "Margem EBITDA", value: ctx.margemEbitda },
      { name: "Margem líquida", value: ctx.margemLiquida },
    ];
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => `${Number(value).toFixed(1).replace(".", ",")}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" name="Margem" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </ComposedChart>
    );
  }
  if (kind === "caixa_evolucao") {
    return (
      <ComposedChart data={ctx.cashSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <Line dataKey="saldo" name="Saldo de caixa" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (kind === "ativo_passivo_pl") {
    return (
      <ComposedChart data={ctx.bpSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <Line dataKey="ativo" name="Ativo" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
        <Line dataKey="passivo" name="Passivo" stroke="var(--color-danger-500)" strokeWidth={2} dot={{ r: 2 }} />
        <Line dataKey="pl" name="Patrimônio líquido" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    );
  }
  if (kind === "receita_custo_despesa") {
    return (
      <ComposedChart data={ctx.expenseSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis yAxisId="money" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />
        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={40} />
        <Tooltip formatter={(value, name) => (name === "Margem líquida" ? `${Number(value).toFixed(1).replace(".", ",")}%` : money(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar yAxisId="money" dataKey="receita" name="Receita" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="money" dataKey="custo" name="Custo" fill="var(--color-danger-500)" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="money" dataKey="despesa" name="Despesa" fill="var(--color-warning-500)" radius={[3, 3, 0, 0]} />
        <Line yAxisId="pct" dataKey="margem" name="Margem líquida" stroke="var(--color-navy-700)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (kind === "ncg_evolucao") {
    return (
      <ComposedChart data={ctx.ncgSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <ReferenceLine y={0} stroke="var(--color-line-strong)" />
        <Line dataKey="value" name="Capital de giro" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (kind === "margens_evolucao") {
    return (
      <ComposedChart data={ctx.marginsSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => `${Number(value).toFixed(1).replace(".", ",")}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line dataKey="margemBruta" name="Margem bruta" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
        <Line dataKey="margemLiquida" name="Margem líquida" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    );
  }
  if (kind === "liquidez_evolucao") {
    return (
      <ComposedChart data={ctx.liquidezSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => v.toFixed(1)} axisLine={false} tickLine={false} width={36} />
        <Tooltip formatter={(value) => (value == null ? "—" : Number(value).toFixed(2).replace(".", ","))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <ReferenceLine y={1} stroke="var(--color-line-strong)" strokeDasharray="3 3" />
        <Line dataKey="corrente" name="Liquidez corrente" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line dataKey="geral" name="Liquidez geral" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </ComposedChart>
    );
  }
  if (kind === "endividamento_evolucao") {
    const data = (ctx.bpSeries || []).map((row) => ({ month: row.month, ratio: row.pl ? Math.abs(row.passivo) / Math.abs(row.pl) : null }));
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => v.toFixed(1)} axisLine={false} tickLine={false} width={36} />
        <Tooltip formatter={(value) => (value == null ? "—" : Number(value).toFixed(2).replace(".", ","))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line dataKey="ratio" name="Passivo / PL" stroke="var(--color-danger-500)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    );
  }
  if (kind === "dre_percentual_tempo") {
    const data = (ctx.expenseSeries || []).map((row) => ({
      month: row.month,
      custoPct: row.receita ? (Math.abs(row.custo) / row.receita) * 100 : 0,
      despesaPct: row.receita ? (Math.abs(row.despesa) / row.receita) * 100 : 0,
      resultadoPct: Math.max(row.margem, 0),
    }));
    return (
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => `${Number(value).toFixed(1).replace(".", ",")}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="custoPct" name="Custo" stackId="dre" fill="var(--color-danger-500)" />
        <Bar dataKey="despesaPct" name="Despesa" stackId="dre" fill="var(--color-warning-500)" />
        <Bar dataKey="resultadoPct" name="Resultado" stackId="dre" fill="var(--color-success-500)" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    );
  }
  if (kind === "capital_giro_vs_divida") {
    return (
      <ComposedChart data={ctx.ncgSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <ReferenceLine y={0} stroke="var(--color-line-strong)" />
        <Bar dataKey="divida" name="Dívida financeira" fill="var(--color-danger-500)" radius={[3, 3, 0, 0]} />
        <Line dataKey="value" name="Capital de giro" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    );
  }
  if (kind === "pl_evolucao") {
    return (
      <ComposedChart data={ctx.bpSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        {moneyAxis}
        {tooltipMoney}
        <Bar dataKey="pl" name="Patrimônio líquido" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    );
  }
  if (kind === "rentabilidade_evolucao") {
    return (
      <ComposedChart data={ctx.rentabilidadeSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => (value == null ? "—" : `${Number(value).toFixed(1).replace(".", ",")}%`)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <ReferenceLine y={0} stroke="var(--color-line-strong)" />
        <Line dataKey="roe" name="ROE" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        <Line dataKey="roa" name="ROA" stroke="var(--color-navy-700)" strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </ComposedChart>
    );
  }
  // resultado (default)
  return (
    <ComposedChart data={ctx.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
      {grid}
      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
      {moneyAxis}
      {tooltipMoney}
      <Bar dataKey="receita" name="Receita líquida" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
      <Line dataKey="resultado" name="Resultado" stroke="var(--color-success-500)" strokeWidth={2} dot={{ r: 2 }} />
    </ComposedChart>
  );
}

function CapitalStructureChart({ ctx }) {
  const passivo = Math.abs(Number(ctx.bp.find((r) => r.codigo_gerencial === "02")?.saldo || 0)) || 0.0001;
  const pl = Math.abs(Number(ctx.bp.find((r) => r.codigo_gerencial === "03")?.saldo || 0)) || 0.0001;
  const data = [
    { name: "Passivo", value: passivo },
    { name: "Patrimônio líquido", value: pl },
  ];
  return (
    <div className="flex h-full flex-col items-center">
      <p className="mb-2 self-start text-[13px] font-medium text-ink-900">Estrutura de capital</p>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex gap-4 text-[12px] text-ink-600">
        {data.map((entry, index) => (
          <span key={entry.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// Cascata do fluxo de caixa: recharts não tem um tipo "waterfall" pronto —
// o truque de sempre é uma barra empilhada com uma base INVISÍVEL (o
// "chão" de onde a barra visível começa a subir/descer) por baixo da barra
// de verdade. Saldo inicial/final têm base 0 (começam do chão) e cor
// própria; Operacional/Investimento/Financiamento sobem ou descem a partir
// de onde o caixa parou no passo anterior.
function DfcWaterfallChart({ ctx }) {
  const items = ctx.dfcWaterfall || [];
  let running = 0;
  const data = items.map((item) => {
    if (item.isTotal) {
      running = item.value;
      return { name: item.name, base: 0, value: item.value, isTotal: true, raw: item.value };
    }
    const start = running;
    running += item.value;
    return { name: item.name, base: Math.min(start, running), value: Math.abs(item.value), isTotal: false, raw: item.value };
  });
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[13px] font-medium text-ink-900">Cascata do fluxo de caixa</p>
      <div className="h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(value, name, props) => money(props?.payload?.raw ?? value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value" stackId="wf" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.isTotal ? "var(--color-navy-700)" : entry.raw < 0 ? "var(--color-danger-500)" : "var(--color-success-500)"} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ParetoDespesasChart({ ctx }) {
  const data = ctx.paretoDespesas || [];
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[13px] font-medium text-ink-900">Maiores despesas</p>
      <div className="h-64 flex-1">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--color-line)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "var(--color-ink-600)" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" name="Despesa" radius={[0, 3, 3, 0]} fill="var(--color-danger-500)" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-400">Sem despesas no período.</div>
        )}
      </div>
    </div>
  );
}

// Convenção usada aqui (ver dashboardData.js): Custos diretos como
// variável, as 4 linhas de despesas operacionais como fixo — não existe
// uma classificação fixo/variável configurável no app hoje.
function BreakEvenChart({ ctx }) {
  const breakEven = ctx.breakEven || {};
  const { fixedCosts = 0, variableCostRatio = 0, breakEvenRevenue, series = [] } = breakEven;
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-900">Ponto de equilíbrio</p>
        <p className="text-[11px] text-ink-400">
          Custo fixo {money(fixedCosts)} · Margem de contribuição {((1 - variableCostRatio) * 100).toFixed(1).replace(".", ",")}%
        </p>
      </div>
      <div className="h-56 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line dataKey="receita" name="Receita" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line dataKey="custoTotal" name="Custo + despesa" stroke="var(--color-danger-500)" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 3" />
            {Number.isFinite(breakEvenRevenue) && (
              <ReferenceLine y={breakEvenRevenue} stroke="var(--color-navy-700)" strokeDasharray="3 3" label={{ value: "Equilíbrio", position: "insideTopLeft", fontSize: 10, fill: "var(--color-navy-700)" }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-ink-400">
        {Number.isFinite(breakEvenRevenue) ? `Receita de equilíbrio no período: ${money(breakEvenRevenue)}` : "Margem de contribuição insuficiente pra calcular o ponto de equilíbrio."}
      </p>
    </div>
  );
}

function GroupComparisonChart({ ctx }) {
  const data = ctx.groupComparison;
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[13px] font-medium text-ink-900">Comparativo entre empresas</p>
      <div className="h-64 flex-1">
        {data ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="receita" name="Receita" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="ebitda" name="EBITDA" fill="var(--color-navy-700)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro líquido" fill="var(--color-success-500)" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-400">Disponível só em modo grupo.</div>
        )}
      </div>
    </div>
  );
}

function IndicatorRadarChart({ ctx }) {
  const data = ctx.radarIndicators || [];
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[13px] font-medium text-ink-900">Radar de indicadores</p>
      <div className="h-56 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--color-line)" />
            <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 11, fill: "var(--color-ink-500)" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <RechartsRadar name="Score" dataKey="score" stroke="var(--color-accent-500)" fill="var(--color-accent-500)" fillOpacity={0.35} />
            <Tooltip
              formatter={(value, name, props) => {
                const raw = props?.payload?.raw;
                if (raw == null) return "—";
                return formatWidgetValue(raw, props?.payload?.format);
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[10.5px] text-ink-400">Posição relativa a uma faixa de referência (0–100), não uma meta da empresa.</p>
    </div>
  );
}

function DfcOperationalChart({ ctx }) {
  const data = ctx.dfcOperationalComposition || [];
  return (
    <div className="flex h-full flex-col items-center">
      <p className="mb-2 self-start text-[13px] font-medium text-ink-900">Composição do caixa operacional</p>
      <div className="h-48 w-full">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-400">Sem movimento operacional no período.</div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-ink-600">
        {data.map((entry, index) => (
          <span key={entry.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// Cascata do resultado (DRE): mesmíssima técnica da cascata do DFC acima
// (barra empilhada com base invisível) — só troca a fonte dos passos.
function ResultWaterfallChart({ ctx }) {
  const items = ctx.dreWaterfall || [];
  let running = 0;
  const data = items.map((item) => {
    if (item.isTotal) {
      running = item.value;
      return { name: item.name, base: 0, value: item.value, isTotal: true, raw: item.value };
    }
    const start = running;
    running += item.value;
    return { name: item.name, base: Math.min(start, running), value: Math.abs(item.value), isTotal: false, raw: item.value };
  });
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[13px] font-medium text-ink-900">Cascata do resultado</p>
      <div className="h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={54} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(value, name, props) => money(props?.payload?.raw ?? value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="value" stackId="wf" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.isTotal ? "var(--color-navy-700)" : entry.raw < 0 ? "var(--color-danger-500)" : "var(--color-success-500)"} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Pizza de composição genérica — mesmo padrão visual de CapitalStructureChart
// e DfcOperationalChart, parametrizada por título+dados pra não repetir o
// bloco inteiro pras duas novas composições (despesas e receita).
function CompositionPieChart({ title, data, emptyLabel }) {
  return (
    <div className="flex h-full flex-col items-center">
      <p className="mb-2 self-start text-[13px] font-medium text-ink-900">{title}</p>
      <div className="h-48 w-full">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => money(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-400">{emptyLabel}</div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-ink-600">
        {data.map((entry, index) => (
          <span key={entry.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartWidgetCard({ definition, ctx }) {
  if (definition.chart === "balanco") {
    return <BalanceChartWidget ctx={ctx} />;
  }
  if (definition.chart === "estrutura_capital") {
    return <CapitalStructureChart ctx={ctx} />;
  }
  if (definition.chart === "dfc_cascata") {
    return <DfcWaterfallChart ctx={ctx} />;
  }
  if (definition.chart === "pareto_despesas") {
    return <ParetoDespesasChart ctx={ctx} />;
  }
  if (definition.chart === "ponto_equilibrio") {
    return <BreakEvenChart ctx={ctx} />;
  }
  if (definition.chart === "comparativo_empresas") {
    return <GroupComparisonChart ctx={ctx} />;
  }
  if (definition.chart === "radar_indicadores") {
    return <IndicatorRadarChart ctx={ctx} />;
  }
  if (definition.chart === "dfc_operacional") {
    return <DfcOperationalChart ctx={ctx} />;
  }
  if (definition.chart === "dre_cascata") {
    return <ResultWaterfallChart ctx={ctx} />;
  }
  if (definition.chart === "despesas_composicao") {
    return <CompositionPieChart title="Composição das despesas operacionais" data={ctx.despesasComposicao || []} emptyLabel="Sem despesas no período." />;
  }
  if (definition.chart === "receita_composicao") {
    return <CompositionPieChart title="Composição da receita bruta" data={ctx.receitaComposicao || []} emptyLabel="Sem receita no período." />;
  }
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[13px] font-medium text-ink-900">{definition.label}</p>
      <div className="h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {renderLineOrBarChart(definition.chart, ctx)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TableWidgetCard({ definition, ctx, maxRows }) {
  const state = useAppState();
  const [expandedRows, setExpandedRows] = useState(new Set());
  const tab = definition.table === "bp" ? "BP" : definition.table?.startsWith("dfc_") ? "DFC" : "DRE";
  const isDfc = tab === "DFC";
  // dfc_direta/dfc_indireta refazem a busca de contrapartida (combinação,
  // não mais barata) pra cada lançamento de caixa do período — sem memo
  // isso rodava de novo a cada render, inclusive só de abrir/fechar uma
  // linha deste próprio card (expandedRows abaixo). Ver mesmo ajuste em
  // pages/Dfc.jsx.
  const builtRows = useMemo(() => {
    if (definition.table === "dfc_direta") return buildDfcDirect();
    if (definition.table === "dfc_indireta") return buildDfcIndirect();
    if (definition.table === "executiva") return ctx.executive;
    if (definition.table === "dre_resumida") return ctx.dreResumida;
    return (definition.table === "bp" ? ctx.bp : ctx.dre).filter(
      (row) => row.kind === "synthetic" && row.hasValue && Number(row.nivel || 0) >= 1 && Number(row.nivel || 0) <= 2
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    definition.table,
    ctx.executive,
    ctx.dreResumida,
    ctx.bp,
    ctx.dre,
    state.journal,
    state.periodStart,
    state.periodEnd,
    state.mappings,
    state.accounts,
    state.plano,
    state.dfcLinks,
    state.dfcRules,
    state.dfcOverrides,
    state.dfcStructure,
  ]);
  const rows = state.hideZeroNoMovement
    ? builtRows.filter((row) => row.natureza === "heading" || !isZeroNoMovement(row))
    : builtRows;
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;
  const toggleRow = (code) =>
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const hiddenCount = rows.length - visibleRows.length;
  // "Saldo anterior" was never offered on this compact card — only the
  // months plus an optional "Saldo total" — so that stays pinned off here
  // even though reportColumns() can add it; this only picks up whatever
  // ReportSettingsMenu's "Mostrar coluna saldo total" is set to.
  const columns = state.reportCompare
    ? reportColumns({
        tab,
        reportCompare: true,
        showPreviousBalance: false,
        showReportTotal: tab === "BP" ? state.showReportTotalBP : tab === "DFC" ? state.showReportTotalDFC : state.showReportTotalDRE,
        bpMonthlyMode: state.bpMonthlyMode,
      })
    : ["saldo"];
  const valueFor = (row, column) => {
    if (column === "saldo") return row.saldo || 0;
    if (row.isPercentage) return column === "total" ? row.saldo : row.monthValues?.[column] || 0;
    return columnValue(row, column, { tab, bpMonthlyMode: state.bpMonthlyMode, months: ctx.months });
  };
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2"><p className="text-[13px] font-medium text-ink-900">{definition.label}</p><ReportSettingsMenu tab={tab} /></div>
      <div className="overflow-x-auto"><div className="min-w-max">
        {state.reportCompare && <div className="mb-1 grid gap-3 text-[10px] text-ink-400" style={{ gridTemplateColumns: `minmax(180px, 1fr) ${columns.map(() => "92px").join(" ")}` }}><span>Conta</span>{columns.map((column) => <span key={column} className="text-right">{columnLabel(column)}</span>)}</div>}
      <div className="flex flex-col gap-1.5">
        {visibleRows.map((row) => {
          const isBold = row.isFormula || Number(row.nivel || 0) <= 1;
          const children = isDfc ? row.contas || [] : [];
          const isOpen = expandedRows.has(row.codigo_gerencial);
          return (
            <div key={row.codigo_gerencial}>
              <div
                role={children.length ? "button" : undefined}
                tabIndex={children.length ? 0 : undefined}
                onClick={children.length ? () => toggleRow(row.codigo_gerencial) : undefined}
                className={`grid items-center gap-3 text-[13px] ${isBold ? "border-t border-line pt-1.5 font-semibold text-ink-900" : "text-ink-600"} ${children.length ? "cursor-pointer hover:bg-surface-muted" : ""}`}
                style={{ gridTemplateColumns: `minmax(180px, 1fr) ${columns.map(() => "92px").join(" ")}` }}
              >
                <span className="flex min-w-0 items-center gap-1 truncate">
                  {children.length > 0 && <ChevronRight size={13} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
                  {row.categoria_gerencial}
                </span>
                {columns.map((column) => { const value = valueFor(row, column); return <span key={column} className={`whitespace-nowrap text-right tabular-nums ${row.isPercentage ? "text-navy-700" : moneyClass(value)}`}>{row.isPercentage ? `${Number(value || 0).toFixed(1).replace(".", ",")}%` : money(value)}</span>; })}
              </div>
              {isOpen && children.map((child) => (
                <div
                  key={child.classificacao}
                  className="grid items-center gap-3 bg-surface-page/60 py-1 text-[12px] text-ink-500"
                  style={{ gridTemplateColumns: `minmax(180px, 1fr) ${columns.map(() => "92px").join(" ")}` }}
                >
                  <span className="truncate pl-5">{child.nome_conta}</span>
                  {columns.map((column) => { const value = valueFor(child, column); return <span key={column} className={`whitespace-nowrap text-right tabular-nums ${moneyClass(value)}`}>{money(value)}</span>; })}
                </div>
              ))}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[12px] text-ink-400">Sem lançamentos no período selecionado.</p>}
        {hiddenCount > 0 && <p className="pt-0.5 text-[11px] text-ink-400">+{hiddenCount} linhas — veja o relatório completo.</p>}
      </div></div></div>
    </div>
  );
}

// A shortcut card that also carries real numbers — not just an icon and a
// description with nothing behind it. "Abrir relatório completo" is there
// for whoever wants comparativo/análise vertical/exportação, but the
// headline figures are already sitting right here.
function LinkWidgetCard({ definition, ctx, onNavigate }) {
  const Icon = definition.icon;
  const rows =
    definition.preview === "dre_resumida"
      ? ctx?.dreResumida
      : definition.preview === "bp_resumo"
        ? ctx?.bp?.filter((row) => row.kind === "synthetic" && row.hasValue && Number(row.nivel || 0) >= 1 && Number(row.nivel || 0) <= 2)
        : null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-950 text-white">
            {Icon && <Icon size={14} strokeWidth={1.8} />}
          </span>
          <p className="truncate text-[13px] font-medium text-ink-900">{definition.label}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.(definition.href, definition.navState ? { state: definition.navState } : undefined)}
          disabled={!onNavigate}
          className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-accent-600 hover:underline disabled:text-ink-300 disabled:no-underline"
        >
          Relatório completo <ArrowUpRight size={12} />
        </button>
      </div>
      {rows && rows.length > 0 ? (
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {rows.map((row) => {
            const isBold = row.isFormula || Number(row.nivel || 0) <= 1;
            return (
              <div
                key={row.codigo_gerencial}
                className={`flex items-center justify-between gap-3 text-[13px] ${isBold ? "border-t border-line pt-1.5 font-semibold text-ink-900" : "text-ink-600"}`}
              >
                <span className="truncate">{row.categoria_gerencial}</span>
                <span className={`shrink-0 tabular-nums ${moneyClass(row.saldo)}`}>{money(row.saldo)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] leading-snug text-ink-400">{definition.description}</p>
      )}
    </div>
  );
}

function ListWidgetCard({ definition, ctx, maxRows }) {
  if (definition.list === "destaques_dre") {
    const visible = maxRows ? ctx.destaques.slice(0, maxRows) : ctx.destaques;
    const hiddenCount = ctx.destaques.length - visible.length;
    return (
      <div>
        <p className="mb-3 text-[13px] font-medium text-ink-900">{definition.label}</p>
        <div className="flex flex-col gap-2.5">
          {visible.map((row) => (
            <div key={row.codigo_gerencial} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate text-ink-700">{row.categoria_gerencial}</span>
              <span className={`shrink-0 font-medium tabular-nums ${moneyClass(row.saldo)}`}>{money(row.saldo)}</span>
            </div>
          ))}
          {ctx.destaques.length === 0 && <p className="text-[12px] text-ink-400">Sem lançamentos no período selecionado.</p>}
          {hiddenCount > 0 && <p className="pt-0.5 text-[11px] text-ink-400">+{hiddenCount} linhas — veja o relatório completo.</p>}
        </div>
      </div>
    );
  }
  if (definition.list === "checklist") {
    return (
      <div>
        <p className="mb-3 text-[13px] font-medium text-ink-900">{definition.label}</p>
        <div className="flex flex-col gap-2.5">
          {ctx.checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 text-[13px]">
              {item.done ? (
                <CheckCircle2 size={17} strokeWidth={1.8} className="shrink-0 text-success-600" />
              ) : (
                <Circle size={17} strokeWidth={1.8} className="shrink-0 text-ink-300" />
              )}
              <span className={item.done ? "text-ink-500 line-through decoration-ink-300" : "text-ink-800"}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (definition.list === "sem_depara") {
    return (
      <div>
        <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-ink-900">
          <TriangleAlert size={15} strokeWidth={1.8} className="text-warning-500" />
          {definition.label}
        </p>
        <div className="flex flex-col gap-2">
          {ctx.missing.slice(0, 8).map((account) => (
            <div key={account.classificacao} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate text-ink-700">{account.nome_conta || account.classificacao}</span>
              <span className="shrink-0 text-[11px] text-ink-400">{account.classificacao}</span>
            </div>
          ))}
          {ctx.missing.length === 0 && <p className="text-[12px] text-ink-400">Todas as contas estão mapeadas.</p>}
          {ctx.missing.length > 8 && <p className="text-[11px] text-ink-400">+{ctx.missing.length - 8} outras contas</p>}
        </div>
      </div>
    );
  }
  return null;
}

// The actual rendered content of one widget — a chart, list, table, or KPI
// — with no card chrome (background/padding/shadow) of its own, so it can
// be dropped into a normal grid cell or into a preview modal alike.
export function WidgetBody({ definition, ctx, onOpenDetail, onNavigate, maxRows }) {
  if (definition.type === "chart") return <ChartWidgetCard definition={definition} ctx={ctx} />;
  if (definition.type === "list") return <ListWidgetCard definition={definition} ctx={ctx} maxRows={maxRows} />;
  if (definition.type === "table") return <TableWidgetCard definition={definition} ctx={ctx} maxRows={maxRows} />;
  if (definition.type === "link") return <LinkWidgetCard definition={definition} ctx={ctx} onNavigate={onNavigate} />;
  if (definition.type === "kpi") {
    if (!onOpenDetail) return <KpiInline definition={definition} ctx={ctx} />;
    return (
      <button type="button" onClick={() => onOpenDetail(definition)} className="flex h-full w-full flex-col text-left">
        <KpiInline definition={definition} ctx={ctx} />
      </button>
    );
  }
  return null;
}

export { DetailModal };

// The real, read-only view — same layout math as the editor (gridLayout.js),
// just with dragging and resizing turned off, so a tab looks exactly like
// however it was last arranged in Personalizar.
export default function WidgetGrid({ widgets, ctx, spacing = DEFAULT_SPACING }) {
  const [detailFor, setDetailFor] = useState(null);
  const navigate = useNavigate();
  const appState = useAppState();
  const marginPx = marginPxFor(spacing);
  // No celular, uma grade de 8 colunas espreme cada widget "sm"/"md" numa
  // tira de ~40-90px — ilegível. Em vez de uma versão paralela da tela,
  // reaproveita a MESMA grade em modo coluna única: cada widget vira uma
  // linha inteira, na mesma ordem vertical que já tinha (por y, depois x),
  // sem mudar nada do editor (Personalizar é admin-only, fica só desktop).
  const isMobile = useIsMobile();

  // WIDGET_CATALOG is a shared module-level array that lib/indicators.js
  // patches in place on every indicator create/edit/reset — this map must
  // be rebuilt whenever that happens (keyed on indicatorOverrides), not
  // just once on first mount, or an edited indicator would keep showing
  // its old formula until a full page reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogById = useMemo(() => new Map(WIDGET_CATALOG.map((definition) => [definition.id, definition])), [appState.indicatorOverrides]);
  const desktopLayout = useMemo(
    () => widgets.map((entry) => layoutFor(entry, catalogById.get(entry.id))),
    [widgets, catalogById]
  );
  const layout = useMemo(() => {
    if (!isMobile) return desktopLayout;
    const ordered = [...desktopLayout].sort((a, b) => a.y - b.y || a.x - b.x);
    let cursorY = 0;
    return ordered.map((item) => {
      const stacked = { ...item, x: 0, y: cursorY, w: 1 };
      cursorY += item.h;
      return stacked;
    });
  }, [desktopLayout, isMobile]);

  function handleOpenDetail(definition) {
    const { value, format } = definition.value(ctx);
    const detail = definition.detail(ctx);
    setDetailFor({ title: definition.label, value: formatWidgetValue(value, format), ...detail });
  }

  return (
    <>
      <GridLayout
        className="layout"
        layout={layout}
        cols={isMobile ? 1 : GRID_COLS}
        rowHeight={ROW_HEIGHT}
        margin={[marginPx, marginPx]}
        containerPadding={[0, 0]}
        isDraggable={false}
        isResizable={false}
      >
        {widgets.map((entry) => {
          const definition = catalogById.get(entry.id);
          if (!definition) return null;
          return (
            <div key={entry.id} className="overflow-hidden rounded-xl bg-surface-card p-4 shadow-sm transition-shadow hover:shadow-md">
              <WidgetBody definition={definition} ctx={ctx} onOpenDetail={handleOpenDetail} onNavigate={navigate} />
            </div>
          );
        })}
      </GridLayout>
      <DetailModal detail={detailFor} onClose={() => setDetailFor(null)} />
    </>
  );
}

// A plain, naturally-flowing grid of the same widgets — no drag/resize, no
// absolute positioning. Used purely as an off-screen capture target for the
// "Relatório atual" PDF: react-grid-layout positions every card with CSS
// transforms, which html2canvas only ever renders the first of — this
// sidesteps that entirely with a layout html2canvas has no trouble with,
// reflowing into a fixed 3-column grid instead of matching on-screen pixel
// positions exactly (which is what the export is expected to do anyway).
//
// Card height MUST be capped to match the live grid (same h*ROW_HEIGHT math
// as gridLayout.js) rather than left to grow with content. Without this, a
// table/list widget with many rows renders every row unclipped — the
// on-screen card scrolls internally, but a screenshot has no scrollbar, so
// the capture just kept growing (one dashboard measured 150+ resulting PDF
// pages from a single tall widget). Matching the real card height also
// makes the screenshot look like the actual dashboard instead of a
// stretched-out version of it.
// Rough text-row metrics for TableWidgetCard/ListWidgetCard's own CSS
// (text-[13px] rows + gap-1.5/2.5, mb-3 label) — used only to pre-compute
// how many rows fit in a card's height so the print version can slice the
// data itself instead of relying on CSS to clip whatever doesn't fit.
const PRINT_ROW_HEIGHT_PX = 27;
const PRINT_HEADER_HEIGHT_PX = 25;
const PRINT_CARD_PADDING_PX = 32; // p-4 top + bottom

function printRowCap(heightPx) {
  return Math.max(1, Math.floor((heightPx - PRINT_CARD_PADDING_PX - PRINT_HEADER_HEIGHT_PX) / PRINT_ROW_HEIGHT_PX));
}

// A plain, naturally-flowing grid of the same widgets — no drag/resize, no
// absolute positioning. Used purely as an off-screen capture target for the
// "Relatório atual" PDF: react-grid-layout positions every card with CSS
// transforms, which html2canvas only ever renders the first of — this
// sidesteps that entirely with a layout html2canvas has no trouble with,
// reflowing into a fixed 3-column grid instead of matching on-screen pixel
// positions exactly (which is what the export is expected to do anyway).
//
// Card height is capped to roughly match the live grid (same h*ROW_HEIGHT
// math as gridLayout.js) so one abnormally tall widget can't balloon the
// export into hundreds of pages. Table/list widgets get their row COUNT
// capped to fit that height (with a "+N linhas" note) instead of being
// clipped by CSS overflow:hidden — combining a hard CSS clip with
// html2canvas's foreignObjectRendering (needed for charts to render at all)
// produced corrupted, overlapping text at the clip boundary, so the safer
// fix is to never hand html2canvas more content than the box needs in the
// first place.
export function PrintableWidgetGrid({ widgets, ctx, spacing = DEFAULT_SPACING }) {
  const appState = useAppState();
  const marginPx = marginPxFor(spacing);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogById = useMemo(() => new Map(WIDGET_CATALOG.map((definition) => [definition.id, definition])), [appState.indicatorOverrides]);
  return (
    <div style={{ width: 1100, background: "#ffffff", padding: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: marginPx }}>
      {widgets.map((entry) => {
        const definition = catalogById.get(entry.id);
        if (!definition) return null;
        const { h } = layoutFor(entry, definition);
        const heightPx = h * ROW_HEIGHT + (h - 1) * marginPx;
        const isRowBased = definition.type === "table" || definition.type === "list";
        return (
          <div
            key={entry.id}
            // bg-white literal on purpose, not bg-surface-card — this card is
            // only ever captured off-screen for the PDF export (see
            // domSnapshotPdf.js), which must always look like white paper
            // regardless of which theme is active on screen.
            className="rounded-xl bg-white p-4 ring-1 ring-line"
            style={{
              height: heightPx,
              overflow: isRowBased ? "visible" : "hidden",
              gridColumn: definition.type === "chart" || definition.type === "table" ? "span 2" : "span 1",
            }}
          >
            <WidgetBody definition={definition} ctx={ctx} maxRows={isRowBased ? printRowCap(heightPx) : undefined} />
          </div>
        );
      })}
    </div>
  );
}

// KPI content without its own card chrome — the outer grid cell already
// supplies the white background/shadow/padding, so this only renders the
// label, value and icon.
function KpiInline({ definition, ctx }) {
  const Icon = definition.icon;
  const { value, format } = definition.value(ctx);
  const tone = format === "money" ? moneyClass(value) : "text-ink-900";
  // Só pra fórmulas de razão/soma-de-várias-linhas (Margem, Liquidez, ROE,
  // Giro do ativo etc.) — um card de linha única do DRE/Balanço mostraria
  // aqui exatamente o mesmo texto que já está no título do card, sem
  // acrescentar nada. PrintableWidgetGrid reaproveita este mesmo componente
  // pra montar o PDF (domSnapshotPdf.js tira um "print" dele), então esse
  // resuminho sai tanto na tela quanto no PDF de um só lugar.
  const caption = definition.formula && !isSingleLineFormula(definition.formula) ? describeIndicatorFormula(definition.formula) : null;
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-400">{definition.label}</p>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <Icon size={14} strokeWidth={1.8} />
          </span>
        )}
      </div>
      <p className={`mt-1.5 text-[22px] font-medium ${tone}`}>{formatWidgetValue(value, format)}</p>
      {caption && <p className="mt-1 mb-auto text-[10.5px] leading-snug text-ink-400">{caption}</p>}
      {!caption && <div className="mb-auto" />}
    </>
  );
}
