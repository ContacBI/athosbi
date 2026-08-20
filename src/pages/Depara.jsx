import { useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Link2, Search, Upload, X } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { persistActiveCompany, remapJournal } from "../lib/companies.js";
import { parseCsv } from "../importers/csv.js";
import { NATURE_LABELS, accountNature, planoNature } from "../lib/accountNature.js";

const HEADERS = ["codigo_conta", "classificacao", "nome_conta", "tipo_conta", "codigo_gerencial", "categoria_gerencial", "demonstrativo", "grupo_macro", "observacao"];
const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const csv = (rows) => [HEADERS.join(";"), ...rows.map((row) => HEADERS.map((key) => String(row[key] ?? "").replace(/;/g, ",")).join(";"))].join("\n");

// Código contábil é uma hierarquia, não texto comum: 1 vem antes de 1.01,
// que vem antes de 1.01.01. A comparação por descrição deixava o plano
// aparentemente aleatório e dificultava localizar a conta-pai correta.
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

export default function Depara() {
  const state = useAppState();
  const [accountSearch, setAccountSearch] = useState("");
  const [planoSearch, setPlanoSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [report, setReport] = useState("todos");
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState("");
  const [replicateOpen, setReplicateOpen] = useState(false);
  const inputRef = useRef(null);
  const mappings = useMemo(() => new Map(state.mappings.map((row) => [row.classificacao, row])), [state.mappings]);
  const accounts = useMemo(() => state.accounts.filter((a) => a.tipo_sintetica === "nao").map((account) => ({ account, mapping: mappings.get(account.classificacao) || null })).sort((a, b) => compareClassification(a.account.classificacao, b.account.classificacao)), [state.accounts, mappings]);
  const plan = useMemo(() => state.plano.filter((row) => row.aceita_depara === "sim").sort((a, b) => compareClassification(a.codigo_gerencial, b.codigo_gerencial)), [state.plano]);
  const selectedRows = useMemo(() => accounts.filter(({ account }) => selected.includes(account.classificacao)), [accounts, selected]);
  const selectedNature = useMemo(() => {
    const values = [...new Set(selectedRows.map(({ account }) => accountNature(account.classificacao, state.natureRules)).filter(Boolean))];
    return values.length === 1 ? values[0] : null;
  }, [selectedRows, state.natureRules]);
  const pending = accounts.filter((row) => !row.mapping).length;
  const replicateSources = useMemo(
    () => state.companies.filter((company) => company.id !== state.activeCompanyId && (company.mappings || []).length > 0),
    [state.companies, state.activeCompanyId],
  );
  const mapGroups = useMemo(() => {
    const groups = new Map();
    state.mappings.forEach((mapping) => {
      if (!groups.has(mapping.codigo_gerencial)) groups.set(mapping.codigo_gerencial, { ...mapping, accounts: [] });
      groups.get(mapping.codigo_gerencial).accounts.push(mapping);
    });
    return [...groups.values()]
      .map((group) => ({ ...group, accounts: group.accounts.sort((a, b) => compareClassification(a.classificacao, b.classificacao)) }))
      .sort((a, b) => compareClassification(a.codigo_gerencial, b.codigo_gerencial));
  }, [state.mappings]);
  const visibleAccounts = useMemo(() => accounts.filter(({ account, mapping }) => {
    if (onlyPending && mapping) return false;
    if (report !== "todos" && mapping?.demonstrativo !== report) return false;
    return !accountSearch || norm(`${account.classificacao} ${account.nome_conta} ${mapping?.categoria_gerencial || ""}`).includes(norm(accountSearch));
  }), [accounts, onlyPending, report, accountSearch]);
  const visiblePlan = useMemo(() => plan.filter((row) => {
    if (selectedNature && planoNature(row) !== selectedNature) return false;
    if (report !== "todos" && row.demonstrativo !== report) return false;
    return !planoSearch || norm(`${row.codigo_gerencial} ${row.nome} ${row.grupo_macro || ""}`).includes(norm(planoSearch));
  }), [plan, selectedNature, report, planoSearch]);
  const flash = (message) => { setNotice(message); setTimeout(() => setNotice(""), 3200); };

  function toggle(account) {
    const code = account.classificacao;
    if (selected.includes(code)) return setSelected((current) => current.filter((value) => value !== code));
    const nature = accountNature(code, state.natureRules);
    if (selectedNature && nature && selectedNature !== nature) {
      setSelected([code]);
      flash(`Seleção alterada para ${NATURE_LABELS[nature]}. Naturezas diferentes não podem ser vinculadas juntas.`);
    } else setSelected((current) => [...current, code]);
  }
  function save(next, message) {
    setData({ mappings: next, journal: remapJournal(state.journal, next) });
    persistActiveCompany(); flash(message); setSelected([]);
  }
  function link() {
    if (!selectedRows.length || !target) return;
    const set = new Set(selected);
    const next = state.mappings.filter((item) => !set.has(item.classificacao));
    selectedRows.forEach(({ account }) => next.push({ codigo_conta: account.codigo, classificacao: account.classificacao, nome_conta: account.nome_conta, tipo_conta: "", codigo_gerencial: target.codigo_gerencial, categoria_gerencial: target.nome, demonstrativo: target.demonstrativo, grupo_macro: target.grupo_macro, observacao: "" }));
    save(next, `${selectedRows.length} ${selectedRows.length === 1 ? "conta vinculada" : "contas vinculadas"} a “${target.nome}”.`);
    setTarget(null);
  }
  // Só preenche contas AINDA SEM vínculo desta empresa — nunca sobrescreve
  // um vínculo já feito (evita atropelar trabalho manual em andamento,
  // inclusive de outra pessoa mexendo na mesma tela ao mesmo tempo). Casa
  // pela classificação E pelo nome da conta juntos, pra maior segurança:
  // só replica quando a empresa-fonte tem uma conta com o MESMO código E
  // o MESMO nome, já vinculada.
  function replicateFrom(sourceCompanyId) {
    const source = state.companies.find((company) => company.id === sourceCompanyId);
    if (!source) return;
    const sourceMap = new Map((source.mappings || []).map((row) => [`${row.classificacao}||${norm(row.nome_conta)}`, row]));
    const next = [...state.mappings];
    let matched = 0;
    accounts.forEach(({ account, mapping }) => {
      if (mapping) return;
      const sourceMapping = sourceMap.get(`${account.classificacao}||${norm(account.nome_conta)}`);
      if (!sourceMapping) return;
      next.push({
        codigo_conta: account.codigo,
        classificacao: account.classificacao,
        nome_conta: account.nome_conta,
        tipo_conta: "",
        codigo_gerencial: sourceMapping.codigo_gerencial,
        categoria_gerencial: sourceMapping.categoria_gerencial,
        demonstrativo: sourceMapping.demonstrativo,
        grupo_macro: sourceMapping.grupo_macro,
        observacao: "",
      });
      matched += 1;
    });
    setReplicateOpen(false);
    if (!matched) {
      flash(`Nenhuma conta pendente bateu (código + nome) com o de-para de "${source.name}".`);
      return;
    }
    save(next, `${matched} ${matched === 1 ? "conta vinculada" : "contas vinculadas"} a partir do de-para de "${source.name}".`);
  }
  function unlink() {
    if (!selectedRows.length) return;
    const set = new Set(selected); save(state.mappings.filter((row) => !set.has(row.classificacao)), `${selectedRows.length} ${selectedRows.length === 1 ? "vínculo removido" : "vínculos removidos"}.`);
  }
  function editMapping(mapping) {
    const account = accounts.find((row) => row.account.classificacao === mapping.classificacao)?.account;
    if (!account) return;
    setSelected([account.classificacao]);
    setTarget(plan.find((row) => row.codigo_gerencial === mapping.codigo_gerencial) || null);
  }
  function unlinkOne(mapping) {
    save(state.mappings.filter((row) => row.classificacao !== mapping.classificacao), `Vínculo de “${mapping.nome_conta}” removido.`);
  }
  async function importCsv(event) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try { const rows = parseCsv(await file.text()); setData({ mappings: rows, journal: remapJournal(state.journal, rows) }); persistActiveCompany(); flash(`De/para importado: ${rows.length} vínculos.`); } catch { flash("Não consegui ler esse arquivo de de/para."); }
  }
  function exportCsv() { const blob = new Blob(["﻿" + csv(state.mappings)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "de_para.csv"; link.click(); URL.revokeObjectURL(url); }

  return <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm"><div><span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Dados</span><h1 className="mt-1 text-[20px] font-semibold text-ink-900">De/Para</h1><p className="mt-0.5 text-[13px] text-ink-400">{accounts.length} contas contábeis · {pending ? <span className="font-medium text-warning-600">{pending} sem vínculo</span> : <span className="font-medium text-success-600">todas vinculadas</span>}</p></div><div className="flex gap-2">
      {pending > 0 && replicateSources.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setReplicateOpen((open) => !open)} className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted"><Copy size={14} />Replicar de outra empresa</button>
          {replicateOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-line bg-surface-card p-1.5 shadow-lg">
              <p className="px-2 py-1.5 text-[11px] text-ink-400">Preenche só as {pending} contas ainda sem vínculo, casando por código + nome com a empresa escolhida.</p>
              {replicateSources.map((company) => (
                <button key={company.id} type="button" onClick={() => replicateFrom(company.id)} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-700 hover:bg-surface-muted">{company.name}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted"><Download size={14} />Exportar CSV</button><button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600"><Upload size={14} />Importar CSV</button></div></div>
    {notice && <p className="rounded-lg bg-accent-50 px-3 py-2 text-[12px] text-accent-700">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-card p-3 shadow-sm"><div className="inline-flex gap-0.5 rounded-full bg-surface-muted p-1">{[{ id: "todos", label: "Todos" }, { id: "BP", label: "Balanço" }, { id: "DRE", label: "DRE" }].map((item) => <button key={item.id} type="button" onClick={() => setReport(item.id)} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ${report === item.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}>{item.label}</button>)}</div><label className="flex items-center gap-1.5 text-[12.5px] text-ink-600"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />Só pendentes</label>{selectedRows.length > 0 && <div className="ml-auto flex items-center gap-2 text-[12px]"><span className="rounded-full bg-accent-50 px-2.5 py-1 text-accent-700">{selectedRows.length} selecionada{selectedRows.length > 1 ? "s" : ""}{selectedNature && ` · ${NATURE_LABELS[selectedNature]}`}</span><button type="button" onClick={unlink} className="flex items-center gap-1 text-danger-600"><X size={14} />Remover vínculos</button></div>}</div>
    <div className="grid min-h-[570px] grid-cols-1 overflow-hidden rounded-xl bg-surface-card shadow-sm xl:grid-cols-3">
      <Panel title="Contas do balancete" caption={`${pending} pendentes de ${accounts.length} contas analíticas`} placeholder="Buscar conta, código ou classificação" value={accountSearch} onChange={setAccountSearch} count={`${visibleAccounts.length} contas`}><div className="max-h-[62vh] overflow-y-auto p-2">{visibleAccounts.map(({ account, mapping }) => { const on = selected.includes(account.classificacao); return <button key={account.classificacao} type="button" onClick={() => toggle(account)} className={`mb-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${on ? "border-accent-400 bg-accent-50" : "border-line hover:border-accent-200 hover:bg-surface-muted"}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-accent-500 bg-accent-500 text-white" : "border-line-strong"}`}>{on && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium text-ink-800">{account.nome_conta}</span><span className="block text-[10.5px] text-ink-400">{account.classificacao}</span></span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mapping ? "bg-success-50 text-success-600" : "bg-warning-50 text-warning-700"}`}>{mapping ? "Vinculada" : "Pendente"}</span></button>})}{!visibleAccounts.length && <Empty text="Nenhuma conta encontrada." />}</div></Panel>
      <section className="flex min-h-0 flex-col border-b border-line xl:border-b-0 xl:border-r"><div className="border-b border-line bg-surface-muted px-4 py-3"><h2 className="text-[14px] font-semibold text-ink-900">Mapa em construção</h2><p className="mt-0.5 text-[11.5px] text-ink-400">O esqueleto atualiza conforme os vínculos são cadastrados.</p></div><div className="border-b border-line bg-warning-50 px-4 py-2 text-[11px] text-warning-700">{selectedRows.length ? `Seleção: ${selectedRows.length} conta${selectedRows.length > 1 ? "s" : ""}${target ? ` → ${target.nome}` : ". Escolha o destino."}` : "Marque uma ou mais contas do balancete."}</div><div className="max-h-[62vh] overflow-y-auto p-2">{mapGroups.map((group) => <div key={group.codigo_gerencial} className="mb-2 overflow-hidden rounded-lg border border-line"><div className="bg-surface-muted px-3 py-2"><p className="text-[12.5px] font-semibold text-ink-800">{group.categoria_gerencial}</p><p className="text-[10.5px] text-ink-400">{group.codigo_gerencial} · {group.accounts.length} conta{group.accounts.length > 1 ? "s" : ""}</p></div>{group.accounts.map((mapping) => <div key={mapping.classificacao} className="border-t border-line px-3 py-2"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate text-[11.5px] text-ink-800">{mapping.nome_conta}</p><p className="text-[10px] text-ink-400">{mapping.classificacao}</p></div><button type="button" onClick={() => editMapping(mapping)} className="rounded border border-accent-200 px-1.5 py-0.5 text-[10px] text-accent-700">Alterar</button></div><button type="button" onClick={() => unlinkOne(mapping)} className="mt-1.5 w-full rounded border border-danger-200 py-1 text-[10px] text-danger-600">Desvincular</button></div>)}</div>)}{!mapGroups.length && <Empty text="Nenhum vínculo cadastrado ainda." />}</div></section>
      <Panel title="Plano gerencial" caption={target ? `Destino selecionado: ${target.nome}` : "Selecione o destino para os vínculos"} placeholder="Buscar código ou descrição" value={planoSearch} onChange={setPlanoSearch}><div className="max-h-[62vh] overflow-y-auto p-2">{visiblePlan.map((row) => { const active = target?.codigo_gerencial === row.codigo_gerencial; return <button key={row.codigo_gerencial} type="button" onClick={() => setTarget(row)} className={`mb-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${active ? "border-accent-500 bg-accent-50" : "border-line hover:border-accent-300 hover:bg-surface-muted"}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-accent-500 bg-accent-500 text-white" : "border-line-strong"}`}>{active && <Check size={12} strokeWidth={3} />}</span><span className="min-w-0"><span className="block truncate text-[12.5px] font-medium text-ink-800">{row.nome}</span><span className="block text-[10.5px] text-ink-400">{row.codigo_gerencial} · {row.demonstrativo}{row.grupo_macro && ` | ${row.grupo_macro}`}</span></span></button>})}{!visiblePlan.length && <Empty text="Nenhuma conta gerencial disponível." />}</div></Panel>
    </div><div className="sticky bottom-3 z-20 rounded-lg bg-accent-500 p-1.5 shadow-lg"><button type="button" disabled={!selectedRows.length || !target} onClick={link} className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Link2 size={15} />{target ? `Vincular seleção a ${target.nome}` : "Escolha uma conta gerencial para vincular"}</button></div><input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={importCsv} />
  </div>;
}

function Panel({ title, caption, placeholder, value, onChange, count, children }) { return <section className="flex min-h-0 flex-col border-b border-line last:border-b-0 xl:border-b-0 xl:first:border-r"><div className="border-b border-line bg-surface-muted px-4 py-3"><div className="flex justify-between"><div><h2 className="text-[14px] font-semibold text-ink-900">{title}</h2><p className="mt-0.5 text-[11.5px] text-ink-400">{caption}</p></div>{count && <span className="text-[11px] text-ink-400">{count}</span>}</div><div className="relative mt-3"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-line-strong bg-surface-card py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500" /></div></div>{children}</section>; }
function Empty({ text }) { return <p className="px-3 py-10 text-center text-[13px] text-ink-400">{text}</p>; }
