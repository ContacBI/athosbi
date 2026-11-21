// Regras e textos da senha nova (recuperação e convite, ver hub/NovaSenhaHub.jsx)
// — puro, sem Supabase, pra dar pra testar.

export const TAMANHO_MINIMO = 6;

// Força de 0 a 3 a partir do tamanho e da variedade de caracteres.
export function forcaDaSenha(senha) {
  const texto = String(senha || "");
  if (!texto) return { nivel: 0, rotulo: "" };
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(texto)).length;
  let nivel = 1;
  if (texto.length >= TAMANHO_MINIMO && tipos >= 2) nivel = 2;
  if (texto.length >= 10 && tipos >= 3) nivel = 3;
  return { nivel, rotulo: ["", "Fraca", "Boa", "Forte"][nivel] };
}

// O que a tela confere enquanto a pessoa digita — as três obrigatórias
// (pedido do Izaias: pelo menos 6 caracteres e pelo menos 1 número).
export function regrasDaSenha(senha, confirmacao) {
  const texto = String(senha || "");
  return [
    { id: "tamanho", texto: `Pelo menos ${TAMANHO_MINIMO} caracteres`, ok: texto.length >= TAMANHO_MINIMO },
    { id: "numero", texto: "Pelo menos 1 número", ok: /\d/.test(texto) },
    { id: "iguais", texto: "As duas senhas iguais", ok: texto.length > 0 && texto === String(confirmacao || "") },
  ];
}

export const senhaPronta = (senha, confirmacao) => regrasDaSenha(senha, confirmacao).every((regra) => regra.ok);

// As mensagens do Supabase (em inglês) em português, do jeito que a pessoa entende.
export function mensagemDoErroDeSenha(error) {
  const texto = String(error?.message || error || "");
  const status = Number(error?.status || 0);
  if (status === 429 || /only request this after|rate limit|too many/i.test(texto)) return "Por segurança, espere um minuto antes de pedir outro link.";
  if (/different from the old password/i.test(texto)) return "A senha nova precisa ser diferente da anterior.";
  if (/weak|pwned|leaked|known to be/i.test(texto)) return "Essa senha é fácil de adivinhar ou já apareceu em vazamentos. Escolha outra.";
  if (/at least|should be at least|too short/i.test(texto)) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`;
  // "Email link is invalid or has expired" é do link; "Email address "x" is invalid" é do endereço.
  if (/expired|link|token|otp/i.test(texto)) return "Esse link não vale mais.";
  if (/email/i.test(texto) && /invalid|format|validate/i.test(texto)) return "Confira o e-mail digitado.";
  if (/fetch|network|failed to/i.test(texto)) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "Não deu certo agora. Tente de novo em instantes.";
}
