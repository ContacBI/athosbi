import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachJournalMonths } from "../lib/journalMonths.js";
import { compareMonth, dominioCodigo, fetchDominioEntries, fetchDominioMonths, unmappedAccounts } from "../lib/dominioSync.js";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(competencia) {
  const [year, month] = competencia.split("-");
  return `${MONTH_SHORT[Number(month) - 1]}/${year.slice(2)}`;
}

const STATUS_STYLE = {
  igual: "border-line bg-surface-muted text-ink-500",
  novo: "border-accent-400 bg-accent-50 text-accent-700 hover:border-accent-500",
  diferente: "border-warning-500/60 bg-warning-50 text-warning-700 hover:border-warning-500",
  vazio: "border-line bg-surface-muted text-ink-400",
};

const STATUS_TITLE = {
  igual: "Igual ao que já está no portal",
  novo: "Ainda não está no portal — clique pra trazer só este mês",
  diferente: "Diferente do que está no portal — clique pra atualizar só este mês",
  vazio: "Vazio na Domínio, mas o portal tem lançamentos — não é aplicado automaticamente; exclua o mês manualmente se for o caso",
};

// Cartão "Domínio" da tela Dados (RelatoriosMensais.jsx): mostra os meses
// que a Central mandou direto do banco da Domínio (ver lib/dominioSync.js e
// supabase/functions/dominio-sync) comparados com o razão atual, e aplica
// no razão os que estão diferentes — sempre por clique, nunca sozinho.
// As mensagens de andamento/erro usam a mesma faixa da página (props).
export default function DominioSyncCard({ company, onBusy, onDone, onError, onProgress }) {
  const state = useAppState();
  const codigo = dominioCodigo(company);
  const [months, setMonths] = useState(null); // null = carregando
  const [loadError, setLoadError] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!codigo) {
      setMonths([]);
      return;
    }
    setMonths(null);
    setLoadError(false);
    try {
      setMonths(await fetchDominioMonths(codigo));
    } catch (error) {
      console.error("Falha ao consultar os lançamentos da Domínio:", error);
      setLoadError(true);
      setMonths([]);
    }
  }, [codigo]);

  useEffect(() => {
    load();
  }, [load]);

  const withStatus = (months || []).map((month) => ({ ...month, status: compareMonth(month, state.journal) }));
  const pending = withStatus.filter((month) => month.status === "novo" || month.status === "diferente");
  const lastSync = withStatus.reduce((latest, month) => (month.syncedAt > latest ? month.syncedAt : latest), "");

  async function apply(targets) {
    if (!targets.length || applying) return;
    setApplying(true);
    try {
      onBusy("Buscando os lançamentos da Domínio…");
      const entries = await fetchDominioEntries(codigo, targets, state.mappings);
      const labels = targets.map((month) => monthLabel(month.competencia)).join(", ");
      const semDePara = unmappedAccounts(entries, state.mappings);
      const aviso = semDePara.length
        ? `\n\nAtenção: ${semDePara.length} conta${semDePara.length === 1 ? "" : "s"} ainda sem De/Para (ex.: ${semDePara.slice(0, 3).join(", ")}). Os lançamentos entram, mas essas contas ficam fora dos relatórios até serem vinculadas.`
        : "";
      if (!window.confirm(`Substituir ${targets.length === 1 ? "o mês" : `${targets.length} meses`} ${labels} pelos ${entries.length} lançamentos da Domínio? Os outros meses não são afetados.${aviso}`)) {
        onDone("");
        return;
      }
      // Mesmo caminho da importação de diário: troca só esses meses e só
      // resolve depois que o Supabase confirmou (desfaz tudo se falhar).
      await attachJournalMonths(entries, { onProgress: onProgress("Salvando os lançamentos da Domínio...") });
      onDone(`Atualizado com a Domínio: ${labels}.`);
    } catch (error) {
      console.error("Falha ao aplicar os lançamentos da Domínio:", error);
      onError(error?.message?.includes("recarregue") ? error.message : "Não consegui trazer os lançamentos da Domínio — nada foi alterado. Tenta de novo.");
    } finally {
      setApplying(false);
    }
  }

  let body;
  if (!codigo) {
    body = <p className="text-[12.5px] text-ink-400">Cadastre o código da empresa (o mesmo da Domínio) em Parâmetros › Empresas pra receber os lançamentos direto de lá.</p>;
  } else if (months === null) {
    body = <p className="text-[12.5px] text-ink-400">Verificando o que chegou da Domínio…</p>;
  } else if (loadError) {
    body = (
      <p className="flex items-center gap-1.5 text-[12.5px] text-warning-600">
        <TriangleAlert size={13} strokeWidth={2} />
        Não consegui consultar a Domínio agora.
      </p>
    );
  } else if (!withStatus.length) {
    body = <p className="text-[12.5px] text-ink-400">Nada recebido da Domínio ainda para o código {codigo}. Quando a Central sincronizar, os meses aparecem aqui.</p>;
  } else {
    body = (
      <>
        <p className="text-[12px] text-ink-400">
          Código {codigo} · última sincronização {new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          {pending.length ? ` · ${pending.length} ${pending.length === 1 ? "mês diferente" : "meses diferentes"} do portal` : " · tudo igual ao portal"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {withStatus.map((month) => {
            const clickable = month.status === "novo" || month.status === "diferente";
            return (
              <button
                key={month.competencia}
                type="button"
                disabled={!clickable || applying}
                onClick={() => apply([month])}
                title={`${STATUS_TITLE[month.status]} · ${month.qtd} lançamentos na Domínio`}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-default ${STATUS_STYLE[month.status]}`}
              >
                {month.status === "igual" && <Check size={11} strokeWidth={2.2} />}
                {monthLabel(month.competencia)}
                {month.status === "novo" && <span className="font-normal">· novo</span>}
                {month.status === "diferente" && <span className="font-normal">· diferente</span>}
                {month.status === "vazio" && <span className="font-normal">· vazio</span>}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Domínio · direto do banco</p>
        <div className="mt-1">{body}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {codigo && (
          <button
            type="button"
            onClick={load}
            disabled={months === null || applying}
            title="Verificar de novo o que chegou da Domínio"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted disabled:opacity-40"
          >
            <RefreshCw size={14} strokeWidth={1.8} />
          </button>
        )}
        <button
          type="button"
          onClick={() => apply(pending)}
          disabled={!pending.length || applying}
          className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Atualizar com a Domínio{pending.length ? ` (${pending.length})` : ""}
        </button>
      </div>
    </div>
  );
}
