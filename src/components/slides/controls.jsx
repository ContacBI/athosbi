import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pipette, Slash } from "lucide-react";
import { FONTS, THEME_COLOR_KEYS, fontStack, resolveColor } from "../../lib/presentations.js";

// Peças do painel de propriedades do editor de slides — pequenas, densas e
// todas no mesmo padrão visual (rótulo em cima, controle embaixo).

export function Section({ title, children, defaultOpen = true, right }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500 hover:text-ink-800">
          <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

export function Field({ label, children, inline = false }) {
  if (inline) {
    return (
      <label className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-ink-600">{label}</span>
        {children}
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11.5px] text-ink-500">{label}</span>
      {children}
    </div>
  );
}

export function Row({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

const INPUT = "h-8 w-full rounded-md border border-line bg-surface-card px-2 text-[12.5px] text-ink-800 outline-none focus:border-accent-400";

export function NumberInput({ value, onChange, min, max, step = 1, suffix, label }) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => setDraft(String(value ?? "")), [value]);
  function commit(text) {
    const parsed = Number(String(text).replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(next);
  }
  return (
    <div className="relative">
      {label && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10.5px] font-medium text-ink-400">{label}</span>}
      <input
        type="number"
        value={draft}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.value !== "") commit(event.target.value);
        }}
        onBlur={() => setDraft(String(value ?? ""))}
        className={`${INPUT} tabular-nums ${label ? "pl-6" : ""} ${suffix ? "pr-7" : ""}`}
      />
      {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-ink-400">{suffix}</span>}
    </div>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, suffix = "" }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 flex-1 cursor-pointer accent-accent-500" />
      <span className="w-12 text-right text-[11.5px] tabular-nums text-ink-600">
        {Number.isInteger(step) ? value : Number(value).toFixed(2)}
        {suffix}
      </span>
    </div>
  );
}

export function Select({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`${INPUT} cursor-pointer`} style={style}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-[12px] text-ink-600">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-accent-500" : "bg-line-strong"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

// Botões lado a lado (alinhamento, tipo, variação…). `options` pode ter
// ícone em vez de texto.
export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex rounded-md border border-line bg-surface-muted p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title || option.label}
            onClick={() => onChange(option.value)}
            className={`flex h-7 flex-1 items-center justify-center gap-1 rounded text-[11.5px] transition-colors ${active ? "bg-surface-card font-medium text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
          >
            {Icon ? <Icon size={14} strokeWidth={1.9} /> : option.label}
          </button>
        );
      })}
    </div>
  );
}

export function TextArea({ value, onChange, rows = 4, placeholder, mono = false }) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full resize-y rounded-md border border-line bg-surface-card px-2 py-1.5 text-[12.5px] leading-snug text-ink-800 outline-none focus:border-accent-400 ${mono ? "font-mono text-[11.5px]" : ""}`}
    />
  );
}

export function TextInput({ value, onChange, placeholder }) {
  return <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={INPUT} />;
}

// Fonte com prévia: cada opção do menu escrita na própria fonte. "@heading"
// e "@body" seguem o tema (trocar a fonte do tema troca todos esses blocos).
export function FontSelect({ value, onChange, theme, allowTheme = true }) {
  const [open, setOpen] = useState(false);
  const rootRef = useOutside(open, () => setOpen(false));
  const options = [
    ...(allowTheme
      ? [
          { value: "@heading", label: `Títulos do tema (${labelOf(theme.headingFont)})` },
          { value: "@body", label: `Textos do tema (${labelOf(theme.bodyFont)})` },
        ]
      : []),
    ...FONTS.map((font) => ({ value: font.id, label: font.label })),
  ];
  const current = options.find((option) => option.value === value) || options[0];
  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${INPUT} flex items-center justify-between gap-2 text-left`} style={{ fontFamily: fontStack(value, theme) }}>
        <span className="truncate">{current.label}</span>
        <ChevronDown size={13} className="shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-lg bg-surface-card p-1 shadow-lg ring-1 ring-line">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[14px] hover:bg-surface-muted ${option.value === value ? "bg-accent-50 text-accent-700" : "text-ink-800"}`}
              style={{ fontFamily: fontStack(option.value, theme) }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function labelOf(fontId) {
  return (FONTS.find((font) => font.id === fontId) || FONTS[0]).label;
}

function useOutside(active, onOutside) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    function handle(event) {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    }
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [active, onOutside]);
  return ref;
}

const PRESET_COLORS = [
  "#ffffff", "#f4f4f5", "#d4d4d8", "#71717a", "#27272a", "#000000",
  "#fee2e2", "#ef4444", "#b91c1c", "#ffedd5", "#f97316", "#c2410c",
  "#fef9c3", "#eab308", "#a16207", "#dcfce7", "#22c55e", "#15803d",
  "#ccfbf1", "#14b8a6", "#0f766e", "#dbeafe", "#3b82f6", "#1d4ed8",
  "#e0e7ff", "#6366f1", "#4338ca", "#f3e8ff", "#a855f7", "#7e22ce",
  "#fce7f3", "#ec4899", "#be185d", "#081d33", "#e8691f", "#1d9e75",
];

function Swatch({ color, title, active, onClick, size = 22 }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`shrink-0 rounded-md ring-1 transition-transform hover:scale-110 ${active ? "ring-2 ring-accent-500 ring-offset-1" : "ring-black/10"}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}

// Cor: referência ao tema ("@accent", acompanha a troca de tema), cor fixa
// ou nenhuma.
export function ColorField({ value, onChange, theme, allowNone = false, label, compact = false, plain = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useOutside(open, () => setOpen(false));
  const resolved = resolveColor(value, theme);
  const themeKey = value?.startsWith("@") ? THEME_COLOR_KEYS.find((item) => `@${item.key}` === value) : null;
  const caption = !value ? "Sem cor" : themeKey ? `Tema · ${themeKey.label}` : value.startsWith("@") ? "Automática (contraste)" : value.toUpperCase();
  const [hex, setHex] = useState(resolved || "#000000");
  useEffect(() => setHex(resolved && resolved !== "transparent" ? resolved : "#000000"), [resolved, open]);
  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${INPUT} flex items-center gap-2 text-left`} title={label}>
        <span
          className="h-5 w-5 shrink-0 rounded ring-1 ring-black/15"
          style={{ background: resolved && resolved !== "transparent" ? resolved : "repeating-conic-gradient(#d4d4d8 0 25%, #ffffff 0 50%) 0 0/8px 8px" }}
        />
        {!compact && <span className="truncate text-[12px]">{caption}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-64 rounded-xl bg-surface-card p-3 shadow-xl ring-1 ring-line">
          {!plain && <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Cores do tema</p>}
          {!plain && <div className="mb-3 flex flex-wrap gap-1.5">
            {THEME_COLOR_KEYS.map((item) => (
              <Swatch
                key={item.key}
                title={item.label}
                color={theme.colors[item.key]}
                active={value === `@${item.key}`}
                onClick={() => {
                  onChange(`@${item.key}`);
                  setOpen(false);
                }}
              />
            ))}
          </div>}
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{plain ? "Cores" : "Outras cores"}</p>
          <div className="mb-3 grid grid-cols-9 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <Swatch
                key={color}
                title={color}
                color={color}
                size={20}
                active={value?.toLowerCase() === color}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-ink-500 hover:text-accent-600" title="Escolher qualquer cor">
              <Pipette size={14} />
              <input type="color" value={hex} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <input
              value={hex}
              onChange={(event) => {
                setHex(event.target.value);
                if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
              }}
              className={`${INPUT} font-mono uppercase`}
            />
            {allowNone && (
              <button
                type="button"
                title="Sem cor"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-danger-600 hover:bg-danger-50"
              >
                <Slash size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
