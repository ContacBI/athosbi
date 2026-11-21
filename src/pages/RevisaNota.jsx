import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, PackageCheck, Search, Users } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { groupCompanies } from "../lib/groups.js";
import { CARTAO, inteiro, moneyFull, pct } from "../lib/fmtNotas.js";
import { PERFIS, PORTAL_REVISA_NOTA, SITUACOES, fetchRevisaNota, filtrarClientes, filtrarProdutos, perfilDoCliente, resumoDeClientes, resumoDeProdutos, situacaoDoProduto } from "../lib/revisaNota.js";

// Revisa Nota (Ferramentas, só Micromedical por enquanto): a classificação dos produtos para IBS/CBS decidida pelo escritório e o perfil confirmado dos compradores. Só leitura —
// pedir cadastro novo ou mudança continua no portal do Revisa Nota (botão no topo).
const LIMITE = 100;

const dataHora = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const dia = (iso) => {
  const [a, m, d] = String(iso || "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};

function Esqueleto() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-5 p-4 md:p-6">
      <div className="h-24 rounded-2xl bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface-muted" />)}</div>
      <div className="h-80 rounded-2xl bg-surface-muted" />
    </div>
  );
}

function Indicador({ rotulo, valor, sub, ativo, onClick, cor = "bg-accent-500" }) {
  return (
    <button type="button" onClick={onClick} className={`${CARTAO} relative overflow-hidden p-4 text-left transition-shadow hover:shadow-md ${ativo ? "ring-2 ring-accent-400" : ""}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${cor}`} />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{rotulo}</p>
      <p className="mt-1.5 text-[22px] font-bold leading-7 tabular-nums text-ink-900">{valor}</p>
      <p className="mt-0.5 truncate text-[11.5px] text-ink-400">{sub}</p>
    </button>
  );
}

function Selo({ children, tom = "neutro" }) {
  const cores = {
    verde: "bg-emerald-500/10 text-emerald-600",
    ambar: "bg-amber-500/15 text-amber-600",
    cinza: "bg-surface-muted text-ink-500",
    azul: "bg-sky-500/10 text-sky-600",
    laranja: "bg-accent-500/10 text-accent-700",
    neutro: "bg-surface-muted text-ink-600",
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cores[tom]}`}>{children}</span>;
}

const TOM_SITUACAO = { decidido: "verde", duvida: "ambar", pendente: "cinza" };
const NOME_SITUACAO = { decidido: "Classificado", duvida: "Em dúvida", pendente: "Pendente" };
const TOM_PERFIL = { privado: "azul", publico: "laranja", sus_cebas: "verde", verificar: "ambar", sem: "cinza" };
const NOME_PERFIL = { privado: "Privado", publico: "Público", sus_cebas: "SUS / CEBAS", verificar: "A verificar", sem: "Sem perfil" };

function Cabecalho({ colunas }) {
  return (
    <thead className="sticky top-0 bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
      <tr>
        {colunas.map(([nome, direita]) => (
          <th key={nome} className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide ${direita ? "text-right" : "text-left"}`}>{nome}</th>
        ))}
      </tr>
    </thead>
  );
}

function Produtos({ lista }) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const [tratamento, setTratamento] = useState("todos");
  const [limite, setLimite] = useState(LIMITE);
  const produtos = lista.produtos;
  const resumo = useMemo(() => resumoDeProdutos(produtos), [produtos]);
  const tratamentos = useMemo(() => [...new Set(produtos.map((p) => p.decisao?.tratamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [produtos]);
  const filtrados = useMemo(() => filtrarProdutos(produtos, { busca, situacao, tratamento }), [produtos, busca, situacao, tratamento]);
  const mostrados = filtrados.slice(0, limite);
  const escolher = (id) => { setSituacao((atual) => (atual === id ? "todos" : id)); setLimite(LIMITE); };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Indicador rotulo="Produtos vendidos" valor={inteiro(resumo.total.qtd)} sub={`${moneyFull(resumo.total.valor)} vendidos no período`} ativo={situacao === "todos"} onClick={() => escolher("todos")} cor="bg-ink-300" />
        <Indicador rotulo="Classificados" valor={inteiro(resumo.decidido.qtd)} sub={`${pct(resumo.decidido.valor, resumo.total.valor)} do valor vendido`} ativo={situacao === "decidido"} onClick={() => escolher("decidido")} cor="bg-emerald-500" />
        <Indicador rotulo="Em dúvida" valor={inteiro(resumo.duvida.qtd)} sub={`${pct(resumo.duvida.valor, resumo.total.valor)} do valor vendido`} ativo={situacao === "duvida"} onClick={() => escolher("duvida")} cor="bg-amber-500" />
        <Indicador rotulo="Pendentes" valor={inteiro(resumo.pendente.qtd)} sub={`${pct(resumo.pendente.valor, resumo.total.valor)} do valor vendido`} ativo={situacao === "pendente"} onClick={() => escolher("pendente")} cor="bg-ink-300" />
      </div>

      <div className={`${CARTAO} flex flex-col`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(LIMITE); }} placeholder="Buscar por código, descrição ou NCM…" className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
          </div>
          <div className="flex gap-1.5 text-[12.5px]">
            {[{ id: "todos", nome: "Todos" }, ...SITUACOES].map((s) => (
              <button key={s.id} type="button" onClick={() => escolher(s.id)} className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${situacao === s.id ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{s.nome}</button>
            ))}
          </div>
          {tratamentos.length > 0 && (
            <select value={tratamento} onChange={(e) => { setTratamento(e.target.value); setLimite(LIMITE); }} aria-label="Tratamento" className="rounded-lg border border-line bg-surface-card px-2.5 py-2 text-[12.5px] text-ink-700 outline-none focus:border-accent-500">
              <option value="todos">Todos os tratamentos</option>
              {tratamentos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <p className="border-b border-line px-4 py-2 text-[12px] text-ink-500">{inteiro(filtrados.length)} produto{filtrados.length === 1 ? "" : "s"} · {moneyFull(filtrados.reduce((s, p) => s + (Number(p.valor) || 0), 0))} vendidos{lista.de ? ` (de ${dia(lista.de)} até ${dia(lista.ate)})` : ""}</p>
        <div className="max-h-[640px] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[980px] text-[13px]">
            <Cabecalho colunas={[["Código"], ["Produto"], ["NCM"], ["Vendas", true], ["Classificação (LC 214)"], ["Código na nota"], ["Situação"]]} />
            <tbody>
              {mostrados.map((p, i) => {
                const d = p.decisao;
                const sit = situacaoDoProduto(p);
                return (
                  <tr key={`${p.emp}|${p.codigo}`} className={`align-top ${i % 2 ? "bg-surface-muted/50" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-600">{p.codigo}</td>
                    <td className="max-w-[340px] px-4 py-2 text-ink-900"><p className="truncate" title={p.descricao}>{p.descricao}</p></td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-600">{p.ncm}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-ink-900">{moneyFull(p.valor)}<p className="text-[11px] text-ink-400">{inteiro(p.notas)} nota{p.notas === 1 ? "" : "s"}</p></td>
                    <td className="max-w-[300px] px-4 py-2 text-ink-700">
                      {d?.anexo ? <p>Anexo {d.anexo}{d.item ? ` · item ${d.item}` : ""}</p> : <p className="text-ink-300">—</p>}
                      {d?.tratamento && <p className="text-[11.5px] text-ink-500">{d.tratamento}</p>}
                      {d?.observacao && <p className="mt-0.5 truncate text-[11.5px] text-ink-400" title={d.observacao}>{d.observacao}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-700">{d?.cClassTrib || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2"><Selo tom={TOM_SITUACAO[sit]}>{NOME_SITUACAO[sit]}</Selo></td>
                  </tr>
                );
              })}
              {!mostrados.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-400">Nenhum produto com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtrados.length > limite && (
          <div className="border-t border-line px-4 py-3 text-center">
            <button type="button" onClick={() => setLimite((l) => l + LIMITE)} className="rounded-lg border border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">Mostrar mais {Math.min(LIMITE, filtrados.length - limite)} de {inteiro(filtrados.length - limite)}</button>
          </div>
        )}
      </div>
    </>
  );
}

function Clientes({ lista }) {
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState("todos");
  const [uf, setUf] = useState("todos");
  const [limite, setLimite] = useState(LIMITE);
  const clientes = lista.clientes;
  const resumo = useMemo(() => resumoDeClientes(clientes), [clientes]);
  const ufs = useMemo(() => [...new Set(clientes.map((c) => c.uf).filter(Boolean))].sort(), [clientes]);
  const filtrados = useMemo(() => filtrarClientes(clientes, { busca, perfil, uf }), [clientes, busca, perfil, uf]);
  const mostrados = filtrados.slice(0, limite);
  const escolher = (id) => { setPerfil((atual) => (atual === id ? "todos" : id)); setLimite(LIMITE); };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Indicador rotulo="Compradores" valor={inteiro(resumo.total.qtd)} sub={`${moneyFull(resumo.total.valor)} comprados no período`} ativo={perfil === "todos"} onClick={() => escolher("todos")} cor="bg-ink-300" />
        <Indicador rotulo="Privados" valor={inteiro(resumo.privado.qtd)} sub={`${pct(resumo.privado.valor, resumo.total.valor)} do valor`} ativo={perfil === "privado"} onClick={() => escolher("privado")} cor="bg-sky-500" />
        <Indicador rotulo="Públicos e SUS / CEBAS" valor={inteiro(resumo.publico.qtd + resumo.sus_cebas.qtd)} sub={`${pct(resumo.publico.valor + resumo.sus_cebas.valor, resumo.total.valor)} do valor`} ativo={perfil === "publico"} onClick={() => escolher("publico")} cor="bg-accent-500" />
        <Indicador rotulo="Sem perfil confirmado" valor={inteiro(resumo.sem.qtd + resumo.verificar.qtd)} sub={`${pct(resumo.sem.valor + resumo.verificar.valor, resumo.total.valor)} do valor`} ativo={perfil === "sem"} onClick={() => escolher("sem")} cor="bg-amber-500" />
      </div>

      <div className={`${CARTAO} flex flex-col`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(LIMITE); }} placeholder="Buscar por nome, documento ou cidade…" className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[12.5px]">
            {[{ id: "todos", nome: "Todos" }, ...PERFIS.filter((p) => p.id !== "verificar"), { id: "sem", nome: "Sem perfil" }].map((p) => (
              <button key={p.id} type="button" onClick={() => escolher(p.id)} className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${perfil === p.id ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{p.nome}</button>
            ))}
          </div>
          {ufs.length > 1 && (
            <select value={uf} onChange={(e) => { setUf(e.target.value); setLimite(LIMITE); }} aria-label="UF" className="rounded-lg border border-line bg-surface-card px-2.5 py-2 text-[12.5px] text-ink-700 outline-none focus:border-accent-500">
              <option value="todos">Todas as UFs</option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>
        <p className="border-b border-line px-4 py-2 text-[12px] text-ink-500">{inteiro(filtrados.length)} comprador{filtrados.length === 1 ? "" : "es"} · {moneyFull(filtrados.reduce((s, c) => s + (Number(c.valor) || 0), 0))} comprados{lista.de ? ` (de ${dia(lista.de)} até ${dia(lista.ate)})` : ""}</p>
        <div className="max-h-[640px] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[920px] text-[13px]">
            <Cabecalho colunas={[["Comprador"], ["Documento"], ["Cidade / UF"], ["Compras", true], ["Perfil"], ["Observação"]]} />
            <tbody>
              {mostrados.map((c, i) => {
                const perf = perfilDoCliente(c);
                return (
                  <tr key={c.chave} className={`align-top ${i % 2 ? "bg-surface-muted/50" : ""}`}>
                    <td className="max-w-[320px] px-4 py-2 text-ink-900"><p className="truncate" title={c.nome}>{c.nome}</p></td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-600">{c.doc}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-600">{[c.municipio, c.uf].filter(Boolean).join(" / ")}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-ink-900">{moneyFull(c.valor)}<p className="text-[11px] text-ink-400">{inteiro(c.notas)} nota{c.notas === 1 ? "" : "s"}{c.ultima ? ` · última ${dia(c.ultima)}` : ""}</p></td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Selo tom={TOM_PERFIL[perf] || "cinza"}>{NOME_PERFIL[perf] || perf}</Selo>
                      {c.perfil?.cebasValidade && <p className="mt-0.5 text-[11px] text-ink-400">CEBAS até {dia(c.perfil.cebasValidade)}</p>}
                    </td>
                    <td className="max-w-[280px] px-4 py-2 text-[12px] text-ink-500"><p className="truncate" title={c.perfil?.observacao || c.perfil?.comprovante || ""}>{c.perfil?.observacao || c.perfil?.comprovante || ""}</p></td>
                  </tr>
                );
              })}
              {!mostrados.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">Nenhum comprador com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtrados.length > limite && (
          <div className="border-t border-line px-4 py-3 text-center">
            <button type="button" onClick={() => setLimite((l) => l + LIMITE)} className="rounded-lg border border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">Mostrar mais {Math.min(LIMITE, filtrados.length - limite)} de {inteiro(filtrados.length - limite)}</button>
          </div>
        )}
      </div>
    </>
  );
}

export default function RevisaNota() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : company ? [company] : []), [grupo, company, state.companies]);
  const idsMembros = membros.map((m) => m.id).join(",");
  const [conjuntos, setConjuntos] = useState(null); // [{ empresa, produtos, clientes, atualizadoEm }]
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("produtos");
  const [escolhida, setEscolhida] = useState(0);

  useEffect(() => {
    if (!membros.length) return undefined;
    let ativo = true;
    setConjuntos(null);
    setErro("");
    Promise.all(membros.map((m) => fetchRevisaNota(m.id)))
      .then((todos) => {
        if (!ativo) return;
        // as filiais de uma mesma raiz de CNPJ recebem a mesma lista: mostra uma vez só
        const vistos = new Set();
        const unicos = [];
        for (const r of todos) {
          const nome = r.produtos?.empresa || r.clientes?.empresa;
          if (!nome || vistos.has(nome)) continue;
          vistos.add(nome);
          unicos.push({ empresa: nome, ...r });
        }
        setConjuntos(unicos);
        setEscolhida(0);
      })
      .catch((err) => {
        console.error("Falha ao ler o Revisa Nota:", err);
        if (ativo) setErro("Não consegui carregar o Revisa Nota agora. Tente de novo.");
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsMembros]);

  if (!membros.length) return <p className="p-6 text-[13px] text-ink-400">Abra uma empresa ou um grupo para ver o Revisa Nota.</p>;
  if (erro) return <p className="p-6 text-[13px] text-danger-600">{erro}</p>;
  if (!conjuntos) return <Esqueleto />;

  const atual = conjuntos[escolhida] || null;

  return (
    <div className="flex w-full flex-col gap-5 p-4 md:p-6">
      <div className={`${CARTAO} flex flex-wrap items-center justify-between gap-4 p-5`}>
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600"><PackageCheck size={22} strokeWidth={1.8} /></span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Reforma Tributária · IBS e CBS</p>
            <h1 className="text-[20px] font-semibold text-ink-900">Revisa Nota</h1>
            <p className="mt-0.5 text-[12.5px] text-ink-400">
              {atual ? `${atual.empresa}${atual.atualizadoEm ? ` · atualizado em ${dataHora(atual.atualizadoEm)}` : ""}` : "Classificação dos produtos e perfil dos compradores, definidos pelo escritório."}
            </p>
          </div>
        </div>
        <a href={PORTAL_REVISA_NOTA} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600">
          Pedir cadastro ou alteração <ArrowUpRight size={14} />
        </a>
      </div>

      {!atual ? (
        <div className={`${CARTAO} p-6`}>
          <p className="text-[13px] text-ink-500">Ainda não chegaram dados do Revisa Nota para {grupo ? "este grupo" : "esta empresa"}. O escritório envia assim que a classificação estiver pronta.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-surface-muted p-1 text-[13px]">
              <button type="button" onClick={() => setAba("produtos")} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-medium transition-colors ${aba === "produtos" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}><PackageCheck size={14} /> Produtos</button>
              <button type="button" onClick={() => setAba("clientes")} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-medium transition-colors ${aba === "clientes" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}><Users size={14} /> Clientes</button>
            </div>
            {conjuntos.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {conjuntos.map((c, i) => (
                  <button key={c.empresa} type="button" onClick={() => setEscolhida(i)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${i === escolhida ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{c.empresa}</button>
                ))}
              </div>
            )}
          </div>
          {aba === "produtos" ? (
            atual.produtos ? <Produtos lista={atual.produtos} /> : <p className="text-[13px] text-ink-400">A lista de produtos ainda não foi enviada.</p>
          ) : atual.clientes ? <Clientes lista={atual.clientes} /> : <p className="text-[13px] text-ink-400">A lista de clientes ainda não foi enviada.</p>}
          <p className="text-[11.5px] text-ink-400">Os percentuais usam o valor vendido no período. A classificação é decidida e mantida pelo escritório; produtos “em dúvida” aguardam a conferência do NCM e do cadastro.</p>
        </>
      )}
    </div>
  );
}
