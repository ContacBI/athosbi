import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ArchiveRestore, Download, History, Loader2, RefreshCw, Search } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { supabase } from "../../lib/supabaseClient.js";
import PageHeader from "../../components/PageHeader.jsx";

// Histórico de versões (backup automático — ver app_storage_history em
// supabase/schema.sql): antes de qualquer gravação substituir o cadastro de
// uma empresa, os grupos, o plano gerencial etc., a versão anterior fica
// guardada (no máximo uma a cada 10 minutos por item; 60 dias, e as 5 mais
// recentes de cada item ficam sempre). Aqui o admin vê, baixa e restaura.

const FIXED_LABELS = {
  "portalGerencial.groups.v1": "Grupos de empresas",
  "portalGerencial.planoSnapshot.v1": "Plano gerencial",
  "portalGerencial.planoBackup.v1": "Plano gerencial (cópia antes da última importação)",
  "portalGerencial.planosPadrao.v1": "Planos padrão",
  "portalGerencial.representantes.v1": "Representantes",
  "portalGerencial.indicatorOverrides.v1": "Indicadores personalizados do B.I.",
  "portalGerencial.assistantFavorites.v1": "Pedidos salvos do assistente",
  "portalGerencial.slideLibrary.v1": "Biblioteca de slides",
  "portalGerencial.companies.v2": "Lista antiga de empresas",
};

const MOTIVOS = { alteracao: "antes de uma alteração", exclusao: "antes de ser apagado", restauracao: "antes de uma restauração" };

function formatWhen(iso) {
  const date = new Date(iso);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Resumo do que tem numa versão do cadastro de uma empresa — pra decidir
// qual restaurar sem abrir o arquivo.
function summarize(key, value) {
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "itens"}`;
  if (key.startsWith("portalGerencial.company.") && value && typeof value === "object") {
    const parts = [
      `${(value.mappings || []).length} contas no De/Para`,
      `${(value.accounts || []).length} contas no balancete`,
      `${(value.dashboardTabs || []).length} abas no painel`,
      `${(value.presentations || []).length} apresentações`,
      `${(value.orcamentos || []).length} orçamentos`,
    ];
    if (value.journalCount != null) parts.push(`${Number(value.journalCount).toLocaleString("pt-BR")} lançamentos (contagem)`);
    return parts.join(" · ");
  }
  return "";
}

export default function HistoricoVersoes() {
  const state = useAppState();
  if (!state.isAdmin) return <Navigate to="/parametros/empresas" replace />;
  return <HistoricoScreen />;
}

function HistoricoScreen() {
  const state = useAppState();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [restored, setRestored] = useState("");

  const labelFor = useMemo(() => {
    const names = new Map(state.companies.map((company) => [company.id, company.name]));
    return (key) => {
      if (FIXED_LABELS[key]) return FIXED_LABELS[key];
      if (key.startsWith("portalGerencial.company.")) {
        const id = key.slice("portalGerencial.company.".length);
        return names.get(id) ? `Empresa: ${names.get(id)}` : `Empresa removida (${id})`;
      }
      return key;
    };
  }, [state.companies]);

  async function load() {
    setError("");
    const { data, error: loadError } = await supabase.from("app_storage_history").select("id, key, saved_at, saved_by, motivo").order("saved_at", { ascending: false }).limit(1000);
    if (loadError) {
      console.error(loadError);
      setError("Não consegui carregar o histórico. Confira a conexão.");
      setRows([]);
      return;
    }
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const keys = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((row) => map.set(row.key, (map.get(row.key) || 0) + 1));
    return [...map.entries()].map(([key, count]) => ({ key, count, label: labelFor(key) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [rows, labelFor]);

  const term = search.trim().toLowerCase();
  const shown = (rows || []).filter((row) => (!filter || row.key === filter) && (!term || labelFor(row.key).toLowerCase().includes(term) || String(row.saved_by).toLowerCase().includes(term)));

  async function fetchValue(id) {
    const { data, error: fetchError } = await supabase.from("app_storage_history").select("key, value").eq("id", id).single();
    if (fetchError) throw fetchError;
    return data;
  }

  async function showDetails(row) {
    setBusyId(row.id);
    try {
      const data = await fetchValue(row.id);
      setDetails((current) => ({ ...current, [row.id]: summarize(data.key, data.value) || "Sem resumo para este tipo de item." }));
    } catch (err) {
      console.error(err);
      setDetails((current) => ({ ...current, [row.id]: "Não consegui ler esta versão." }));
    } finally {
      setBusyId(null);
    }
  }

  async function download(row) {
    setBusyId(row.id);
    try {
      const data = await fetchValue(row.id);
      const blob = new Blob([JSON.stringify({ key: data.key, savedAt: row.saved_at, savedBy: row.saved_by, value: data.value }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `versao_${labelFor(row.key).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${row.saved_at.slice(0, 16).replace(/[^0-9]/g, "")}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      window.alert("Não consegui baixar esta versão.");
    } finally {
      setBusyId(null);
    }
  }

  async function restore(row) {
    if (!window.confirm(`Voltar "${labelFor(row.key)}" para a versão de ${formatWhen(row.saved_at)}? A versão de agora fica guardada no histórico (dá para desfazer).`)) return;
    setBusyId(row.id);
    try {
      const { error: restoreError } = await supabase.rpc("restore_app_storage_version", { p_history_id: row.id });
      if (restoreError) throw restoreError;
      setRestored(labelFor(row.key));
      await load();
    } catch (err) {
      console.error(err);
      window.alert(`Não consegui restaurar: ${err.message || err}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros gerais"
        title="Histórico de versões"
        description="Backup automático: antes de cada alteração no cadastro das empresas (De/Para, painel, apresentações, orçamentos), nos grupos, no plano gerencial e na biblioteca, a versão anterior fica guardada aqui por 60 dias."
        icon={History}
      />

      {restored && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success-50 px-4 py-3 text-[13px] text-success-600">
          <span>“{restored}” voltou para a versão escolhida. Recarregue a página para ver.</span>
          <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-lg bg-success-600 px-3 py-1.5 text-[12.5px] font-semibold text-white">
            <RefreshCw size={13} /> Recarregar agora
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 max-w-[360px] rounded-lg border border-line bg-surface-card px-2.5 text-[13px] text-ink-700 outline-none focus:border-accent-400">
          <option value="">Tudo ({(rows || []).length} versões)</option>
          {keys.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label} ({item.count})
            </option>
          ))}
        </select>
        <label className="relative flex min-w-[220px] flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa ou quem alterou…" className="h-9 w-full rounded-lg border border-line bg-surface-card pl-8 pr-3 text-[13px] outline-none focus:border-accent-400" />
        </label>
        <button type="button" onClick={load} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-warning-50 px-3 py-2 text-[12.5px] text-warning-700">{error}</p>}

      {rows === null ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p>
      ) : !shown.length ? (
        <p className="rounded-xl bg-surface-card px-4 py-10 text-center text-[13px] text-ink-400 shadow-sm">
          {rows.length ? "Nada com esse filtro." : "Ainda não há versões guardadas — elas aparecem aqui a partir da próxima alteração."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {shown.map((row) => (
            <div key={row.id} className="historico-versao rounded-lg bg-surface-card px-3.5 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-900">{labelFor(row.key)}</p>
                  <p className="text-[11.5px] text-ink-400">
                    {formatWhen(row.saved_at)} · {MOTIVOS[row.motivo] || row.motivo}
                    {row.saved_by ? ` · alterado por ${row.saved_by}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" disabled={busyId === row.id} onClick={() => showDetails(row)} className="h-8 rounded-lg px-2.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted disabled:opacity-50">
                    Ver o que tem
                  </button>
                  <button type="button" disabled={busyId === row.id} onClick={() => download(row)} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted disabled:opacity-50" title="Baixar esta versão em arquivo">
                    <Download size={13} /> Baixar
                  </button>
                  <button type="button" disabled={busyId === row.id} onClick={() => restore(row)} className="historico-restaurar flex h-8 items-center gap-1 rounded-lg bg-accent-50 px-2.5 text-[12px] font-semibold text-accent-700 hover:bg-accent-100 disabled:opacity-50">
                    <ArchiveRestore size={13} /> Restaurar
                  </button>
                </div>
              </div>
              {details[row.id] && <p className="mt-1.5 text-[12px] text-ink-600">{details[row.id]}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11.5px] leading-snug text-ink-400">
        O razão (lançamentos) não entra aqui: ele vem da Domínio ou da importação e pode ser buscado de novo; a versão anterior de cada razão também fica guardada pelo próprio sistema até a próxima gravação. Para um arquivo completo de uma empresa, use Parâmetros → Empresas → ícone de pasta.
      </p>
    </div>
  );
}
