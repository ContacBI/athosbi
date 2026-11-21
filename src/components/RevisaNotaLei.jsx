import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { moneyFull } from "../lib/fmtNotas.js";
import { buscarItens, enquadrar, montarIndice, parecenca } from "../lib/lc214.js";
import { ncmFormatado, rotuloDaDecisao, situacaoDoProduto } from "../lib/revisaNota.js";

// Consulta da LC 214 (aba do Revisa Nota): os itens dos anexos da lei, com busca por NCM ou palavras, o texto da lei e os produtos da empresa cujo NCM casa com o item. A base vem do app do
// escritório (tipo "lei"). Aqui só se consulta: marcar produtos como um item continua sendo decisão do escritório (peça a alteração no produto).
const URL_LEI = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm";
const LIMITE = 80;
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// destaca no texto as palavras da busca (sem acento, parte da palavra vale)
function Destaque({ texto, palavras }) {
  if (!palavras.length) return texto;
  const norm = semAcento(texto);
  const marcas = new Array(texto.length).fill(false);
  for (const p of palavras) {
    let i = norm.indexOf(p);
    while (i >= 0) {
      for (let k = i; k < i + p.length; k += 1) marcas[k] = true;
      i = norm.indexOf(p, i + p.length);
    }
  }
  const partes = [];
  let ini = 0;
  for (let i = 1; i <= texto.length; i += 1) {
    if (i === texto.length || marcas[i] !== marcas[ini]) {
      const trecho = texto.slice(ini, i);
      partes.push(marcas[ini] ? <mark key={ini} className="rounded bg-accent-500/25 px-0.5 text-ink-900">{trecho}</mark> : trecho);
      ini = i;
    }
  }
  return partes;
}

const NIVEL = { alta: "bg-emerald-500/10 text-emerald-600", "média": "bg-amber-500/15 text-amber-600", baixa: "bg-surface-muted text-ink-500", nenhuma: "bg-surface-muted text-ink-400" };

export default function ConsultaLei({ lei, produtos, empresa }) {
  const indice = useMemo(() => (lei?.anexos?.length ? montarIndice(lei) : null), [lei]);
  const [q, setQ] = useState("");
  const [anexo, setAnexo] = useState("");
  const [trat, setTrat] = useState("");
  const [soEmpresa, setSoEmpresa] = useState(false);
  const [sel, setSel] = useState(null);
  const [mostrar, setMostrar] = useState(LIMITE);
  const [bp, setBp] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);

  const ncmsEmpresa = useMemo(() => new Set((produtos || []).map((p) => p.ncm).filter(Boolean)), [produtos]);
  const tratamentos = useMemo(() => (indice ? [...new Set(Object.values(indice.tratamentos).map((t) => t.rotulo))] : []), [indice]);
  const palavras = useMemo(() => (/^[\d.\s-]*$/.test(q) ? [] : semAcento(q).split(/\s+/).filter((t) => t.length >= 2)), [q]);
  const itens = useMemo(() => buscarItens(indice, q, { anexo, tratamento: trat, ncms: soEmpresa ? ncmsEmpresa : null }), [indice, q, anexo, trat, soEmpresa, ncmsEmpresa]);

  const atual = indice?.itens.find((i) => `${i.anexo}|${i.item}` === sel) || null;
  const complementos = atual ? indice.complementos[atual.anexo] || [] : [];

  // produtos da empresa que casam com o item aberto (pelo NCM do cadastro), do mais parecido com a descrição do item para o menos (empate: maior valor vendido)
  const produtosDoItem = useMemo(() => {
    if (!atual || !produtos?.length) return [];
    return produtos
      .filter((p) => enquadrar(indice, p.ncm).some((e) => e.anexo === atual.anexo && e.item === atual.item))
      .map((p) => {
        const par = parecenca(indice, p.descricao, atual.descricao);
        return { ...p, par, nivel: par.nome && par.score >= 0.6 ? "alta" : par.nome ? "média" : par.score > 0 ? "baixa" : "nenhuma" };
      })
      .sort((a, b) => b.par.score - a.par.score || (Number(b.valor) || 0) - (Number(a.valor) || 0));
  }, [atual, produtos, indice]);
  const visiveisProd = useMemo(() => {
    const ps = semAcento(bp).split(/\s+/).filter((t) => t.length >= 2);
    return produtosDoItem.filter((p) => (!soPendentes || situacaoDoProduto(p) === "pendente") && ps.every((w) => semAcento(`${p.descricao} ${p.codigo}`).includes(w)));
  }, [produtosDoItem, bp, soPendentes]);

  if (!lei) return <p className="text-[13px] text-ink-400">A base da LC 214 ainda não foi enviada pelo escritório.</p>;
  if (!indice) return <p className="text-[13px] text-ink-400">A base da LC 214 veio vazia.</p>;

  const seletor = "rounded-lg border border-line bg-surface-card px-2.5 py-2 text-[12.5px] text-ink-800 outline-none focus:border-accent-500";
  return (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">Base própria · versão {indice.versao}</p>
        <h2 className="mt-1 text-[30px] font-bold leading-tight text-ink-900">Consulta da <em className="font-serif font-semibold italic text-accent-500">LC 214</em>.</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[280px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setMostrar(LIMITE); }} placeholder="NCM (ex.: 9018.39.29) ou palavras (ex.: cateter, prótese, sonda)…" className="w-full rounded-lg border border-line bg-surface-card py-2.5 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
        </div>
        <select className={seletor} value={anexo} onChange={(e) => { setAnexo(e.target.value); setMostrar(LIMITE); }}>
          <option value="">Todos os anexos</option>
          {indice.anexos.map((a) => <option key={a} value={a}>Anexo {a} · {indice.tratamentos[a].nome.toLowerCase().slice(0, 40)}</option>)}
        </select>
        <select className={seletor} value={trat} onChange={(e) => { setTrat(e.target.value); setMostrar(LIMITE); }}>
          <option value="">Qualquer tratamento</option>
          {tratamentos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {ncmsEmpresa.size > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
            <input type="checkbox" checked={soEmpresa} onChange={(e) => { setSoEmpresa(e.target.checked); setMostrar(LIMITE); }} />
            Só NCMs que a empresa vende
          </label>
        )}
      </div>
      <p className="text-[12px] text-ink-500">{itens.length} item(ns) encontrado(s).</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.85fr)_1.4fr]">
        <div className="flex max-h-[720px] flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
          {itens.slice(0, mostrar).map((i) => {
            const k = `${i.anexo}|${i.item}`;
            return (
              <button key={k} type="button" onClick={() => { setSel(k); setBp(""); }} className={`rounded-xl border p-3 text-left transition-colors ${k === sel ? "border-accent-500/60 bg-accent-500/5" : "border-line bg-surface-card hover:bg-surface-muted/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[13px] text-ink-900">Anexo {i.anexo} · item {i.item}</b>
                  <span className="whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">{i.tratamento?.rotulo}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-[12.5px] text-ink-700"><Destaque texto={i.descricao} palavras={palavras} /></p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {i.ncmLei.slice(0, 4).map((n) => <em key={n} className="rounded bg-surface-muted px-1.5 text-[11px] not-italic tabular-nums text-ink-600">{n}</em>)}
                  {i.ncmLei.length > 4 && <em className="rounded bg-surface-muted px-1.5 text-[11px] not-italic text-ink-400">+{i.ncmLei.length - 4}</em>}
                </div>
              </button>
            );
          })}
          {itens.length > mostrar && <button type="button" onClick={() => setMostrar(mostrar + LIMITE)} className="rounded-lg border border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">Mostrar mais ({itens.length - mostrar} restantes)</button>}
          {!itens.length && <p className="py-10 text-center text-[13px] text-ink-400">Nenhum item com essa busca.</p>}
        </div>

        <div className="rounded-xl border border-line bg-surface-card">
          {!atual ? (
            <p className="px-6 py-16 text-center text-[13px] text-ink-400">Escolha um item na lista para ver o detalhe e os produtos da empresa.</p>
          ) : (
            <div>
              <div className="flex items-center gap-3 border-b border-line bg-emerald-500/5 px-5 py-4">
                <Check size={22} className="text-emerald-500" />
                <div>
                  <h3 className="text-[15px] font-semibold text-ink-900">Anexo {atual.anexo} · item {atual.item}</h3>
                  <p className="text-[12.5px] text-ink-600">{atual.tratamento?.rotulo} · {atual.tratamento?.nome}</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Descrição na lei</p>
                  <p className="mt-1 text-[13.5px] text-ink-900">{atual.descricao}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">NCM/SH na lei</p>
                  <div className="mt-1 flex flex-wrap gap-1">{atual.ncmLei.map((n, k) => <em key={n + k} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11.5px] not-italic tabular-nums text-ink-700">{n}</em>)}</div>
                </div>
                {complementos.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">Condições do Anexo {atual.anexo} (texto da lei)</p>
                    {complementos.map((c) => <p key={c.artigo} className="text-[12.5px] text-ink-800"><b>{c.artigo}:</b> {c.tratamento}. {c.condicao}</p>)}
                  </div>
                )}
                <a href={URL_LEI} target="_blank" rel="noreferrer" className="w-fit text-[12.5px] font-medium text-accent-600 hover:underline">Abrir a lei no Planalto (procure por "ANEXO {atual.anexo}", item {atual.item})</a>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Produtos da empresa que casam com este item</p>
                  {!produtos?.length ? (
                    <p className="mt-1 text-[12.5px] text-ink-500">A lista de produtos ainda não foi enviada.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-[12.5px] text-ink-500">{produtosDoItem.length} produto(s) de {empresa || "a empresa"} têm NCM que casa com este item. O NCM casa, mas a descrição do produto precisa ser a do item: filtre pelas palavras.</p>
                      {produtosDoItem.length > 0 && (
                        <>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <div className="relative min-w-[220px] flex-1">
                              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                              <input value={bp} onChange={(e) => setBp(e.target.value)} placeholder="Filtrar os produtos por palavras (ex.: cateter balão)" className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[12.5px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
                            </div>
                            <label className="flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />Só pendentes</label>
                          </div>
                          <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-line scrollbar-thin">
                            <table className="w-full min-w-[640px] text-[12.5px]">
                              <thead className="sticky top-0 bg-surface-card text-left text-[10.5px] uppercase tracking-wide text-ink-400 shadow-[0_1px_0_var(--color-line)]">
                                <tr><th className="px-3 py-2 font-medium">Código</th><th className="px-3 font-medium">Descrição</th><th className="px-3 font-medium">NCM</th><th className="px-3 font-medium">Parecido</th><th className="px-3 text-right font-medium">Valor</th><th className="px-3 font-medium">Decisão</th></tr>
                              </thead>
                              <tbody className="divide-y divide-line/60">
                                {visiveisProd.slice(0, 300).map((p) => (
                                  <tr key={`${p.emp}|${p.codigo}`}>
                                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-ink-900">{p.codigo}</td>
                                    <td className="max-w-[280px] truncate px-3 text-ink-800" title={p.descricao}>{p.descricao}</td>
                                    <td className="whitespace-nowrap px-3 tabular-nums text-ink-700">{ncmFormatado(p.ncm)}</td>
                                    <td className="px-3" title={p.par.palavras.length ? `Em comum: ${p.par.palavras.join(", ")}` : "Nenhuma palavra em comum"}><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${NIVEL[p.nivel]}`}>{p.nivel === "nenhuma" ? "—" : p.nivel}</span></td>
                                    <td className="whitespace-nowrap px-3 text-right tabular-nums">{moneyFull(p.valor)}</td>
                                    <td className="whitespace-nowrap px-3 text-ink-800">{rotuloDaDecisao(p)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {!visiveisProd.length && <p className="py-6 text-center text-ink-400">Nenhum produto com esse filtro.</p>}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
