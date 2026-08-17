export default function MiniBar({ percent, tone = "accent" }) {
  const clamped = Math.max(0, Math.min(100, Math.abs(percent)));
  const colorVar = tone === "danger" ? "var(--color-danger-500)" : tone === "success" ? "var(--color-success-500)" : "var(--color-accent-500)";
  return (
    <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: colorVar }} />
    </div>
  );
}
