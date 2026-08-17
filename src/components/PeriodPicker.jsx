import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

const PRESETS = [
  {
    label: "Mês atual",
    range() {
      const now = new Date();
      return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
    },
  },
  {
    label: "Trimestre atual",
    range() {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      return [iso(new Date(now.getFullYear(), quarter * 3, 1)), iso(new Date(now.getFullYear(), quarter * 3 + 3, 0))];
    },
  },
  {
    label: "Ano atual",
    range() {
      const now = new Date();
      return [iso(new Date(now.getFullYear(), 0, 1)), iso(new Date(now.getFullYear(), 11, 31))];
    },
  },
];

// Compact popover date-range control — replaces bare <input type=date> pairs
// sitting loose in toolbars. Shows the chosen range as a single pill; the
// popover carries quick presets plus the two raw pickers for custom ranges.
export default function PeriodPicker({ label = "Período", start, end, onChange, accent = "accent" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const hasRange = Boolean(start && end);
  const toneClasses =
    accent === "navy"
      ? "border-line-strong bg-surface-card hover:border-navy-400"
      : "border-line-strong bg-surface-card hover:border-accent-400";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] text-ink-700 transition-colors ${toneClasses}`}
      >
        <Calendar size={13} strokeWidth={1.8} className="text-ink-400" />
        <span className="text-ink-400">{label}</span>
        <span className="font-medium tabular-nums text-ink-900">
          {hasRange ? `${formatDate(start)} – ${formatDate(end)}` : "Selecionar"}
        </span>
        <ChevronDown size={12} className={`text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-xl bg-surface-card p-3 shadow-lg ring-1 ring-line">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const [s, e] = preset.range();
                  onChange(s, e);
                }}
                className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] text-ink-600 transition-colors hover:bg-accent-50 hover:text-accent-600"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 text-[11px] text-ink-500">
              Início
              <input
                type="date"
                value={start || ""}
                onChange={(event) => onChange(event.target.value, end)}
                className="mt-1 block w-full rounded-md border border-line-strong px-2 py-1.5 text-[12px] outline-none focus:border-accent-500"
              />
            </label>
            <label className="flex-1 text-[11px] text-ink-500">
              Fim
              <input
                type="date"
                value={end || ""}
                onChange={(event) => onChange(start, event.target.value)}
                className="mt-1 block w-full rounded-md border border-line-strong px-2 py-1.5 text-[12px] outline-none focus:border-accent-500"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
