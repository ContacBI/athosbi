// Em que ambiente o site está rodando: o OFICIAL (clientes e equipe, banco
// AthosBI) ou o de TESTE (homologação — teste.bi.…, banco "AthosBI Teste"
// só com empresas fictícias; ver docs/AMBIENTES.md). Vem do VITE_AMBIENTE
// da Vercel; sem ele, é teste sempre que o banco não for o oficial — assim
// um site de teste nunca se passa pelo oficial por esquecimento.

const BANCO_OFICIAL = "ijmkvxtdlthyxpawncbs";

export function ambienteDe(env = import.meta.env) {
  const explicito = String(env?.VITE_AMBIENTE || "").toLowerCase();
  if (explicito === "teste" || explicito === "oficial") return explicito;
  return String(env?.VITE_SUPABASE_URL || "").includes(BANCO_OFICIAL) ? "oficial" : "teste";
}

export const AMBIENTE = ambienteDe();
export const EH_TESTE = AMBIENTE === "teste";
