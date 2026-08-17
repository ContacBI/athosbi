const COLORS = [
  "bg-accent-500",
  "bg-teal-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
];

function colorFor(text) {
  const value = String(text || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 997;
  return COLORS[hash % COLORS.length];
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 40, className = "" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-medium text-white ${colorFor(name)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
