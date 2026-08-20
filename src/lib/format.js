// Zero vira "-" em vez de "R$ 0,00" — em toda a tela, não só nos exports
// (era assim só no export antes; o padrão da própria planilha de referência
// da equipe contábil já imprimia célula vazia assim, então virou o padrão
// daqui pra frente em qualquer lugar que usa money()).
export function money(value) {
  const numberValue = Number(value || 0);
  if (Math.abs(numberValue) < 0.005) return "-";
  return numberValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function number(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

// Mantido por compatibilidade com quem já chamava explicitamente por esse
// nome — hoje é o mesmo comportamento de money().
export function moneyOrDash(value) {
  return money(value);
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
