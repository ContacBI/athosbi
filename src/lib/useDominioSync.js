import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "../data/useStore.js";
import {
  cancelarPedidoDominio,
  checkBalancete,
  compareBalancete,
  compareMonth,
  dominioCnpj,
  dominioCodigo,
  destinoBalancete,
  anoDoBalancete,
  fetchDominioBalancetes,
  fetchDominioMonths,
  fetchDominioPedido,
  isPedidoAberto,
  journalMonthStats,
  pedirDominio,
} from "./dominioSync.js";

// Enquanto um pedido de período está aberto, olha de novo a cada 15 s (a
// Central confere os pedidos a cada poucos minutos).
const PEDIDO_POLL_MS = 15000;

// Carrega UMA vez o que chegou da Domínio pra empresa (meses, balancete e o
// último pedido de período) e compara com o que está no portal — a mesma
// situação aparece no cartão "Domínio" e nos quadrados dos meses da tela
// Dados (RelatoriosMensais.jsx). O resumo do razão (assinatura por mês) e a
// conferência do balancete só são recalculados quando o razão/balancete muda
// de referência, não a cada render.
export function useDominioSync(company) {
  const state = useAppState();
  const codigo = dominioCodigo(company);
  const cnpj = dominioCnpj(company);
  const [rawMonths, setRawMonths] = useState(null); // null = carregando
  const [rawBalancetes, setRawBalancetes] = useState([]);
  const [pedido, setPedido] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [balanceteError, setBalanceteError] = useState(false);

  const reload = useCallback(async () => {
    if (!codigo || !cnpj) {
      setRawMonths([]);
      setRawBalancetes([]);
      setPedido(null);
      return;
    }
    setRawMonths(null);
    setLoadError(false);
    setBalanceteError(false);
    // Separados: se só o balancete (ou o pedido) falhar, os meses continuam
    // aparecendo.
    const [months, balancete, ultimoPedido] = await Promise.allSettled([fetchDominioMonths(codigo, cnpj), fetchDominioBalancetes(codigo, cnpj), fetchDominioPedido(codigo, cnpj)]);
    if (months.status === "rejected") {
      console.error("Falha ao consultar os lançamentos da Domínio:", months.reason);
      setLoadError(true);
    }
    if (balancete.status === "rejected") {
      console.error("Falha ao consultar o balancete da Domínio:", balancete.reason);
      setBalanceteError(true);
    }
    if (ultimoPedido.status === "rejected") console.error("Falha ao consultar o pedido de período:", ultimoPedido.reason);
    setRawBalancetes(balancete.status === "fulfilled" ? balancete.value : []);
    setPedido(ultimoPedido.status === "fulfilled" ? ultimoPedido.value : null);
    setRawMonths(months.status === "fulfilled" ? months.value : []);
  }, [codigo, cnpj]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Pedido aberto: acompanha o status e, enquanto a Central manda, os meses
  // que já chegaram (sem piscar "Verificando…" — só troca a lista).
  const aberto = isPedidoAberto(pedido);
  useEffect(() => {
    if (!aberto) return undefined;
    let ativo = true;
    const timer = setInterval(async () => {
      try {
        const atual = await fetchDominioPedido(codigo, cnpj);
        // Meses antes de trocar o pedido: os dois mudam no mesmo render (senão
        // "trazendo… 0 de 12" aparecia por um instante com meses já chegados).
        const months = !isPedidoAberto(atual) || atual.status === "andamento" ? await fetchDominioMonths(codigo, cnpj) : null;
        if (!ativo) return;
        if (months) setRawMonths(months);
        setPedido(atual);
      } catch (error) {
        console.error("Falha ao acompanhar o pedido de período:", error);
      }
    }, PEDIDO_POLL_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [aberto, codigo, cnpj]);

  const pedir = useCallback(
    async (inicio, fim) => {
      await pedirDominio(codigo, cnpj, inicio, fim);
      setPedido(await fetchDominioPedido(codigo, cnpj));
    },
    [codigo, cnpj]
  );

  const cancelarPedido = useCallback(async () => {
    if (!pedido) return;
    try {
      await cancelarPedidoDominio(pedido.id);
    } finally {
      setPedido(await fetchDominioPedido(codigo, cnpj).catch(() => null));
    }
  }, [pedido, codigo, cnpj]);

  const journal = state.journal;
  const accounts = state.accounts;
  const stats = useMemo(() => journalMonthStats(journal), [journal]);
  const months = useMemo(
    () => (rawMonths === null ? null : rawMonths.map((month) => ({ ...month, status: compareMonth(month, stats) }))),
    [rawMonths, stats]
  );
  const statusByMonth = useMemo(() => new Map((months || []).map((month) => [month.competencia, month.status])), [months]);
  // Um balancete por ano: cada um comparado com o que o portal tem PRA AQUELE
  // ano — o principal (company.accounts) ou o guardado em balancetesAno (ver
  // destinoBalancete em dominioSync.js).
  const balancetes = useMemo(() => {
    if (rawMonths === null) return [];
    const anos = rawBalancetes.map(anoDoBalancete);
    return rawBalancetes.map((item) => {
      const ano = anoDoBalancete(item);
      const destino = destinoBalancete(company, ano, anos);
      const doPortal = destino === "principal" ? accounts : company?.balancetesAno?.[ano]?.accounts || [];
      return { ...item, ano, destino, status: compareBalancete(item, doPortal), check: checkBalancete(item, journal, rawMonths) };
    });
  }, [rawBalancetes, rawMonths, accounts, journal, company]);

  return { codigo, cnpj, months, balancetes, pedido, loadError, balanceteError, reload, statusByMonth, pedir, cancelarPedido };
}
