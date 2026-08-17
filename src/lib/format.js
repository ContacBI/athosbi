export function money(value) {
  const numberValue = Number(value || 0);
  const normalized = Math.abs(numberValue) < 0.005 ? 0 : numberValue;
  return normalized.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function number(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

// Same as money(), but renders exact-zero cells as "-" instead of "R$ 0,00" —
// matches how the accounting team's own report templates print empty cells.
export function moneyOrDash(value) {
  const numberValue = Number(value || 0);
  if (Math.abs(numberValue) < 0.005) return "-";
  return money(numberValue);
}

export function formatDatePt(iso) {
  const [year, month, day] = String(iso || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

// Shared by every "meta line" a report/export shows — same wording whether
// it's the DRE, the Balanço or the Resumo's own export.
export function periodLabelPt(start, end) {
  return start && end ? `${formatDatePt(start)} – ${formatDatePt(end)}` : "Período completo";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function moneyClass(value) {
  const numberValue = Number(value || 0);
  if (Math.abs(numberValue) < 0.005) return "money";
  if (numberValue < 0) return "money negative";
  if (numberValue > 0) return "money positive";
  return "money";
}
