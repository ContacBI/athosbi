// Formatação de valores da Reforma Tributária (R$, %, leitura de número
// digitado com vírgula) — separado dos componentes (ui.jsx) pro Fast Refresh.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function reais(valor, { centavos = false } = {}) {
  const numero = Number(valor) || 0;
  return (centavos ? brl2 : brl).format(Math.abs(numero) < 0.005 ? 0 : numero);
}

export function porcento(valor, { sinal = false, casas = 1 } = {}) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  const texto = `${(valor * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
  return sinal && valor > 0.00005 ? `+${texto}` : texto;
}

// Guarda só os dígitos; mostra 00.000.000/0000-00 quando tem os 14.
export const soDigitos = (texto) => String(texto || "").replace(/\D/g, "");
export function cnpjFormatado(cnpj) {
  const digitos = soDigitos(cnpj);
  return digitos.length === 14 ? digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : String(cnpj || "");
}

export const REGIME_NOME = { simples: "Simples Nacional", presumido: "Lucro Presumido", real: "Lucro Real" };

// "1.234,56", "1234,56", "1234.56" → número. Vazio → 0.
export function lerNumero(texto) {
  const limpo = String(texto ?? "").trim().replace(/\s|R\$/g, "");
  if (!limpo) return 0;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}
