import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "../data/useStore.js";
import {
  cancelarPedidoDominio,
  checkBalancete,
  compareBalancete,
  compareMonth,
  dominioCnpj,
  dominioCodigo,
  fetchDominioBalancete,
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
  const [rawBalancete, setRawBalancete] = useState(null);
  const [pedido, setPedido] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [balanceteError, setBalanceteError] = useState(false);

  const reload = useCallback(async () => {
    if (!codigo || !cnpj) {
      setRawMonths([]);
      setRawBalancete(null);
      setPedido(null);
      return;
    }
    setRawMonths(null);
    setLoadError(false);
    setBalanceteError(false);
    // Separados: se só o balancete (ou o pedido) falhar, os meses continuam
    // aparecendo.
    const [months, balancete, ultimoPedido] = await Promise.allSettled([fetchDominioMonths(codigo, cnpj), fetchDominioBalancete(codigo, cnpj), fetchDominioPedido(codigo, cnpj)]);
    if (months.status === "rejected") {
      console.error("Falha ao consultar os lançamentos da Domínio:", months.reason);
      setLoadError(true);
    }
    if (balancete.status === "rejected") {
      console.error("Falha ao consultar o balancete da Domínio:", balancete.reason);
      setBalanceteError(true);
    }
    if (ultimoPedido.status === "rejected") console.error("Falha ao consultar o pedido de período:", ultimoPedido.reason);
    setRawBalancete(balancete.status === "fulfilled" ? balancete.value : null);
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
        if (!ativo) return;
        setPedido(atual);
        if (!isPedidoAberto(atual) || atual.status === "andamento") {
          const months = await fetchDominioMonths(codigo, cnpj);
          if (ativo) setRawMonths(months);
        }
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
  const balancete = useMemo(() => {
    if (!rawBalancete || rawMonths === null) return null;
    return { ...rawBalancete, status: compareBalancete(rawBalancete, accounts), check: checkBalancete(rawBalancete, journal, rawMonths) };
  }, [rawBalancete, rawMonths, accounts, journal]);

  return { codigo, cnpj, months, balancete, pedido, loadError, balanceteError, reload, statusByMonth, pedir, cancelarPedido };
}
