import { useMemo, useState } from "react";
import { Check, RotateCcw, Search, X } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { persistActiveCompany } from "../lib/companies.js";
import { dfcDirectTargetOptions, resolveDfcDirectDestino, isCashGerencialCode } from "../data/calculations.js";

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Código contábil é hierarquia, não texto comum — mesmo comparador usado
// no De/Para (ver Depara.jsx), pra listar sempre em ordem de classificação
// (1 antes de 1.01, antes de 1.01.01) em vez de ordem alfabética crua.
function compareClassification(left, right) {
  const a = String(left || "").split(".");
  const b = String(right || "").split(".");
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const aPart = a[index];
    const bPart = b[index];
    if (aPart === bPart) continue;
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const difference = Number(aPart) - Number(bPart);
      if (difference) return difference;
    }
    return aPart.localeCompare(bPart, "pt-BR", { numeric: true, sensitivity: "base" });
  }
  return a.length - b.length;
}

export default function VinculoDfc() {
  const state = useAppState();
  const [search, setSearch] = useState("");
  const [picker, setPicker] = useState(null); // { codigoGerencial, current, contaLabel }
  const [pickerSearch, setPickerSearch] = useState("");

  const mappings = useMemo(() => new Map(state.mappings.map((row) => [row.classificacao, row])), [state.mappings]);
  const overrideCodes = useMemo(() => new Set((state.dfcOverrides || []).map((row) => row.codigo_gerencial)), [state.dfcOverrides]);
  const targetOptions = useMemo(() => dfcDirectTargetOptions(), [state.dfcStructure]);
  const targetByCode = useMemo(() => new Map(targetOptions.map((item) => [item.code, item])), [targetOptions]);
  const targetGroups = useMemo(() => {
    const groups = new Map();
    targetOptions.forEach((item) => {
      const key = item.group || "Outros";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()];
  }, [targetOptions]);

  // Recalcula pra cada conta do balancete: vínculo (via De/Para) com o
  // plano gerencial e destino atual da DFC direta considerando o vínculo
  // desta empresa (ver resolveDfcDirectDestino em data/calculations.js).
  // Caixa e equivalentes (código gerencial 01.01.01.*) nunca têm destino
  // próprio — eles SÃO o caixa, quem é classificado é sempre a
  // contrapartida deles — por isso ficam sem destino aqui, não clicáveis.
  const rows = useMemo(
    () =>
      state.accounts
        .filter((account) => account.tipo_sintetica === "nao")
        .map((account) => {
          const mapping = mappings.get(account.classificacao) || null;
          const codigoGerencial = mapping?.codigo_gerencial || "";
          const isCash = isCashGerencialCode(codigoGerencial);
          const destino = codigoGerencial && !isCash ? resolveDfcDirectDestino(codigoGerencial) : "";
          return {
            account,
            mapping,
            codigoGerencial,
            isCash,
            destino,
            hasOverride: codigoGerencial ? overrideCodes.has(codigoGerencial) : false,
          };
        })
        .sort((a, b) => compareClassification(a.account.classificacao, b.account.classificacao)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.accounts, mappings, overrideCodes, state.dfcLinks, state.dfcOverrides]
  );

  const visible = useMemo(
    () => rows.filter((row) => !search || norm(`${row.account.classificacao} ${row.account.nome_conta}`).includes(norm(search))),
    [rows, search]
  );

  const visiblePickerOptions = useMemo(() => {
    if (!pickerSearch.trim()) return targetGroups;
    const term = norm(pickerSearch);
    return targetGroups
      .map(([group, items]) => [group, items.filter((item) => norm(`${item.code} ${item.name}`).includes(term))])
      .filter(([, items]) => items.length > 0);
  }, [targetGroups, pickerSearch]);

  function openPicker(row) {
    if (!row.codigoGerencial || row.isCash) return;
    setPicker({ codigoGerencial: row.codigoGerencial, current: row.destino, contaLabel: row.account.nome_conta });
    setPickerSearch("");
  }

  function chooseDestino(code) {
    if (!picker) return;
    const next = (state.dfcOverrides || []).filter((item) => item.codigo_gerencial !== picker.codigoGerencial);
    next.push({ codigo_gerencial: picker.codigoGerencial, destino: code });
    setData({ dfcOverrides: next });
    persistActiveCompany();
    setPicker(null);
  }

  function resetDestino() {
    if (!picker) return;
    const next = (state.dfcOverrides || []).filter((item) => item.codigo_gerencial !== picker.codigoGerencial);
    setData({ dfcOverrides: next });
    persistActiveCompany();
    setPicker(null);
  }

  const overrideCount = overrideCodes.size;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Dados</span>
          <h1 className="mt-1 text-[20px] font-semibold text-ink-900">Vínculo DFC</h1>
          <p className="mt-0.5 text-[13px] text-ink-400">
            {rows.length} contas do balancete
            {overrideCount > 0 && <span className="font-medium text-accent-600"> · {overrideCount} personalizada{overrideCount > 1 ? "s" : ""} nesta empresa</span>}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-surface-page px-3.5 py-2.5 text-[12px] text-ink-500">
        Cada conta já vem com um destino padrão de DFC direta (o mesmo pra toda a carteira). Clique no destino pra trocar só nesta empresa — o padrão continua valendo pras demais.
        Contas de <strong>caixa e equivalentes</strong> ficam sem destino aqui: elas são o próprio caixa, quem é classificado é sempre a contrapartida delas.
      </div>

      <div className="rounded-xl bg-surface-card p-3 shadow-sm">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conta, código ou classificação"
            className="w-full rounded-md border border-line-strong bg-surface-page py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
        <div className="max-h-[68vh] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-[1] bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">Conta</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide">DFC direta</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const targetInfo = row.destino ? targetByCode.get(row.destino) : null;
                return (
                  <tr key={row.account.classificacao} className={`transition-colors hover:bg-accent-50/40 ${index % 2 ? "bg-surface-muted/70" : "bg-surface-card"}`}>
                    <td className="px-4 py-2.5 align-top">
                      <p className="text-[12.5px] font-medium text-ink-800">{row.account.nome_conta}</p>
                      <p className="text-[10.5px] text-ink-400">{row.account.classificacao}</p>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      {row.isCash ? (
                        <span className="text-[11.5px] text-ink-300">—</span>
                      ) : row.codigoGerencial ? (
                        <button
                          type="button"
                          onClick={() => openPicker(row)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left text-[12px] transition-colors ${
                            row.hasOverride ? "border-accent-400 bg-accent-50 text-accent-700" : "border-line hover:border-accent-300 hover:bg-surface-muted"
                          }`}
                        >
                          {targetInfo?.name || row.destino || "—"}
                          {row.hasOverride && <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">personalizado</span>}
                        </button>
                      ) : (
                        <span className="text-[11.5px] italic text-ink-300">sem vínculo no De/Para</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-ink-400">Nenhuma conta encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-[2px]" onClick={() => setPicker(null)}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-surface-card shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Destino da DFC direta</span>
                <p className="mt-0.5 truncate text-[14px] font-semibold text-ink-900">{picker.contaLabel}</p>
              </div>
              <button type="button" onClick={() => setPicker(null)} aria-label="Fechar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900">
                <X size={16} />
              </button>
            </div>
            <div className="border-b border-line p-3">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder="Buscar destino..."
                  className="w-full rounded-md border border-line-strong bg-surface-page py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {visiblePickerOptions.map(([group, items]) => (
                <div key={group} className="mb-2">
                  <p className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-400">{group}</p>
                  {items.map((item) => {
                    const active = picker.current === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => chooseDestino(item.code)}
                        className={`mb-1 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left ${
                          active ? "border-accent-500 bg-accent-50" : "border-line hover:border-accent-300 hover:bg-surface-muted"
                        }`}
                      >
                        <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${active ? "border-accent-500 bg-accent-500 text-white" : "border-line-strong"}`}>
                          {active && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] text-ink-800">{item.name}</span>
                          <span className="block text-[10px] text-ink-400">{item.code}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {!visiblePickerOptions.length && <p className="px-3 py-8 text-center text-[12.5px] text-ink-400">Nenhum destino encontrado.</p>}
            </div>
            {overrideCodes.has(picker.codigoGerencial) && (
              <div className="border-t border-line p-3">
                <button type="button" onClick={resetDestino} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line-strong py-2 text-[12px] text-ink-600 hover:bg-surface-muted">
                  <RotateCcw size={13} />
                  Restaurar padrão da carteira
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
