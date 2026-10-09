import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "../data/useStore.js";
import { checkBalancete, compareBalancete, compareMonth, dominioCnpj, dominioCodigo, fetchDominioBalancete, fetchDominioMonths, journalMonthStats } from "./dominioSync.js";

// Carrega UMA vez o que chegou da Domínio pra empresa (meses e balancete) e
// compara com o que está no portal — a mesma situação aparece no cartão
// "Domínio" e nos quadrados dos meses da tela Dados (RelatoriosMensais.jsx).
// O resumo do razão (assinatura por mês) e a conferência do balancete só
// são recalculados quando o razão/balancete muda de referência, não a cada
// render.
export function useDominioSync(company) {
  const state = useAppState();
  const codigo = dominioCodigo(company);
  const cnpj = dominioCnpj(company);
  const [rawMonths, setRawMonths] = useState(null); // null = carregando
  const [rawBalancete, setRawBalancete] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [balanceteError, setBalanceteError] = useState(false);

  const reload = useCallback(async () => {
    if (!codigo || !cnpj) {
      setRawMonths([]);
      setRawBalancete(null);
      return;
    }
    setRawMonths(null);
    setLoadError(false);
    setBalanceteError(false);
    // Separados: se só o balancete falhar, os meses continuam aparecendo.
    const [months, balancete] = await Promise.allSettled([fetchDominioMonths(codigo, cnpj), fetchDominioBalancete(codigo, cnpj)]);
    if (months.status === "rejected") {
      console.error("Falha ao consultar os lançamentos da Domínio:", months.reason);
      setLoadError(true);
    }
    if (balancete.status === "rejected") {
      console.error("Falha ao consultar o balancete da Domínio:", balancete.reason);
      setBalanceteError(true);
    }
    setRawBalancete(balancete.status === "fulfilled" ? balancete.value : null);
    setRawMonths(months.status === "fulfilled" ? months.value : []);
  }, [codigo, cnpj]);

  useEffect(() => {
    reload();
  }, [reload]);

  const journal = state.journal;
  const accounts = state.accounts;
  const stats = useMemo(() => journalMonthStats(journal), [journal]);
  const months = useMemo(
    () => (rawMonths === null ? null : rawMonths.map((month) => ({ ...month, status: compareMonth(month, stats) }))),
    [rawMonths, stats]
  );
  const statusByMonth = useMemo(() => new Map((months || []).map((month) => [month.competencia, month.status])), [months]);
  const balancete = useMemo(() => {
    if (!rawBalancete || rawMonths === null) return null;
    return { ...rawBalancete, status: compareBalancete(rawBalancete, accounts), check: checkBalancete(rawBalancete, journal, rawMonths) };
  }, [rawBalancete, rawMonths, accounts, journal]);

  return { codigo, cnpj, months, balancete, loadError, balanceteError, reload, statusByMonth };
}
