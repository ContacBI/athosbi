import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { WIDGET_CATALOG, formatWidgetValue } from "../../lib/dashboardWidgets.js";
import { LAYOUTS, SLIDE_H, SLIDE_W, makeSlide } from "../../lib/presentations.js";
import { SLIDE_ICONS } from "./slideIcons.js";
import SlideView from "./SlideView.jsx";

export function Modal({ title, subtitle, onClose, children, width = "max-w-4xl" }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-sm" onPointerDown={onClose}>
      <div className={`flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-2xl bg-surface-card shadow-2xl`} onPointerDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-muted hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// Miniatura de um slide: o próprio slide em 1280×720, só que encolhido.
export function SlideThumb({ slide, deck, env, width = 176, number, total }) {
  const scale = width / SLIDE_W;
  return (
    <div style={{ width, height: SLIDE_H * scale, overflow: "hidden", position: "relative" }}>
      <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }}>
        <SlideView slide={slide} deck={deck} env={{ ...env, mode: "thumb" }} number={number} total={total} />
      </div>
    </div>
  );
}

// Escolher um número (KPI) ou um gráfico/tabela/lista do catálogo do B.I.
export function WidgetPicker({ kind, ctx, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const wanted = kind === "kpi" ? ["kpi"] : ["chart", "table", "list"];
    const q = query.trim().toLowerCase();
    return WIDGET_CATALOG.filter((item) => wanted.includes(item.type) && item.id !== "list_sem_depara" && (!q || item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)));
  }, [kind, query]);
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return [...map.entries()];
  }, [items]);
  return (
    <Modal title={kind === "kpi" ? "Escolha o número" : "Escolha o gráfico ou tabela"} subtitle="Os valores vêm do B.I. desta empresa, no período da apresentação." onClose={onClose}>
      <div className="sticky top-0 z-10 border-b border-line bg-surface-card px-5 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" className="h-9 w-full rounded-lg border border-line bg-surface-card pl-8 pr-3 text-[13px] outline-none focus:border-accent-400" />
        </div>
      </div>
      <div className="flex flex-col gap-5 p-5">
        {groups.map(([category, list]) => (
          <div key={category}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{category}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((item) => {
                const Icon = item.icon;
                let preview = "";
                if (item.type === "kpi" && ctx) {
                  try {
                    const { value, format } = item.value(ctx);
                    preview = formatWidgetValue(value, format);
                  } catch {
                    preview = "—";
                  }
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPick(item.id)}
                    className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-accent-400 hover:bg-accent-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-accent-600">{Icon && <Icon size={17} strokeWidth={1.8} />}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink-800">{item.label}</span>
                      {preview && <span className="block truncate text-[12px] tabular-nums text-ink-500">{preview}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="py-10 text-center text-[13px] text-ink-400">Nada encontrado.</p>}
      </div>
    </Modal>
  );
}

export function IconPicker({ value, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const names = Object.keys(SLIDE_ICONS).filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Modal title="Escolha o ícone" onClose={onClose} width="max-w-2xl">
      <div className="border-b border-line px-5 py-3">
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar (em inglês: money, chart, star…)" className="h-9 w-full rounded-lg border border-line bg-surface-card px-3 text-[13px] outline-none focus:border-accent-400" />
      </div>
      <div className="grid grid-cols-8 gap-2 p-5">
        {names.map((name) => {
          const Icon = SLIDE_ICONS[name];
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onPick(name)}
              className={`flex aspect-square items-center justify-center rounded-xl border transition-colors hover:border-accent-400 hover:bg-accent-50 hover:text-accent-600 ${value === name ? "border-accent-500 bg-accent-50 text-accent-600" : "border-line text-ink-600"}`}
            >
              <Icon size={24} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// Galeria de layouts pro "Novo slide" — cada um desenhado de verdade com o
// tema da apresentação e os números da empresa.
export function LayoutPicker({ deck, env, onPick, onClose }) {
  const samples = useMemo(() => LAYOUTS.map((layout) => ({ layout, slide: makeSlide(layout.id) })), []);
  return (
    <Modal title="Novo slide" subtitle="Escolha um ponto de partida — depois tudo pode ser mudado." onClose={onClose} width="max-w-5xl">
      <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
        {samples.map(({ layout, slide }) => (
          <button key={layout.id} type="button" onClick={() => onPick(layout.id)} className="group flex flex-col gap-2 text-left">
            <span className="overflow-hidden rounded-lg ring-1 ring-line transition-all group-hover:ring-2 group-hover:ring-accent-500">
              <SlideThumb slide={slide} deck={deck} env={env} width={210} />
            </span>
            <span className="text-[12.5px] font-medium text-ink-700 group-hover:text-accent-600">{layout.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
