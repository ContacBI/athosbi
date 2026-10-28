import { state, setData } from "../data/useStore.js";
import { MODULOS_COMPLEMENTARES } from "./modulos.js";

// "Ver como cliente" (pedido do Izaias, 28/10/2026): a equipe liga e o portal passa a se comportar como pra um cliente — sem menu Parâmetros, sem os
// controles de edição da equipe, só os módulos liberados (aqui: todos, pra ver cada um como o cliente verá). É só a interface: o banco continua
// enxergando a mesma pessoa, e recarregar a página (F5) volta ao normal. Os valores reais ficam em realIsAdmin/realIsColaborador.
export function alternarVisaoCliente() {
  if (!state.realIsAdmin && !state.realIsColaborador) return false; // só a equipe tem o que ligar
  if (state.visaoCliente) {
    setData({ visaoCliente: false, isAdmin: state.realIsAdmin, isColaborador: state.realIsColaborador, modulosCliente: null });
    return false;
  }
  setData({ visaoCliente: true, isAdmin: false, isColaborador: false, modulosCliente: MODULOS_COMPLEMENTARES.map((modulo) => modulo.id) });
  return true;
}
