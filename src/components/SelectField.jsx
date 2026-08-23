import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Campo de seleção fechado por padrão — em vez de deixar a caixa toda de
// opções aberta ocupando espaço o tempo inteiro (era assim antes em
// Plano de contas/Representantes/Responsáveis/Empresas do grupo/Acessos),
// mostra só um campo tipo "Selecione" e abre uma janelinha com as opções
// ao clicar. Serve tanto pra seleção única (`value`/`onChange`, vira
// radio) quanto múltipla (`values`/`onToggle`, vira checkbox) — mesma
// cara nos dois casos, reaproveitado em vários formulários do portal.
//
// A janelinha renderiza num portal (document.body), posicionada por
// coordenada calculada do gatilho — não como filho normal do DOM. Sem
// isso, ela ficava cortada sempre que o campo estava dentro de um modal
// com scroll (Editar grupo, Editar empresa): o `overflow-y-auto` do
// container pai corta qualquer coisa que "vaze" dele, mesmo posicionada
// como `absolute`, então a lista simplesmente sumia no meio. Também vira
// pra cima do campo sozinha quando não cabe embaixo.
export default function SelectField({
  placeholder = "Selecione",
  options,
  value,
  onChange,
  values,
  onToggle,
  searchable,
  emptyText = "Nenhuma opção disponível.",
  renderSummary,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const isMulti = Array.isArray(values);
  const showSearch = searchable ?? options.length > 6;

  function updateRect() {
    if (!triggerRef.current) return;
    const box = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = (showSearch ? 46 : 0) + Math.min(options.length, 7) * 34 + 16;
    const spaceBelow = window.innerHeight - box.bottom;
    const openUp = spaceBelow < estimatedHeight && box.top > spaceBelow;
    setRect({ top: openUp ? undefined : box.bottom + 4, bottom: openUp ? window.innerHeight - box.top + 4 : undefined, left: box.left, width: box.width, openUp });
  }

  useEffect(() => {
    if (!open) return;
    updateRect();
    function handleClick(event) {
      if (triggerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function handleReposition() {
      updateRect();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const selectedOptions = isMulti
    ? options.filter((option) => values.includes(option.value))
    : options.filter((option) => option.value === value);

  const summary = renderSummary
    ? renderSummary(selectedOptions)
    : selectedOptions.length === 0
    ? placeholder
    : isMulti
    ? selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} selecionados`
    : selectedOptions[0].label;

  const visible = search ? options.filter((option) => norm(`${option.label} ${option.hint || ""}`).includes(norm(search))) : options;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[13px] outline-none transition-colors ${
          open ? "border-accent-500" : "border-line-strong hover:border-accent-300"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOptions.length === 0 ? "text-ink-300" : "text-ink-900"}`}>{summary}</span>
        <ChevronDown size={14} className={`shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width }}
            className="z-[100] overflow-hidden rounded-lg border border-line-strong bg-surface-card shadow-lg"
          >
            {showSearch && (
              <div className="border-b border-line p-2">
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-md border border-line-strong py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500"
                  />
                </div>
              </div>
            )}
            <div className="max-h-52 overflow-y-auto p-1.5">
              {visible.length === 0 && (
                <p className="px-2 py-3 text-center text-[12px] text-ink-400">{options.length === 0 ? emptyText : "Nada encontrado."}</p>
              )}
              {visible.map((option) => {
                const checked = isMulti ? values.includes(option.value) : value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (isMulti) onToggle(option.value);
                      else {
                        onChange(option.value);
                        setOpen(false);
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-900 hover:bg-surface-muted"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center border ${isMulti ? "rounded" : "rounded-full"} ${
                        checked ? "border-accent-500 bg-accent-500 text-white" : "border-line-strong"
                      }`}
                    >
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && <span className="shrink-0 text-[11px] text-ink-400">{option.hint}</span>}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
