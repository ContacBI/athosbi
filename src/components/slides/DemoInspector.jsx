import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDown, Eye, EyeOff, Search, Star } from "lucide-react";
import { DEMO_DEFAULT_DEPTH, DEMO_SOURCES, DEMO_TITLES, ancestorCodes, demoRows, demoTree, formatDemoValue } from "../../lib/slideDemo.js";
import { ColorField, Field, FontSelect, Section, Segmented, Slider, TextInput, Toggle } from "./controls.jsx";

// Painel do "Demonstrativo sob medida": de onde vêm os números, o que cada
// linha mostra (abrir, destacar, esconder) e a aparência.

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function toggleIn(list, code) {
  const set = new Set(list || []);
  if (set.has(code)) set.delete(code);
  else set.add(code);
  return [...set];
}

function OpenButton({ row, onClick }) {
  if (!row.hasChildren) return <span className="w-5 shrink-0" />;
  const Icon = !row.expanded ? ChevronRight : row.openMode === "all" ? ChevronsDown : ChevronDown;
  const title = !row.expanded ? "Abrir (mostrar o que tem dentro)" : row.openMode === "all" ? "Aberta até as contas — clique pra fechar" : "Aberta — clique pra abrir até as contas";
  return (
    <button type="button" title={title} onClick={onClick} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${row.expanded ? "text-accent-600" : "text-ink-400"} hover:bg-surface-muted hover:text-accent-600`}>
      <Icon size={14} strokeWidth={2.2} />
    </button>
  );
}

export function DemoInspector({ block, deck, ctx, set }) {
  const theme = deck.theme;
  const source = block.source || "BP";
  const base = DEMO_DEFAULT_DEPTH[source];
  const [query, setQuery] = useState("");
  const outline = useMemo(() => (ctx ? demoRows(block, ctx, { withHidden: true }).rows : []), [block, ctx]);
  const tree = useMemo(() => (ctx ? demoTree(source, ctx) : null), [source, ctx]);
  const term = normalize(query.trim());
  const results = useMemo(() => {
    if (!term || !tree) return [];
    return tree.all.filter((node) => normalize(node.name).includes(term) || normalize(node.code).startsWith(term)).slice(0, 8);
  }, [term, tree]);

  function setOpen(code, mode) {
    set({ open: { ...(block.open || {}), [code]: mode } });
  }
  function cycle(row) {
    if (!row.expanded) setOpen(row.code, "one");
    else if (row.openMode === "all") setOpen(row.code, false);
    else setOpen(row.code, "all");
  }
  // Deixa a linha aparecendo: abre as linhas-mãe e tira do "esconder".
  function reveal(code, { all = false, star = false } = {}) {
    const open = { ...(block.open || {}) };
    ancestorCodes(code).forEach((parent) => {
      if (open[parent] !== "all") open[parent] = "one";
    });
    if (all) open[code] = "all";
    const hide = (block.hide || []).filter((item) => item !== code && !ancestorCodes(code).includes(item));
    const highlight = star && !(block.highlight || []).includes(code) ? [...(block.highlight || []), code] : block.highlight || [];
    set({ open, hide, highlight });
    setQuery("");
  }

  return (
    <>
      <Section title="Demonstrativo">
        <Segmented
          value={source}
          onChange={(value) => set({ source: value, depth: DEMO_DEFAULT_DEPTH[value], open: {}, highlight: [], hide: [], showPrevious: false })}
          options={DEMO_SOURCES}
        />
        <Field label="Detalhe inicial">
          <Segmented
            value={Number.isFinite(block.depth) ? block.depth : base}
            onChange={(value) => set({ depth: value })}
            options={[
              { value: base, label: "Resumido" },
              { value: base + 1, label: "Mais" },
              { value: base + 2, label: "Detalhado" },
            ]}
          />
        </Field>
        <Field label="Colunas">
          <Segmented
            value={block.columns || "total"}
            onChange={(value) => set({ columns: value })}
            options={[
              { value: "total", label: source === "BP" ? "Saldo final" : "Total" },
              { value: "meses", label: "Mês a mês" },
              { value: "meses_total", label: "Meses + total" },
            ]}
          />
        </Field>
        {source === "BP" && <Toggle label="Coluna saldo anterior" checked={Boolean(block.showPrevious)} onChange={(value) => set({ showPrevious: value })} />}
        {source !== "DFC" && <Toggle label={source === "BP" ? "% do ativo (análise vertical)" : "% da receita (análise vertical)"} checked={Boolean(block.showPercent)} onChange={(value) => set({ showPercent: value })} />}
        <Toggle label="Minigráfico de tendência por linha" checked={Boolean(block.showTrend)} onChange={(value) => set({ showTrend: value })} />
        <Toggle label="Esconder linhas zeradas" checked={block.hideZero !== false} onChange={(value) => set({ hideZero: value })} />
        <Field label="Formato dos valores">
          <Segmented
            value={block.numberStyle || "full"}
            onChange={(value) => set({ numberStyle: value })}
            options={[
              { value: "full", label: "R$ 1.234,56" },
              { value: "int", label: "R$ 1.235" },
              { value: "compact", label: "R$ 1,2 mil" },
            ]}
          />
        </Field>
        <Toggle label="Interativo na apresentação" checked={block.interactive !== false} onChange={(value) => set({ interactive: value })} />
        <p className="-mt-1 text-[11px] leading-snug text-ink-400">Na apresentação dá pra abrir e fechar as linhas, ver o razão das contas e abrir o demonstrativo inteiro em “Explorar”. No PDF fica do jeito que está aqui.</p>
      </Section>

      <Section title="Linhas">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar linha (ex.: caixa)…"
            className="h-8 w-full rounded-md border border-line bg-surface-card pl-7 pr-2 text-[12.5px] text-ink-800 outline-none focus:border-accent-400"
          />
        </div>
        {term && (
          <div className="-mt-1 flex flex-col gap-1 rounded-md border border-line bg-surface-page p-1.5">
            {results.length === 0 && <p className="px-1 py-1 text-[11.5px] text-ink-400">Nenhuma linha com esse nome.</p>}
            {results.map((node) => (
              <div key={node.code} className="flex flex-col gap-1 rounded px-1.5 py-1 hover:bg-surface-card">
                <span className="truncate text-[12px] font-medium text-ink-800" title={node.name}>
                  {node.name} <span className="font-mono text-[10.5px] font-normal text-ink-400">{node.code}</span>
                </span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => reveal(node.code)} className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-700 hover:border-accent-400 hover:text-accent-600">Mostrar</button>
                  <button type="button" onClick={() => reveal(node.code, { all: true })} className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-700 hover:border-accent-400 hover:text-accent-600">Até as contas</button>
                  <button type="button" onClick={() => reveal(node.code, { all: true, star: true })} className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-700 hover:border-accent-400 hover:text-accent-600">★ Evidenciar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => set({ open: {} })} className="rounded border border-line px-2 py-1 text-[11px] text-ink-600 hover:bg-surface-muted">Fechar todas</button>
          <button type="button" onClick={() => set({ highlight: [] })} disabled={!(block.highlight || []).length} className="rounded border border-line px-2 py-1 text-[11px] text-ink-600 hover:bg-surface-muted disabled:opacity-40">Tirar destaques</button>
          <button type="button" onClick={() => set({ hide: [] })} disabled={!(block.hide || []).length} className="rounded border border-line px-2 py-1 text-[11px] text-ink-600 hover:bg-surface-muted disabled:opacity-40">Mostrar escondidas</button>
        </div>
        {!ctx ? (
          <p className="text-[11.5px] text-ink-400">Sem lançamentos no período.</p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto rounded-md border border-line">
            {outline.map((row) => {
              const starred = (block.highlight || []).includes(row.code);
              const hiddenSelf = (block.hide || []).includes(row.code);
              return (
                <div key={row.key} className={`group flex items-center gap-1 border-b border-line/60 py-1 pr-1 last:border-b-0 ${row.highlighted ? "bg-accent-50" : ""}`} style={{ paddingLeft: 4 + row.depth * 12 }}>
                  <OpenButton row={row} onClick={() => cycle(row)} />
                  <span className={`min-w-0 flex-1 truncate text-[12px] ${row.hidden ? "text-ink-300 line-through" : row.kind === "analytic" ? "italic text-ink-500" : row.depth === 0 ? "font-medium text-ink-900" : "text-ink-700"}`} title={row.name}>
                    {row.name}
                  </span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-ink-400">{formatDemoValue(row.values.total ?? Object.values(row.values).slice(-1)[0], "compact")}</span>
                  <button type="button" title={starred ? "Tirar o destaque" : "Destacar esta linha"} onClick={() => set({ highlight: toggleIn(block.highlight, row.code) })} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-surface-muted ${starred ? "text-accent-500" : "text-ink-300 opacity-0 group-hover:opacity-100"}`}>
                    <Star size={12} strokeWidth={2.2} fill={starred ? "currentColor" : "none"} />
                  </button>
                  <button type="button" title={hiddenSelf ? "Mostrar de novo" : "Esconder esta linha (e o que tem dentro)"} onClick={() => set({ hide: toggleIn(block.hide, row.code) })} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-surface-muted ${hiddenSelf ? "text-ink-500" : "text-ink-300 opacity-0 group-hover:opacity-100"}`}>
                    {hiddenSelf ? <EyeOff size={12} strokeWidth={2.2} /> : <Eye size={12} strokeWidth={2.2} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="-mt-1 text-[11px] leading-snug text-ink-400">A seta abre a linha (de novo: até as contas; de novo: fecha). ★ destaca e o olho esconde. Os valores são sempre os dos relatórios.</p>
      </Section>

      <Section title="Aparência">
        <Toggle label="Mostrar título" checked={block.showTitle !== false} onChange={(value) => set({ showTitle: value })} />
        {block.showTitle !== false && (
          <>
            <Field label="Título (vazio = automático)">
              <TextInput value={block.title || ""} placeholder={DEMO_TITLES[source]} onChange={(value) => set({ title: value }, "title")} />
            </Field>
            <Toggle label="Mostrar o período embaixo do título" checked={block.showPeriod !== false} onChange={(value) => set({ showPeriod: value })} />
            <Field label="Fonte do título">
              <FontSelect value={block.titleFont || "@heading"} onChange={(value) => set({ titleFont: value })} theme={theme} />
            </Field>
          </>
        )}
        <Field label="Fonte da tabela">
          <FontSelect value={block.font || "@body"} onChange={(value) => set({ font: value })} theme={theme} />
        </Field>
        <Field label="Tamanho da letra">
          <Slider value={block.fontSize || 16} min={9} max={30} onChange={(value) => set({ fontSize: value }, "fontSize")} suffix="px" />
        </Field>
        <Toggle label="Linhas listradas" checked={block.stripe !== false} onChange={(value) => set({ stripe: value })} />
        <Field label="Cor do destaque">
          <ColorField value={block.highlightColor || "@accent"} onChange={(value) => set({ highlightColor: value })} theme={theme} />
        </Field>
      </Section>
    </>
  );
}
