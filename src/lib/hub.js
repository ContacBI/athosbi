import { EH_TESTE } from "./ambiente.js";
import { DONO_DA_CENTRAL } from "./uso.js";

// Hub novo (o portal com cara de site: Início, Meu B.I., Reforma Tributária,
// Obrigações, Conteúdos, Ferramentas) é montado em paralelo ao portal de hoje
// (pedido do Izaias, 28/10/2026): só aparece no site de TESTE e só para o
// dono. No oficial — e para clientes e colaboradores, em qualquer site —
// nada muda. Quando estiver pronto, é aqui que se liga para os outros.
export function hubLigado(st, ambienteTeste = EH_TESTE) {
  return Boolean(ambienteTeste) && String(st?.userEmail || "").trim().toLowerCase() === DONO_DA_CENTRAL;
}
