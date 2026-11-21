// Do console da equipe, o que sai dele abre em OUTRA ABA (pedido do Izaias,
// 21/11/2026): o B.I. de um grupo/empresa (editando ou vendo como o cliente)
// e o portal. O console fica onde estava.
//
// A aba nova entra por /abrir (equipe/AbrirNaAba.jsx), que carrega o grupo
// ou a empresa com a tela de "Abrindo…" e segue pro B.I. no modo pedido. O
// endereço leva só o que não é pessoal (tipo, id, destino, modo); o "ver
// como" uma pessoa do cliente vai pelo localStorage (compartilhado entre as
// abas), numa chave de uso único — sem e-mail na barra de endereço.

const PREFIXO_DA_PESSOA = "athosbi.abrir.pessoa.";
const VALIDADE_DA_PESSOA = 5 * 60 * 1000;

// Só telas do B.I. — nada de mandar a aba nova pra um endereço qualquer.
const DESTINO_VALIDO = /^\/empresa(\/[A-Za-z0-9_-]+)*\/?$/;

export function destinoValido(destino) {
  return DESTINO_VALIDO.test(String(destino || "")) ? String(destino) : "/empresa";
}

function guardarPessoa(pessoa) {
  try {
    const chave = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(PREFIXO_DA_PESSOA + chave, JSON.stringify({ pessoa, em: Date.now() }));
    return chave;
  } catch {
    return "";
  }
}

// Lê e apaga (uso único). Aproveita pra limpar as que ficaram pra trás (aba
// bloqueada, fechada antes de carregar).
function retirarPessoa(chave) {
  let pessoa = null;
  try {
    const agora = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const nome = localStorage.key(i);
      if (!nome?.startsWith(PREFIXO_DA_PESSOA)) continue;
      let guardado = null;
      try {
        guardado = JSON.parse(localStorage.getItem(nome) || "null");
      } catch {
        guardado = null;
      }
      if (chave && nome === PREFIXO_DA_PESSOA + chave && guardado && agora - guardado.em < VALIDADE_DA_PESSOA) pessoa = guardado.pessoa || null;
      if (nome === PREFIXO_DA_PESSOA + chave || !guardado || agora - guardado.em >= VALIDADE_DA_PESSOA) localStorage.removeItem(nome);
    }
  } catch {
    // sem armazenamento: abre como o cliente em geral
  }
  return pessoa;
}

// O endereço da aba nova pra abrir um grupo/empresa (`item`: { tipo, id }).
export function enderecoDeAbertura(item, { destino = "/empresa", comoCliente = false, pessoa = null } = {}) {
  const params = new URLSearchParams({ tipo: item?.tipo === "grupo" ? "grupo" : "empresa", id: String(item?.id || ""), destino: destinoValido(destino), modo: comoCliente || pessoa ? "portal" : "console" });
  if (pessoa) {
    const chave = guardarPessoa(pessoa);
    if (chave) params.set("pessoa", chave);
  }
  return `/abrir?${params.toString()}`;
}

// O pedido que chegou na aba nova (`search`: window.location.search), ou null.
export function lerAbertura(search) {
  const params = new URLSearchParams(search || "");
  const id = params.get("id") || "";
  if (!id) return null;
  const chave = params.get("pessoa") || "";
  return {
    tipo: params.get("tipo") === "grupo" ? "grupo" : "empresa",
    id,
    destino: destinoValido(params.get("destino")),
    modo: params.get("modo") === "portal" ? "portal" : "console",
    pessoa: chave ? retirarPessoa(chave) : null,
  };
}

// Abre `url` numa aba nova, sem ligação com esta. false = o navegador
// bloqueou (quem chama abre aqui mesmo, como antes).
export function abrirEmOutraAba(url) {
  const aba = window.open(url, "_blank");
  if (!aba) return false;
  try {
    aba.opener = null;
  } catch {
    // sem acesso à aba nova: ela abre do mesmo jeito
  }
  return true;
}
