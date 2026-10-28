// Formatação compartilhada do módulo Entradas x Saídas (tela e painel de detalhe).
export const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const NAVY = "#1e3a5f";
export const VERDE = "#10b981";
export const ROSA = "#f43f5e";
export const moneyFull = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const inteiro = (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const dec = (value, casas = 1) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const pct = (parte, todo) => (todo ? `${dec((parte / todo) * 100)}%` : "—");
// R$ 7,19 mi · R$ 412 mil · R$ 350,00 (o valor exato fica na dica ao passar o mouse)
export const brlCompacto = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `R$ ${dec(n / 1e6, 2)} mi`;
  if (abs >= 1e4) return `R$ ${dec(n / 1e3, 0)} mil`;
  return moneyFull(n);
};
export const eixo = (value) => {
  const abs = Math.abs(Number(value || 0));
  if (abs >= 1e6) return `${dec(value / 1e6, 1)} mi`;
  if (abs >= 1e3) return `${dec(value / 1e3, 0)} mil`;
  return dec(value, 0);
};
// Cartão no padrão do módulo: borda fina e sombra bem suave.
export const CARTAO = "rounded-2xl border border-line/70 bg-surface-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-14px_rgba(16,24,40,0.10)]";
