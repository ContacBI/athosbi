import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronRight, Copy, Download, MoreHorizontal, Pencil, Plus, Star, Target, Trash2, Upload, Wand2 } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { persistActiveCompany } from "../lib/companies.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { contextForPeriod, dataMonths } from "../lib/assistant/context.js";
import {
  FORMULA_CODES,
  INPUT_LINES,
  LINE_ORDER,
  actualMonths,
  budgetContext,
  budgetMatrix,
  budgetsOfYear,
  childLines,
  deviation,
  exportBudgetXlsx,
  fillFromActuals,
  importBudgetXlsx,
  lineName,
  monthShort,
  monthsWithActuals,
  newBudget,
  principalBudget,
  signOf,
  sumMonths,
  yearMonths,
} from "../lib/budget.js";
import { money } from "../lib/format.js";
import { tokenInfo } from "../lib/presentations.js";
import ProjecaoAno from "../components/ProjecaoAno.jsx";

const TONE = {
  bom: { dot: "bg-success-500", text: "text-success-600", label: "Dentro do orçado" },
  atencao: { dot: "bg-warning-500", text: "text-warning-700", label: "Até 10% pior" },
  ruim: { dot: "bg-danger-500", text: "text-danger-600", label: "Mais de 10% pior" },
  neutro: { dot: "bg-line-strong", text: "text-ink-500", label: "" },
};

const whole = (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const compact = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e4) return `${sign}R$ ${(abs / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return money(n);
};

function parseTyped(text) {
  const clean = String(text || "").replace(/R\$|\s/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/\.(?=\d{3}(\D|$))/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

// Uma célula do orçamento: mostra formatado, edita "cru".
function MoneyCell({ value, onChange, disabled }) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={draft ?? (value ? whole(value) : "")}
      placeholder="0"
      onFocus={(event) => {
        setDraft(value ? String(Math.round(value)) : "");
        requestAnimationFrame(() => event.target.select());
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft != null) onChange(parseTyped(draft));
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      className="orc-cell h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-right text-[12.5px] tabular-nums text-ink-800 outline-none hover:border-line focus:border-accent-400 focus:bg-surface-card disabled:cursor-default disabled:hover:border-transparent"
    />
  );
}

function RowMenu({ onSpread, onCopyFirst, onClear }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-6 w-6 items-center justify-center rounded text-ink-300 opacity-0 hover:bg-surface-muted hover:text-ink-700 group-hover:opacity-100" title="Mais">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <span className="absolute left-0 top-7 z-40 flex w-56 flex-col rounded-lg bg-surface-card p-1 text-[12.5px] shadow-lg ring-1 ring-line" onClick={() => setOpen(false)}>
            <button type="button" onClick={onSpread} className="rounded-md px-2.5 py-1.5 text-left text-ink-700 hover:bg-surface-muted">
              Distribuir um total do ano
            </button>
            <button type="button" onClick={onCopyFirst} className="rounded-md px-2.5 py-1.5 text-left text-ink-700 hover:bg-surface-muted">
              Repetir janeiro nos outros meses
            </button>
            <button type="button" onClick={onClear} className="rounded-md px-2.5 py-1.5 text-left text-danger-600 hover:bg-danger-50">
              Zerar a linha
            </button>
          </span>
        </>
      )}
    </span>
  );
}

function FillPanel({ ano, years, onApply, onClose }) {
  const [mode, setMode] = useState(years.includes(ano - 1) ? "ano_anterior" : "media");
  const [pct, setPct] = useState("0");
  return (
    <div className="rounded-xl border border-accent-200 bg-accent-50/50 p-4">
      <p className="text-[13px] font-semibold text-ink-900">Preencher a partir do realizado</p>
      <p className="mt-0.5 text-[12px] text-ink-500">Substitui os valores de todas as linhas. Depois é só ajustar o que quiser.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Base
          <select value={mode} onChange={(event) => setMode(event.target.value)} className="h-9 rounded-lg border border-line bg-surface-card px-2.5 text-[13px] outline-none focus:border-accent-400">
            <option value="ano_anterior" disabled={!years.includes(ano - 1)}>
              Mesmo mês de {ano - 1}
              {!years.includes(ano - 1) ? " (sem lançamentos)" : ""}
            </option>
            <option value="media">Média mensal do realizado</option>
            <option value="ultimo">Repetir o último mês com realizado</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Reajuste (%)
          <input value={pct} onChange={(event) => setPct(event.target.value)} inputMode="decimal" className="orc-pct h-9 w-24 rounded-lg border border-line bg-surface-card px-2.5 text-[13px] outline-none focus:border-accent-400" />
        </label>
        <button type="button" onClick={() => onApply(mode, parseTyped(pct))} className="h-9 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600">
          Preencher
        </button>
        <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-ink-500 hover:bg-surface-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Kpi({ title, item, inverted }) {
  const tone = TONE[item.tone] || TONE.neutro;
  const reach = item.reach == null ? null : item.reach;
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
      <p className="flex items-center justify-between text-[12px] text-ink-500">
        {title}
        <span className={`flex items-center gap-1.5 text-[11px] font-medium ${tone.text}`}>
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          {tone.label}
        </span>
      </p>
      <p className="text-[22px] font-semibold tabular-nums text-ink-900">{compact(item.realizado)}</p>
      <p className="text-[12px] text-ink-500">
        de {compact(item.orcado)} orçado · <strong className="text-ink-800">{reach == null ? "—" : `${reach.toFixed(0)}%`}</strong>
        {inverted ? " do orçado (gastar menos é bom)" : " do orçado"}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${tone.dot}`} style={{ width: `${Math.max(2, Math.min(100, reach || 0))}%` }} />
      </div>
    </div>
  );
}

export default function Orcamento() {
  const state = useAppState();
  const hasData = state.accounts.length > 0 || state.journal.length > 0;
  const company = state.companies.find((item) => item.id === state.activeCompanyId) || null;
  const canEdit = Boolean(state.isAdmin || (company && (company.responsaveis || []).includes(state.userEmail)) || (state.activeGroupId && isResponsavelForGroup(state, state.activeGroupId)));

  const years = useMemo(() => [...new Set(dataMonths().map((month) => Number(month.slice(0, 4))))].sort(), [state.journal, state.accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = new Date();
  const defaultYear = (state.orcamentos || []).some((budget) => Number(budget.ano) === today.getFullYear()) || years.includes(today.getFullYear()) ? today.getFullYear() : years[years.length - 1] || today.getFullYear();
  const [ano, setAno] = useState(defaultYear);
  const yearOptions = [...new Set([...years, ...(state.orcamentos || []).map((budget) => Number(budget.ano)), today.getFullYear(), today.getFullYear() + 1, ano])].sort();

  const list = state.orcamentos || [];
  const versions = budgetsOfYear(list, ano);
  const [versionId, setVersionId] = useState(null);
  const budget = versions.find((item) => item.id === versionId) || principalBudget(list, ano);
  const [tab, setTab] = useState(budget ? "comparar" : "montar");
  const [fillOpen, setFillOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState("");
  const saveTimer = useRef(null);
  const fileRef = useRef(null);

  // Realizado do ano todo (e do anterior, pra montar a partir dele).
  const [yearCtx, setYearCtx] = useState(null);
  useEffect(() => {
    if (!hasData) return undefined;
    const handle = setTimeout(() => setYearCtx({ ano, ctx: contextForPeriod(`${ano}-01-01`, `${ano}-12-31`) }), 30);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, hasData, state.journal, state.mappings, state.accounts, state.plano]);
  const ctx = yearCtx?.ano === ano ? yearCtx.ctx : null;

  const months = yearMonths(ano);
  const actualMonthKeys = useMemo(() => (ctx ? monthsWithActuals(ctx, ano) : []), [ctx, ano]);
  const [untilMonth, setUntilMonth] = useState("");
  const [compareMode, setCompareMode] = useState("acumulado");
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const closedActuals = actualMonthKeys.filter((month) => month < currentMonth);
  // Padrão: o último mês FECHADO com realizado (o mês corrente ainda está pela metade).
  const lastActual = closedActuals[closedActuals.length - 1] || actualMonthKeys[actualMonthKeys.length - 1] || months[0];
  const until = untilMonth && months.includes(untilMonth) ? untilMonth : lastActual;
  const compareMonths = compareMode === "mes" ? [until] : compareMode === "ano" ? months : months.filter((month) => month <= until);

  function persist(nextList) {
    setData({ orcamentos: nextList });
    setSaving("Salvando…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistActiveCompany()
        .then(() => setSaving("Salvo"))
        .catch((error) => {
          console.error(error);
          setSaving("Não consegui salvar — confira a conexão");
        });
    }, 700);
  }
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function updateBudget(next) {
    const stamped = { ...next, atualizadoEm: new Date().toISOString(), atualizadoPor: state.userEmail || "" };
    persist((state.orcamentos || []).map((item) => (item.id === stamped.id ? stamped : item)));
  }

  function createBudget(fromId) {
    const source = fromId ? list.find((item) => item.id === fromId) : null;
    const fresh = newBudget(ano, source ? `${source.versao} (revisado)` : versions.length ? `Versão ${versions.length + 1}` : "Original");
    const created = source ? { ...fresh, valores: structuredClone(source.valores || {}), abertas: [...(source.abertas || [])] } : fresh;
    const others = list.map((item) => (Number(item.ano) === Number(ano) ? { ...item, principal: false } : item));
    persist([...others, { ...created, principal: true }]);
    setVersionId(created.id);
    setTab("montar");
  }

  function setCell(code, month, typed) {
    const sign = signOf(code);
    const stored = sign === -1 ? -Math.abs(typed) : typed;
    updateBudget({ ...budget, valores: { ...budget.valores, [code]: { ...(budget.valores?.[code] || {}), [month]: stored } } });
  }

  function setRow(code, values) {
    updateBudget({ ...budget, valores: { ...budget.valores, [code]: values } });
  }

  function toggleOpen(code) {
    const opened = (budget.abertas || []).includes(code);
    if (opened) {
      // Fechando: a linha volta a ter um valor só — a soma das filhas.
      const sum = Object.fromEntries(months.map((month) => [month, childLines(code).reduce((total, child) => total + Number(budget.valores?.[child.code]?.[month] || 0), 0)]));
      updateBudget({ ...budget, abertas: budget.abertas.filter((item) => item !== code), valores: { ...budget.valores, [code]: sum } });
    } else {
      // Abrindo: se a linha tinha valor e as filhas não, a primeira filha
      // herda (pra não sumir nada do total).
      const kids = childLines(code);
      const kidsEmpty = kids.every((child) => !Object.values(budget.valores?.[child.code] || {}).some(Boolean));
      const valores = { ...budget.valores };
      if (kidsEmpty && kids.length && Object.values(budget.valores?.[code] || {}).some(Boolean)) valores[kids[0].code] = { ...budget.valores[code] };
      updateBudget({ ...budget, abertas: [...(budget.abertas || []), code], valores });
    }
  }

  function applyFill(mode, pct) {
    if (!budget) return;
    if (Object.values(budget.valores || {}).some((row) => Object.values(row || {}).some(Boolean)) && !window.confirm("Isso substitui os valores já digitados nesta versão. Continuar?")) return;
    const base = mode === "ano_anterior" ? contextForPeriod(`${ano - 1}-01-01`, `${ano - 1}-12-31`) : actualMonthKeys.length ? ctx : contextForPeriod(`${ano - 1}-01-01`, `${ano - 1}-12-31`);
    updateBudget(fillFromActuals(budget, base, { mode, pct, months }));
    setFillOpen(false);
    setMessage(mode === "ano_anterior" ? `Preenchido com ${ano - 1}${pct ? ` + ${pct}%` : ""}.` : `Preenchido com o realizado${pct ? ` + ${pct}%` : ""}.`);
  }

  async function downloadXlsx() {
    const blob = await exportBudgetXlsx(budget, tokenInfo().empresa);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Orcamento_${ano}_${budget.versao.replace(/[^\w]+/g, "_")}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function uploadXlsx(file) {
    try {
      const result = await importBudgetXlsx(file, budget);
      updateBudget({ ...budget, valores: { ...budget.valores, ...result.valores }, abertas: result.abertas });
      setMessage(`Planilha importada: ${result.linhas} linha${result.linhas === 1 ? "" : "s"}${result.ignoradas.length ? ` (ignorei ${result.ignoradas.length}: ${result.ignoradas.slice(0, 4).join(", ")})` : ""}.`);
    } catch (error) {
      setMessage(error.message || "Não consegui ler a planilha.");
    }
  }

  const matrix = useMemo(() => (budget ? budgetMatrix(budget, months) : {}), [budget, months.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const comparison = useMemo(() => (budget && ctx ? budgetContext({ ...ctx, months: compareMonths }, [{ ...budget, principal: true }]) : null), [budget, ctx, compareMonths.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const fullYear = useMemo(() => (budget && ctx ? budgetContext({ ...ctx, months }, [{ ...budget, principal: true }]) : null), [budget, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const [serie, setSerie] = useState("receita");

  const visibleLines = LINE_ORDER.filter((code) => code !== "DRE.11" || Math.abs(sumMonths(matrix[code], months)) > 0.5 || (ctx && Math.abs(sumMonths(actualMonths(ctx, code), months)) > 0.5));

  // Desvios por linha (as de preenchimento e as filhas abertas).
  const deviations = useMemo(() => {
    if (!budget || !ctx) return [];
    const codes = [];
    INPUT_LINES.forEach(({ code }) => ((budget.abertas || []).includes(code) ? childLines(code).forEach((child) => codes.push(child.code)) : codes.push(code)));
    const pseudo = budgetMatrix(budget, compareMonths);
    return codes
      .map((code) => {
        const orcado = sumMonths(pseudo[code], compareMonths);
        const realizado = sumMonths(actualMonths(ctx, code), compareMonths);
        return { code, name: lineName(code), orcado, realizado, ...deviation(orcado, realizado) };
      })
      .filter((item) => Math.abs(item.diff) > 0.5);
  }, [budget, ctx, compareMonths.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const worst = deviations.filter((item) => item.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);
  const best = deviations.filter((item) => item.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);

  if (!hasData) {
    return <p className="py-20 text-center text-[13px] text-ink-500">Importe os dados da empresa para montar o orçamento.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold text-ink-900">
            <Target size={22} className="text-accent-500" /> Orçamento x Realizado
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">Monte o orçamento mês a mês pelas linhas da DRE e acompanhe o realizado. A versão marcada com ★ é a usada no B.I. e nos slides.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={ano} onChange={(event) => { setAno(Number(event.target.value)); setVersionId(null); setUntilMonth(""); }} className="orc-ano h-9 rounded-lg border border-line bg-surface-card px-3 text-[13px] font-medium outline-none focus:border-accent-400">
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {versions.length > 0 && (
            <select value={budget?.id || ""} onChange={(event) => setVersionId(event.target.value)} className="h-9 rounded-lg border border-line bg-surface-card px-3 text-[13px] outline-none focus:border-accent-400">
              {versions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.principal ? "★ " : ""}
                  {item.versao}
                </option>
              ))}
            </select>
          )}
          {canEdit && budget && (
            <>
              {!budget.principal && (
                <button type="button" onClick={() => persist(list.map((item) => (Number(item.ano) === Number(ano) ? { ...item, principal: item.id === budget.id } : item)))} className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] text-ink-700 hover:bg-surface-muted" title="Usar esta versão no B.I. e nos slides">
                  <Star size={14} /> Usar esta
                </button>
              )}
              <button type="button" onClick={() => { const name = window.prompt("Nome da versão", budget.versao); if (name?.trim()) updateBudget({ ...budget, versao: name.trim() }); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-500 hover:bg-surface-muted" title="Renomear a versão">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => createBudget(budget.id)} className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] text-ink-700 hover:bg-surface-muted" title="Copia esta versão para revisar sem perder a original">
                <Copy size={14} /> Nova versão
              </button>
              <button type="button" onClick={() => { if (window.confirm(`Excluir a versão "${budget.versao}" de ${ano}? Não dá pra desfazer.`)) { const rest = list.filter((item) => item.id !== budget.id); const sameYear = rest.filter((item) => Number(item.ano) === Number(ano)); if (budget.principal && sameYear.length) sameYear[sameYear.length - 1] = { ...sameYear[sameYear.length - 1], principal: true }; persist(rest.map((item) => sameYear.find((s) => s.id === item.id) || item)); setVersionId(null); } }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-400 hover:bg-danger-50 hover:text-danger-600" title="Excluir a versão">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-1">
          {[
            { id: "comparar", label: "Orçado x Realizado" },
            { id: "montar", label: canEdit ? "Montar o orçamento" : "Ver o orçamento" },
            { id: "projecao", label: "Projeção do ano" },
          ].map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`orc-aba -mb-px border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-semibold ${tab === item.id ? "border-accent-500 text-accent-700" : "border-transparent text-ink-500 hover:text-ink-800"}`}>
              {item.label}
            </button>
          ))}
        </div>
        <span className="pb-2 text-[11.5px] text-ink-400">
          {tab === "projecao" ? "" : saving || (budget?.atualizadoEm ? `Atualizado em ${new Date(budget.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : "")}
        </span>
      </div>
      {message && (
        <p className="flex items-center justify-between rounded-lg bg-accent-50 px-3 py-2 text-[12.5px] text-accent-800">
          {message}
          <button type="button" onClick={() => setMessage("")} className="text-accent-600 hover:underline">
            ok
          </button>
        </p>
      )}

      {tab === "projecao" ? (
        <ProjecaoAno ano={ano} ctx={ctx} list={list} empresa={company?.name || ""} canEdit={canEdit} />
      ) : !budget ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-surface-card px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
            <Target size={26} strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink-900">Ainda não há orçamento para {ano}</p>
            <p className="mt-1 max-w-md text-[13px] text-ink-500">Comece em branco, ou crie e use "Preencher a partir do realizado" para partir do ano anterior (ou da média) com um reajuste.</p>
          </div>
          {canEdit ? (
            <button type="button" onClick={() => createBudget(null)} className="orc-criar flex h-10 items-center gap-2 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600">
              <Plus size={16} /> Criar orçamento de {ano}
            </button>
          ) : (
            <p className="text-[12px] text-ink-400">Só quem é responsável pela empresa pode criar o orçamento.</p>
          )}
        </div>
      ) : tab === "montar" ? (
            <div className="flex flex-col gap-3">
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setFillOpen((v) => !v)} className="orc-preencher flex h-9 items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 text-[12.5px] font-semibold text-white hover:bg-accent-600">
                    <Wand2 size={14} /> Preencher a partir do realizado
                  </button>
                  <button type="button" onClick={downloadXlsx} className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[12.5px] text-ink-700 hover:bg-surface-muted">
                    <Download size={14} /> Baixar planilha
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[12.5px] text-ink-700 hover:bg-surface-muted">
                    <Upload size={14} /> Importar planilha
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadXlsx(file); }} />
                  <span className="text-[11.5px] text-ink-400">Gastos em positivo; linhas em negrito somam sozinhas. Use ▸ para orçar uma linha no detalhe.</span>
                </div>
              )}
              {fillOpen && <FillPanel ano={ano} years={years} onApply={applyFill} onClose={() => setFillOpen(false)} />}
              <div className="overflow-x-auto rounded-xl bg-surface-card shadow-sm ring-1 ring-line">
                <table className="w-full min-w-[1180px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-muted/60 text-[10.5px] uppercase tracking-wide text-ink-400">
                      <th className="sticky left-0 z-10 w-[260px] bg-surface-muted/95 px-3 py-2 text-left font-medium">Linha</th>
                      {months.map((month) => (
                        <th key={month} className={`px-1.5 py-2 text-right font-medium ${actualMonthKeys.includes(month) ? "text-ink-500" : ""}`}>
                          {monthShort(month)}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold text-ink-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.map((code) => {
                      const formula = FORMULA_CODES.has(code);
                      const sign = signOf(code);
                      const opened = (budget.abertas || []).includes(code);
                      const kids = formula ? [] : childLines(code);
                      const display = (value) => (sign === -1 ? -Number(value || 0) : Number(value || 0));
                      const rows = [
                        <tr key={code} className={`group border-b border-line ${formula ? "bg-surface-muted/40 font-semibold text-ink-900" : "text-ink-700"}`}>
                          <td className="sticky left-0 z-10 bg-inherit px-3 py-1" style={{ background: "var(--color-surface-card)" }}>
                            <span className="flex items-center gap-1">
                              {kids.length ? (
                                <button type="button" onClick={() => canEdit && toggleOpen(code)} disabled={!canEdit} className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-surface-muted" title={opened ? "Voltar a orçar só o total" : "Orçar no detalhe"}>
                                  {opened ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : (
                                <span className="w-5" />
                              )}
                              <span className={`truncate ${formula ? "" : ""}`}>
                                {sign === -1 && !formula ? "(−) " : ""}
                                {lineName(code)}
                              </span>
                              {!formula && !opened && canEdit && (
                                <RowMenu
                                  onSpread={() => {
                                    const typed = window.prompt(`Total do ano para "${lineName(code)}" (vai dividido igualmente nos 12 meses):`);
                                    if (typed == null) return;
                                    const total = parseTyped(typed);
                                    const each = Math.round((sign === -1 ? -Math.abs(total) : total) / 12);
                                    setRow(code, Object.fromEntries(months.map((month) => [month, each])));
                                  }}
                                  onCopyFirst={() => setRow(code, Object.fromEntries(months.map((month) => [month, Number(budget.valores?.[code]?.[months[0]] || 0)])))}
                                  onClear={() => setRow(code, {})}
                                />
                              )}
                            </span>
                          </td>
                          {months.map((month) => (
                            <td key={month} className="px-0.5 py-0.5 text-right tabular-nums">
                              {formula || opened ? <span className="block px-1.5">{whole(display(matrix[code]?.[month]))}</span> : <MoneyCell value={display(budget.valores?.[code]?.[month])} disabled={!canEdit} onChange={(typed) => setCell(code, month, typed)} />}
                            </td>
                          ))}
                          <td className="px-3 py-1 text-right font-semibold tabular-nums">{whole(display(sumMonths(matrix[code], months)))}</td>
                        </tr>,
                      ];
                      if (opened)
                        kids.forEach((child) =>
                          rows.push(
                            <tr key={child.code} className="group border-b border-line text-ink-600">
                              <td className="sticky left-0 z-10 px-3 py-1 pl-10" style={{ background: "var(--color-surface-card)" }}>
                                <span className="flex items-center gap-1">
                                  <span className="truncate text-[12px]">{child.name}</span>
                                  {canEdit && (
                                    <RowMenu
                                      onSpread={() => {
                                        const typed = window.prompt(`Total do ano para "${child.name}":`);
                                        if (typed == null) return;
                                        const total = parseTyped(typed);
                                        const each = Math.round((sign === -1 ? -Math.abs(total) : total) / 12);
                                        setRow(child.code, Object.fromEntries(months.map((month) => [month, each])));
                                      }}
                                      onCopyFirst={() => setRow(child.code, Object.fromEntries(months.map((month) => [month, Number(budget.valores?.[child.code]?.[months[0]] || 0)])))}
                                      onClear={() => setRow(child.code, {})}
                                    />
                                  )}
                                </span>
                              </td>
                              {months.map((month) => (
                                <td key={month} className="px-0.5 py-0.5">
                                  <MoneyCell value={display(budget.valores?.[child.code]?.[month])} disabled={!canEdit} onChange={(typed) => setCell(child.code, month, typed)} />
                                </td>
                              ))}
                              <td className="px-3 py-1 text-right tabular-nums">{whole(display(sumMonths(budget.valores?.[child.code], months)))}</td>
                            </tr>
                          )
                        );
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !ctx ? (
            <p className="py-16 text-center text-[13px] text-ink-400">Calculando o realizado de {ano}…</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-600">
                <div className="inline-flex rounded-lg bg-surface-muted p-0.5">
                  {[
                    { id: "acumulado", label: "Acumulado até" },
                    { id: "mes", label: "Só o mês" },
                    { id: "ano", label: "Ano inteiro" },
                  ].map((item) => (
                    <button key={item.id} type="button" onClick={() => setCompareMode(item.id)} className={`rounded-md px-2.5 py-1 font-medium ${compareMode === item.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                {compareMode !== "ano" && (
                  <select value={until} onChange={(event) => setUntilMonth(event.target.value)} className="h-8 rounded-lg border border-line bg-surface-card px-2.5 outline-none focus:border-accent-400">
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {monthShort(month)}
                        {actualMonthKeys.includes(month) ? "" : " (sem realizado)"}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-ink-400">
                  {actualMonthKeys.length ? `Realizado até ${monthShort(lastActual)}.` : `Ainda não há lançamentos em ${ano}.`}
                </span>
              </div>
              {comparison && (
                <>
                  <div className="flex flex-wrap gap-3">
                    <Kpi title="Receita líquida" item={comparison.receita} />
                    <Kpi title="Despesas operacionais" item={comparison.despesas} inverted />
                    <Kpi title="Resultado líquido" item={comparison.resultado} />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                    <div className="overflow-x-auto rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
                      <table className="orc-comparacao w-full min-w-[560px] text-[12.5px]">
                        <thead>
                          <tr className="border-b border-line text-[10.5px] uppercase tracking-wide text-ink-400">
                            <th className="py-1.5 text-left font-medium">Linha</th>
                            <th className="py-1.5 text-right font-medium">Orçado</th>
                            <th className="py-1.5 text-right font-medium">Realizado</th>
                            <th className="py-1.5 text-right font-medium">Diferença</th>
                            <th className="py-1.5 text-right font-medium">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.lines.map((line) => {
                            const tone = TONE[line.tone] || TONE.neutro;
                            return (
                              <tr key={line.code} className={line.formula ? "border-t border-line font-semibold text-ink-900" : "text-ink-600"}>
                                <td className="py-1.5">
                                  <span className="flex items-center gap-2">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} title={tone.label} />
                                    {line.name}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right tabular-nums">{whole(line.orcado)}</td>
                                <td className="py-1.5 text-right tabular-nums">{whole(line.realizado)}</td>
                                <td className={`py-1.5 text-right tabular-nums ${line.diff < -0.5 ? "text-danger-600" : line.diff > 0.5 ? "text-success-600" : ""}`}>{whole(line.diff)}</td>
                                <td className="py-1.5 text-right tabular-nums text-ink-500">{line.pct == null ? "—" : `${line.pct > 0 ? "+" : ""}${line.pct.toFixed(0)}%`}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-400">
                        {["bom", "atencao", "ruim"].map((key) => (
                          <span key={key} className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${TONE[key].dot}`} /> {TONE[key].label}
                          </span>
                        ))}
                        <span>· Diferença = realizado − orçado (positivo é bom, inclusive nas despesas).</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-ink-900">Mês a mês</p>
                          <div className="flex gap-0.5 rounded-md bg-surface-muted p-0.5">
                            {[
                              ["receita", "Receita"],
                              ["despesas", "Despesas"],
                              ["resultado", "Resultado"],
                            ].map(([id, label]) => (
                              <button key={id} type="button" onClick={() => setSerie(id)} className={`rounded px-2 py-0.5 text-[11px] font-medium ${serie === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={(fullYear?.series || []).map((item) => ({ month: item.month, orcado: item[`${serie}Orcado`], realizado: item[`${serie}Realizado`] }))} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="var(--color-line)" />
                              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={(value) => compact(value).replace("R$ ", "")} axisLine={false} tickLine={false} width={64} />
                              <Tooltip formatter={(value, name) => [money(value), name === "orcado" ? "Orçado" : "Realizado"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                              <Bar dataKey="realizado" fill="var(--color-accent-500)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                              <Line type="monotone" dataKey="orcado" stroke="var(--color-navy-700)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-1 flex justify-center gap-4 text-[11px] text-ink-500">
                          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-accent-500" /> Realizado</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-navy-700" /> Orçado</span>
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
                          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-danger-600">Piores desvios</p>
                          {worst.length ? worst.map((item) => (
                            <p key={item.code} className="flex justify-between gap-2 py-0.5 text-[12px] text-ink-600">
                              <span className="truncate">{item.name}</span>
                              <span className="shrink-0 tabular-nums text-danger-600">{compact(item.diff)}</span>
                            </p>
                          )) : <p className="text-[12px] text-ink-400">Nenhuma linha abaixo do orçado.</p>}
                        </div>
                        <div className="rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
                          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-success-600">Melhores desvios</p>
                          {best.length ? best.map((item) => (
                            <p key={item.code} className="flex justify-between gap-2 py-0.5 text-[12px] text-ink-600">
                              <span className="truncate">{item.name}</span>
                              <span className="shrink-0 tabular-nums text-success-600">+{compact(item.diff).replace("-", "")}</span>
                            </p>
                          )) : <p className="text-[12px] text-ink-400">Nenhuma linha acima do orçado.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {!comparison && <p className="py-10 text-center text-[13px] text-ink-400">Preencha o orçamento para comparar.</p>}
            </div>
          )}
    </div>
  );
}
