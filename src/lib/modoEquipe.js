import { state, setData } from "../data/useStore.js";
import { hubLigado, querPortalAtual } from "./hub.js";
import { MODULOS_COMPLEMENTARES } from "./modulos.js";

// A equipe com o hub ligado tem um login e dois jeitos de entrar (pedido do
// Izaias, 29/10/2026):
//   - portal (/hub): vê a carteira toda, mas cada grupo/empresa abre
//     EXATAMENTE como o cliente vê, sem nenhum controle de edição — é o que
//     se usa nas apresentações;
//   - console (/equipe): o back-office, onde se edita tudo (painéis, acessos,
//     o que cada grupo vê, dados, cadastros).
// O portal reaproveita a "visão do cliente" (lib/visaoCliente.js): isAdmin/
// isColaborador ficam falsos só na tela, realIsAdmin/realIsColaborador
// guardam o de verdade. O modo fica na aba (sessionStorage), pra um F5
// dentro do B.I. continuar onde estava.

const CHAVE_DO_MODO = "athosbi.equipe.modo";

export const realStaff = (st) => Boolean(st?.realIsAdmin || st?.realIsColaborador);

// Só pra quem tem o hub (teste + os e-mails do Izaias) e é da equipe; quem
// pediu o portal atual volta ao comportamento de sempre.
export function usaModos(st = state) {
  return hubLigado(st) && realStaff(st) && !querPortalAtual();
}

export function modoGuardado() {
  try {
    return sessionStorage.getItem(CHAVE_DO_MODO) === "console" ? "console" : "portal";
  } catch {
    return "portal";
  }
}

// Qual modo cada endereço pede: o console e as telas de cadastro antigas
// (que agora moram nele) são "console"; o hub e o início são "portal"; o
// resto (o B.I., a Reforma) segue o modo em que a pessoa já estava.
export function modoDaRota(pathname, guardado = "portal") {
  const caminho = String(pathname || "/");
  if (/^\/(equipe|parametros|carteira)(\/|$)/.test(caminho)) return "console";
  if (caminho === "/" || /^\/hub(\/|$)/.test(caminho)) return "portal";
  return guardado === "console" ? "console" : "portal";
}

// `pessoa` (só no portal): ver como UMA pessoa do cliente — os módulos da
// ficha dela e só as empresas/grupos que ela tem ({ email, nome, modulos,
// empresas, grupos }). Sem `pessoa`, quem já estava "vendo como" alguém
// continua assim até voltar pro console.
export function entrarNoModo(modo, { pessoa = null } = {}) {
  try {
    sessionStorage.setItem(CHAVE_DO_MODO, modo);
  } catch {
    // sem armazenamento: vale só até recarregar
  }
  if (!usaModos(state)) return;
  if (modo === "portal") {
    if (pessoa) {
      setData({ modoEquipe: "portal", visaoCliente: true, isAdmin: false, isColaborador: false, modulosCliente: Array.isArray(pessoa.modulos) ? pessoa.modulos : [], pessoaVista: pessoa });
      return;
    }
    if (state.modoEquipe === "portal" && state.visaoCliente) return;
    setData({ modoEquipe: "portal", visaoCliente: true, isAdmin: false, isColaborador: false, modulosCliente: MODULOS_COMPLEMENTARES.map((modulo) => modulo.id), pessoaVista: null });
    return;
  }
  if (state.modoEquipe === "console" && !state.visaoCliente && !state.pessoaVista) return;
  setData({ modoEquipe: "console", visaoCliente: false, isAdmin: state.realIsAdmin, isColaborador: state.realIsColaborador, modulosCliente: null, pessoaVista: null });
}

// "Voltar ao portal atual": desliga os modos e devolve a equipe como sempre foi.
export function sairDosModos() {
  if (!state.modoEquipe) return;
  setData({ modoEquipe: null, visaoCliente: false, isAdmin: state.realIsAdmin, isColaborador: state.realIsColaborador, modulosCliente: null, pessoaVista: null });
}
