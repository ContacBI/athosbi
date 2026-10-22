import { state } from "../data/useStore.js";

// Metas dos indicadores por empresa (company.metasIndicadores): cada
// cliente com a sua régua em vez da referência genérica. Vazio = usa o
// padrão, que é exatamente a régua que o app usava antes para todo mundo
// (alertas do assistente e radar do B.I.).
//  - direction "min": o indicador deve ficar ACIMA da meta (margem, liquidez);
//  - direction "max": deve ficar ABAIXO (endividamento, prazos, dívida).

export const INDICATOR_GOALS = [
  { id: "margemLiquida", label: "Margem líquida mínima", unit: "%", direction: "min", default: 3, step: 0.5, help: "Resultado líquido ÷ receita líquida. Abaixo disso, o alerta de margem apertada aparece." },
  { id: "liquidezCorrente", label: "Liquidez corrente mínima", unit: "x", direction: "min", default: 1, step: 0.05, help: "Ativo circulante ÷ passivo circulante. Abaixo disso, alerta de liquidez." },
  { id: "endividamento", label: "Endividamento máximo", unit: "x o PL", direction: "max", default: 2, step: 0.1, help: "Passivo (circulante + não circulante) ÷ patrimônio líquido. Acima disso, alerta de endividamento." },
  { id: "pmr", label: "Prazo de recebimento máximo", unit: "dias", direction: "max", default: 60, step: 1, help: "Prazo médio que os clientes levam para pagar. Acima disso, alerta de prazo longo." },
  { id: "dividaEbitda", label: "Dívida líquida / EBITDA máxima", unit: "anos", direction: "max", default: 3, step: 0.1, help: "Quantos anos de EBITDA pagariam a dívida líquida. Acima disso, alerta de dívida alta." },
];

const BY_ID = Object.fromEntries(INDICATOR_GOALS.map((goal) => [goal.id, goal]));

// Lê um número digitado ("1,2", "15%", " 60 ") — vazio ou inválido = null.
export function parseGoalInput(text) {
  const cleaned = String(text ?? "").replace(/[%\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// Só os campos preenchidos e válidos (o resto continua no padrão).
export function cleanGoals(input = {}) {
  const out = {};
  INDICATOR_GOALS.forEach(({ id }) => {
    const value = typeof input[id] === "number" ? input[id] : parseGoalInput(input[id]);
    if (value != null) out[id] = value;
  });
  return out;
}

// As metas que valem: { id: { value, custom } }.
export function goalsOf(company) {
  const saved = company?.metasIndicadores || {};
  return Object.fromEntries(
    INDICATOR_GOALS.map((goal) => {
      const custom = typeof saved[goal.id] === "number" && Number.isFinite(saved[goal.id]);
      return [goal.id, { value: custom ? saved[goal.id] : goal.default, custom }];
    })
  );
}

// A empresa ativa (num grupo, o padrão: cada empresa tem a sua régua).
export function activeGoals() {
  const company = state.activeGroupId ? null : (state.companies || []).find((item) => item.id === state.activeCompanyId);
  return goalsOf(company);
}

export function hasCustomGoals(goals) {
  return Object.values(goals || {}).some((goal) => goal.custom);
}

// "3%", "1,2x", "2x o PL", "60 dias", "3 anos".
export function formatGoal(id, value) {
  const goal = BY_ID[id];
  const number = Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (!goal) return number;
  if (goal.unit === "%") return `${number}%`;
  if (goal.unit === "x") return `${number}x`;
  return `${number}${goal.unit === "x o PL" ? "x o PL" : ` ${goal.unit}`}`;
}

// O indicador está fora da meta?
export function breaksGoal(id, value, goals) {
  const goal = BY_ID[id];
  const target = goals?.[id]?.value ?? goal?.default;
  if (value == null || !Number.isFinite(Number(value)) || target == null) return false;
  return goal.direction === "min" ? value < target : value > target;
}
