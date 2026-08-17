export default function Sparkline({ values, width = 64, height = 22, color = "var(--color-accent-500)" }) {
  const data = values.filter((value) => Number.isFinite(value));
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = data[data.length - 1];
  const first = data[0];
  const trendColor = last >= first ? "var(--color-success-500)" : "var(--color-danger-500)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={points.join(" ")} fill="none" stroke={color || trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
