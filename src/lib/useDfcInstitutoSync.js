import { useEffect } from "react";
import { useAppState } from "../data/useStore.js";
import { applyDfcInstituto } from "./companies.js";
import { fetchDfcModelo } from "./dfcInstituto.js";

// Empresa "instituto": traz pra ela o modelo de DFC que a Central mandou da Domínio (estrutura + contas) sempre que mudar.
// Só quem lê a área de espera (admin/colaborador) enxerga o modelo novo; cliente usa o que já está salvo na empresa.
export function useDfcInstitutoSync() {
  const state = useAppState();
  const company = state.activeGroupId ? null : state.companies.find((item) => item.id === state.activeCompanyId);
  const instituto = company?.dfcModelo === "instituto";
  const codigo = company?.codigo;
  const cnpj = company?.cnpj;
  const atual = company?.dfcInstituto?.assinatura || "";
  useEffect(() => {
    if (!instituto) return undefined;
    let ativo = true;
    fetchDfcModelo(codigo, cnpj)
      .then((modelo) => {
        if (!ativo || !modelo || modelo.assinatura === atual) return null;
        return applyDfcInstituto(modelo);
      })
      .catch((error) => console.error("Não consegui trazer o modelo de DFC da Domínio:", error));
    return () => {
      ativo = false;
    };
  }, [instituto, codigo, cnpj, atual]);
}
