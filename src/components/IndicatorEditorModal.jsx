import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  availableFormulaLines,
  describeIndicatorFormula,
  evaluateIndicatorFormula,
  indicatorDetailRows,
  isSingleLineFormula,
  lineLabel,
  lineValue,
  richLineDetail,
} from "../lib/indicatorFormula.js";
import { formatWidgetValue } from "../lib/dashboardWidgets.js";
import { ICON_OPTIONS, iconFor, nameForIcon } from "../lib/indicatorIcons.js";
import { isBuiltinIndicator, makeIndicatorId } from "../lib/indicators.js";
import { WidgetBody } from "./dashboard/WidgetGrid.jsx";

const FORMAT_OPTIONS = [
  { value: "percent", label: "Percentual", example: "35,2%" },
  { value: "money", label: "Dinheiro", example: "R$ 12.345,00" },
  { value: "ratio", label: "Razão", example: "1,73" },
];

const CATEGORY_OPTIONS = ["Indicadores", "DRE", "Balanço"];

const SIZE_OPTIONS = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
];

function emptyDraft(defaultCategory = "Indicadores") {
  // DRE/Balanço cards are almost always "just show this one line" — start
  // there instead of ratio/percent, which is what every Indicador is.
  const isLineCategory = defaultCategory === "DRE" || defaultCategory === "Balanço";
  return {
    id: makeIndicatorId(),
    label: "",
    category: defaultCategory,
    icon: "Gauge",
    defaultSize: "sm",
    formula: isLineCategory
      ? { kind: "sum", format: "money", numerator: [], denominator: [] }
      : { kind: "ratio", format: "percent", numerator: [], denominator: [] },
  };
}

function draftFromDefinition(definition) {
  return {
    id: definition.id,
    label: definition.label,
    category: definition.category || "Indicadores",
    icon: nameForIcon(definition.icon),
    defaultSize: definition.defaultSize || "sm",
    formula: {
      kind: definition.formula?.kind || "ratio",
      format: definition.formula?.format || "percent",
      numerator: (definition.formula?.numerator || []).map((term) => ({ ...term })),
      denominator: (definition.formula?.denominator || []).map((term) => ({ ...term })),
    },
  };
}

// A searchable list over every codigo_gerencial line a formula can
// reference — same "type to filter, click to pick" pattern as the De/Para
// account picker, just sourced from the managerial plan + the fixed
// EBITDA-executive rows instead of a company's chart of accounts. Shows
// each line's current consolidated value right in the list when data is
// available, so picking a line means seeing its real number before
// committing to it, not just its name.
function LinePicker({ value, onChange, ctx }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const lines = useMemo(() => availableFormulaLines(), []);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return lines;
    return lines.filter((line) => line.label.toLowerCase().includes(normalized) || line.code.toLowerCase().includes(normalized));
  }, [lines, search]);
  const grouped = useMemo(() => {
    const byGroup = new Map();
    filtered.forEach((line) => {
      if (!byGroup.has(line.group)) byGroup.set(line.group, []);
      byGroup.get(line.group).push(line);
    });
    return [...byGroup.entries()];
  }, [filtered]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-surface-card px-2.5 py-1.5 text-left text-[12.5px] text-ink-800 hover:border-accent-400"
      >
        <span className="truncate">{value ? lineLabel(value) : "Escolher linha…"}</span>
        <ChevronDown size={13} className="shrink-0 text-ink-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-80 rounded-xl bg-surface-card p-2 shadow-lg ring-1 ring-line">
            <div className="flex items-center gap-1.5 rounded-md border border-line-strong px-2 py-1">
              <Search size={13} className="text-ink-300" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar linha…"
                className="w-full text-[12.5px] outline-none"
              />
            </div>
            <div className="mt-1.5 max-h-72 overflow-y-auto">
              {grouped.length === 0 && <p className="px-2 py-2 text-[12px] text-ink-400">Nada encontrado.</p>}
              {grouped.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-400">{group}</p>
                  {items.map((line) => (
                    <button
                      key={line.code}
                      type="button"
                      onClick={() => {
                        onChange(line.code);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-muted ${
                        value === line.code ? "bg-accent-50 text-accent-700" : "text-ink-800"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{line.label}</span>
                      {ctx && <span className="shrink-0 tabular-nums text-[11px] text-ink-400">{formatWidgetValue(lineValue(ctx, line.code), "money")}</span>}
                      <span className="shrink-0 text-[10.5px] text-ink-300">{line.code}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TermList({ terms, onChange, ctx }) {
  function updateTerm(index, patch) {
    onChange(terms.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  }
  function removeTerm(index) {
    onChange(terms.filter((_, i) => i !== index));
  }
  function addTerm() {
    onChange([...terms, { code: "", sign: 1 }]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {terms.map((term, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateTerm(index, { sign: term.sign < 0 ? 1 : -1 })}
            title={term.sign < 0 ? "Subtraindo — clique pra somar" : "Somando — clique pra subtrair"}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[13px] font-medium ${
              term.sign < 0 ? "border-danger-500/40 bg-danger-50 text-danger-600" : "border-success-500/40 bg-success-50 text-success-600"
            }`}
          >
            {term.sign < 0 ? <Minus size={13} /> : <Plus size={13} />}
          </button>
          <div className="min-w-0 flex-1">
            <LinePicker value={term.code} onChange={(code) => updateTerm(index, { code })} ctx={ctx} />
          </div>
          <button
            type="button"
            onClick={() => removeTerm(index)}
            aria-label="Remover linha"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addTerm}
        className="flex w-fit items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2.5 py-1.5 text-[12px] text-ink-600 hover:border-accent-400 hover:text-accent-600"
      >
        <Plus size={13} />
        Adicionar linha
      </button>
    </div>
  );
}

export default function IndicatorEditorModal({ definition, defaultCategory, ctx, onClose, onSave, onReset, onDelete }) {
  const isNew = !definition;
  const isBuiltin = definition ? isBuiltinIndicator(definition.id) : false;
  const [draft, setDraft] = useState(() => (definition ? draftFromDefinition(definition) : emptyDraft(defaultCategory)));
  const [error, setError] = useState("");

  const formulaText = useMemo(() => describeIndicatorFormula(draft.formula), [draft.formula]);

  // The exact same shape lib/indicators.js builds for the real catalog —
  // rendered through the real WidgetBody, so the preview on the right is
  // pixel-for-pixel what this card looks like on an actual dashboard, not
  // a lookalike built just for this screen.
  const previewDefinition = useMemo(
    () => ({
      id: draft.id,
      label: draft.label || "Sem nome ainda",
      type: "kpi",
      icon: iconFor(draft.icon),
      value: (previewCtx) => evaluateIndicatorFormula(draft.formula, previewCtx),
      detail: (previewCtx) =>
        isSingleLineFormula(draft.formula)
          ? richLineDetail(draft.formula.numerator[0].code, previewCtx)
          : { formula: describeIndicatorFormula(draft.formula), rows: indicatorDetailRows(draft.formula, previewCtx) },
    }),
    [draft]
  );

  const hasAnyLine = draft.formula.numerator.some((term) => term.code) || draft.formula.denominator.some((term) => term.code);

  function updateFormula(patch) {
    setDraft((prev) => ({ ...prev, formula: { ...prev.formula, ...patch } }));
  }

  function handleSave() {
    if (!draft.label.trim()) return setError("Dê um nome pro indicador.");
    if (!draft.formula.numerator.length) return setError("Adicione pelo menos uma linha.");
    if (draft.formula.numerator.some((term) => !term.code) || (draft.formula.kind === "ratio" && draft.formula.denominator.some((term) => !term.code))) {
      return setError("Escolha a linha em todos os campos, ou remova os vazios.");
    }
    if (draft.formula.kind === "ratio" && !draft.formula.denominator.length) return setError("Uma razão precisa de pelo menos uma linha no denominador.");
    onSave({ ...draft, label: draft.label.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-card">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">
            {isNew ? "Novo card" : isBuiltin ? "Card padrão" : "Card personalizado"}
          </p>
          <h2 className="mt-0.5 text-[17px] font-medium text-ink-900">{isNew ? "Criar card" : draft.label || definition.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && isBuiltin && (
            <button
              type="button"
              onClick={() => onReset(definition.id)}
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-[12.5px] text-ink-600 hover:bg-surface-muted"
            >
              <RotateCcw size={13} />
              Restaurar padrão
            </button>
          )}
          {!isNew && !isBuiltin && (
            <button
              type="button"
              onClick={() => onDelete(definition.id)}
              className="flex items-center gap-1.5 rounded-md border border-danger-500/30 px-3 py-2 text-[12.5px] text-danger-600 hover:bg-danger-50"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          )}
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-4 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="rounded-md bg-accent-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            {isNew ? "Criar card" : "Salvar alterações"}
          </button>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
      </div>

      {error && <p className="shrink-0 border-b border-line bg-danger-50 px-6 py-2 text-[12.5px] text-danger-600">{error}</p>}

      <div className="flex min-h-0 flex-1">
        {/* Esquerda: edição */}
        <div className="w-[440px] shrink-0 overflow-y-auto border-r border-line px-6 py-5">
          <label className="block text-[12.5px] text-ink-600">
            Nome do card
            <input
              value={draft.label}
              onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Ex.: Margem de contribuição"
              className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
            />
          </label>

          <div className="mt-4 text-[12.5px] text-ink-600">
            Ícone
            <div className="mt-1 grid grid-cols-8 gap-1">
              {Object.entries(ICON_OPTIONS).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, icon: name }))}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                    draft.icon === name ? "border-accent-500 bg-accent-50 text-accent-600" : "border-line-strong text-ink-500 hover:bg-surface-muted"
                  }`}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-[12.5px] text-ink-600">
            Categoria
            <p className="mb-1 mt-0.5 text-[11px] text-ink-400">Em qual seção do catálogo esse card aparece.</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, category: option }))}
                  className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
                    draft.category === option ? "border-accent-500 bg-accent-500 text-white" : "border-line-strong text-ink-600 hover:bg-surface-muted"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-[12.5px] text-ink-600">
            Tamanho do card
            <p className="mb-1 mt-0.5 text-[11px] text-ink-400">Espaço que ocupa quando adicionado a uma aba.</p>
            <div className="flex gap-1.5">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, defaultSize: option.value }))}
                  className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
                    draft.defaultSize === option.value ? "border-accent-500 bg-accent-500 text-white" : "border-line-strong text-ink-600 hover:bg-surface-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-[12.5px] text-ink-600">
            Tipo de cálculo
            <p className="mb-1 mt-0.5 text-[11px] text-ink-400">
              {draft.formula.kind === "ratio" ? "Divide a soma de um grupo de linhas por outro." : "Só soma (ou subtrai) linhas — sem dividir por nada."}
            </p>
            <div className="flex rounded-md border border-line-strong p-0.5">
              {[
                { value: "sum", label: "Valor único" },
                { value: "ratio", label: "Razão (A ÷ B)" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateFormula({ kind: option.value })}
                  className={`flex-1 rounded px-3 py-1.5 text-[12.5px] transition-colors ${
                    draft.formula.kind === option.value ? "bg-accent-500 text-white" : "text-ink-600 hover:bg-surface-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-[12.5px] text-ink-600">
            Formato do valor
            <div className="mt-1 flex rounded-md border border-line-strong p-0.5">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateFormula({ format: option.value })}
                  title={option.example}
                  className={`flex-1 rounded px-3 py-1.5 text-[12.5px] transition-colors ${
                    draft.formula.format === option.value ? "bg-accent-500 text-white" : "text-ink-600 hover:bg-surface-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-700">{draft.formula.kind === "ratio" ? "Numerador (de cima)" : "Linhas somadas"}</p>
            <TermList terms={draft.formula.numerator} onChange={(terms) => updateFormula({ numerator: terms })} ctx={ctx} />
          </div>

          {draft.formula.kind === "ratio" && (
            <div className="mt-4">
              <p className="mb-1.5 text-[12.5px] font-medium text-ink-700">Denominador (de baixo)</p>
              <TermList terms={draft.formula.denominator} onChange={(terms) => updateFormula({ denominator: terms })} ctx={ctx} />
            </div>
          )}
        </div>

        {/* Direita: visualização real */}
        <div className="flex-1 overflow-y-auto bg-surface-page px-8 py-8">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Como fica no dashboard · carteira consolidada</p>
          <p className="mt-1 max-w-md text-[12.5px] text-ink-500">
            Exatamente o card que vai aparecer quando alguém adicionar isso numa aba — não é só um preview, é o
            componente de verdade.
          </p>

          {!ctx ? (
            <p className="mt-6 text-[13px] text-ink-400">Nenhuma empresa com dados importados ainda pra pré-visualizar com números reais.</p>
          ) : !hasAnyLine ? (
            <p className="mt-6 text-[13px] text-ink-400">Escolha pelo menos uma linha à esquerda pra ver o card ganhar vida aqui.</p>
          ) : (
            <>
              <div className="mt-5 flex h-[160px] w-[260px] flex-col rounded-xl bg-surface-card p-4 shadow-sm ring-1 ring-line">
                <WidgetBody definition={previewDefinition} ctx={ctx} />
              </div>

              <div className="mt-6 max-w-lg rounded-xl border border-line bg-surface-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Fórmula</p>
                <p className="mt-1 text-[13px] text-ink-700">{formulaText || "—"}</p>
                <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                  {(isSingleLineFormula(draft.formula)
                    ? richLineDetail(draft.formula.numerator[0].code, ctx).rows
                    : indicatorDetailRows(draft.formula, ctx)
                  ).map((row, index) => (
                    <div key={index} className={`flex items-center justify-between text-[13px] ${row.bold ? "font-semibold text-ink-900" : "text-ink-500"}`}>
                      <span className="truncate pr-3">{row.label}</span>
                      <span className="shrink-0 tabular-nums">{row.display ?? formatWidgetValue(row.value, "money")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
