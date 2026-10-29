import { useEffect, useState } from "react";
import { cachedJournalStats, companyHealth, LEVELS } from "../lib/carteira.js";

// Saúde de cada empresa pro console (a mesma conta da página Carteira, ver
// lib/carteira.js), uma empresa por vez fora do clique pra tela não travar.
// Fica guardada enquanto a lista de empresas for a mesma — trocar de página
// dentro do console não refaz a conta.
let guardado = { companies: null, healths: {} };

export function useSaude(companies) {
  const [healths, setHealths] = useState(() => (guardado.companies === companies ? guardado.healths : {}));
  useEffect(() => {
    if (guardado.companies === companies && Object.keys(guardado.healths).length === companies.length) {
      setHealths(guardado.healths);
      return undefined;
    }
    guardado = { companies, healths: {} };
    setHealths({});
    let cancelado = false;
    const fila = [...companies];
    const hoje = new Date();
    function proxima() {
      if (cancelado || !fila.length) return;
      const company = fila.shift();
      let saude;
      try {
        saude = companyHealth(company, { today: hoje, journalStats: cachedJournalStats(company) });
      } catch (error) {
        console.warn(`Console: saúde de ${company.name} falhou`, error);
        saude = { id: company.id, status: "atencao", checks: [], problems: 0, metrics: {} };
      }
      guardado.healths = { ...guardado.healths, [company.id]: saude };
      setHealths(guardado.healths);
      setTimeout(proxima, 0);
    }
    const inicio = setTimeout(proxima, 20);
    return () => {
      cancelado = true;
      clearTimeout(inicio);
    };
  }, [companies]);
  return { healths, calculando: Object.keys(healths).length < companies.length };
}

const ORDEM = { critico: 0, atencao: 1, ok: 2 };

// A pior situação entre as empresas de uma unidade (grupo ou empresa avulsa).
export function statusDaUnidade(empresas, healths) {
  let pior = null;
  for (const company of empresas) {
    const status = healths[company.id]?.status;
    if (!status) continue;
    if (!pior || ORDEM[status] < ORDEM[pior]) pior = status;
  }
  return pior;
}

// Os problemas (atenção ou crítico) de uma empresa, do pior pro mais leve.
export function problemasDaEmpresa(health) {
  return (health?.checks || []).filter((check) => LEVELS[check.level] >= LEVELS.atencao);
}

export const ROTULO_DO_STATUS = { critico: "Crítica", atencao: "Atenção", ok: "Em dia" };
export const COR_DO_STATUS = { critico: "#d8493a", atencao: "#d99a2b", ok: "#1d9e75" };

// Nome curto de uma empresa dentro de um grupo: sem o "LTDA"/"ME"… e só as duas primeiras palavras.
export function nomeCurto(company) {
  const palavras = String(company?.name || "")
    .replace(/\b(LTDA|EIRELI|EPP|ME|S\/?A|SOCIEDADE|EMPRESARIAL|LIMITADA)\b\.?/gi, "")
    .split(/\s+/)
    .filter(Boolean);
  return palavras.slice(0, 2).join(" ") || String(company?.name || "");
}
