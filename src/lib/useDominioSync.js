import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "../data/useStore.js";
import { compareMonth, dominioCnpj, dominioCodigo, fetchDominioMonths, journalMonthStats } from "./dominioSync.js";

// Carrega UMA vez o que chegou da Domínio pra empresa e compara cada mês com
// o razão atual — a mesma situação aparece no cartão "Domínio" e nos
// quadrados dos meses da tela Dados (RelatoriosMensais.jsx). O resumo do
// razão (assinatura por mês) só é recalculado quando o razão muda de
// referência, não a cada render.
export function useDominioSync(company) {
  const state = useAppState();
  const codigo = dominioCodigo(company);
  const cnpj = dominioCnpj(company);
  const [rawMonths, setRawMonths] = useState(null); // null = carregando
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    if (!codigo || !cnpj) {
      setRawMonths([]);
      return;
    }
    setRawMonths(null);
    setLoadError(false);
    try {
      setRawMonths(await fetchDominioMonths(codigo, cnpj));
    } catch (error) {
      console.error("Falha ao consultar os lançamentos da Domínio:", error);
      setLoadError(true);
      setRawMonths([]);
    }
  }, [codigo, cnpj]);

  useEffect(() => {
    reload();
  }, [reload]);

  const journal = state.journal;
  const stats = useMemo(() => journalMonthStats(journal), [journal]);
  const months = useMemo(
    () => (rawMonths === null ? null : rawMonths.map((month) => ({ ...month, status: compareMonth(month, stats) }))),
    [rawMonths, stats]
  );
  const statusByMonth = useMemo(() => new Map((months || []).map((month) => [month.competencia, month.status])), [months]);

  return { codigo, cnpj, months, loadError, reload, statusByMonth };
}
