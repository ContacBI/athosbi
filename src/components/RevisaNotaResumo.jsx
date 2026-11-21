import { Fragment, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { inteiro, moneyFull } from "../lib/fmtNotas.js";

// Resumo de produtos (aba do Revisa Nota): de todas as notas do ano, o que cada produto teve de vendas e compras (quantidade, valor, preço médio, quem comprou/vendeu…). Os números vêm
// somados do app do escritório (tipo "resumos"). Mês e estabelecimento aqui são lidos das somas por mês e por UF que vêm em cada grupo; notas, clientes e preço médio por mês ficam só no ano todo.
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const num = (v, d = 2) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d }));
const pctDe = (v, t) => (t ? `${((v / t) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");
const dataBr = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const docFmt = (d) => {
  const x = String(d || "");
  if (x.includes("*")) return x;
  return x.length === 14 ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}` : x || "—";
};
const OPERACOES = [["ambas", "Vendas e compras"], ["venda", "Só vendas"], ["compra", "Só compras"], ["todas", "Todas as operações"]];

// O grupo (venda, compra…) do produto sob o filtro de mês ou de estabelecimento: quantidade e valor do recorte; notas e clientes só existem no ano todo.
function grupoFiltrado(g, mes, uf) {
  if (!g) return null;
  const recorte = mes ? g.porMes?.[mes] : uf ? g.porUf?.[uf] : null;
  if (!mes && !uf) return g;
  if (!recorte || !(recorte.valor || recorte.qtd)) return null;
  return { ...g, qtd: recorte.qtd, valor: recorte.valor, precoMedio: recorte.qtd ? recorte.valor / recorte.qtd : null, notas: null, contrapartes: null, recortado: true };
}

function Ficha({ rotulo, children }) {
  return (
    <span className="block">
      <small className="block text-[11px] uppercase tracking-wide text-ink-400">{rotulo}</small>
      <b className="text-[13px] font-semibold text-ink-900">{children}</b>
    </span>
  );
}

function Bloco({ titulo, g, rotuloContra }) {
  const meses = Object.entries(g.porMes || {});
  const maxV = Math.max(1, ...meses.map(([, m]) => m.valor));
  return (
    <div className="rounded-xl border border-line bg-surface-page p-4">
      <h4 className="mb-3 text-[13px] font-semibold text-ink-900">{titulo}</h4>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
            <Ficha rotulo="Quantidade">{num(g.qtd)}</Ficha>
            <Ficha rotulo="Valor">{moneyFull(g.valor)}</Ficha>
            <Ficha rotulo="Preço médio">{moneyFull(g.precoMedio)}</Ficha>
            <Ficha rotulo="Menor · maior preço">{moneyFull(g.precoMin)} · {moneyFull(g.precoMax)}</Ficha>
            <Ficha rotulo="Notas · itens">{g.notas} · {g.itens}</Ficha>
            <Ficha rotulo="Primeira · última">{dataBr(g.primeira)} · {dataBr(g.ultima)}</Ficha>
          </div>
          <h5 className="mb-1.5 mt-4 text-[12px] font-semibold text-ink-700">{rotuloContra} ({g.contrapartes}){g.contrapartes > (g.top || []).length ? ` — os ${(g.top || []).length} maiores` : ""}</h5>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-[12px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-ink-400">
                <tr><th className="py-1 pr-2 font-medium">{rotuloContra.replace(/s$/, "")}</th><th className="px-2 font-medium">CNPJ</th><th className="px-2 font-medium">UF</th><th className="px-2 text-right font-medium">Qtd.</th><th className="px-2 text-right font-medium">Valor</th><th className="px-2 text-right font-medium">%</th><th className="pl-2 text-right font-medium">Notas</th></tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {(g.top || []).map((c) => (
                  <tr key={`${c.doc}${c.nome}`}>
                    <td className="max-w-[220px] truncate py-1 pr-2 text-ink-900" title={c.nome}>{c.nome || "—"}</td>
                    <td className="whitespace-nowrap px-2 tabular-nums text-ink-600">{docFmt(c.doc)}</td>
                    <td className="px-2 text-ink-600">{c.uf || "—"}</td>
                    <td className="px-2 text-right tabular-nums">{num(c.qtd)}</td>
                    <td className="px-2 text-right font-medium tabular-nums text-ink-900">{moneyFull(c.valor)}</td>
                    <td className="px-2 text-right tabular-nums text-ink-600">{pctDe(c.valor, g.valor)}</td>
                    <td className="pl-2 text-right tabular-nums">{c.notas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h5 className="mb-1.5 text-[12px] font-semibold text-ink-700">Mês a mês</h5>
          <div className="flex items-end gap-2">
            {meses.map(([m, x]) => (
              <div key={m} className="flex flex-col items-center gap-0.5" title={`${num(x.qtd)} un. · ${moneyFull(x.valor)}`}>
                <span className="w-5 rounded-t bg-accent-500/70" style={{ height: `${Math.max(4, (x.valor / maxV) * 56)}px` }} />
                <small className="text-[10.5px] text-ink-400">{MESES[Number(m.slice(5, 7)) - 1] || m}</small>
                <b className="text-[11px] tabular-nums text-ink-700">{num(x.qtd, 0)}</b>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <h5 className="mb-1 text-[12px] font-semibold text-ink-700">Por estabelecimento (emitente)</h5>
              {Object.entries(g.porUf || {}).map(([u, x]) => <p key={u} className="text-[12px] text-ink-600"><b className="text-ink-900">{u}</b>: {num(x.qtd)} un. · {moneyFull(x.valor)}</p>)}
            </div>
            <div>
              <h5 className="mb-1 text-[12px] font-semibold text-ink-700">Por CFOP</h5>
              {Object.entries(g.porCfop || {}).map(([cf, x]) => <p key={cf} className="text-[12px] text-ink-600"><b className="text-ink-900">{cf}</b> {x.rotulo}: {num(x.qtd)} un. · {moneyFull(x.valor)}</p>)}
            </div>
            <div>
              <h5 className="mb-1 text-[12px] font-semibold text-ink-700">cClassTrib nos itens</h5>
              {Object.entries(g.cclass || {}).map(([k, n]) => <p key={k} className="text-[12px] text-ink-600"><b className="text-ink-900">{k}</b>: {n} item(ns)</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cartao({ valor, titulo, sub, tom }) {
  return (
    <div className="rounded-xl border border-line bg-surface-card px-4 py-3">
      <p className={`text-[22px] font-bold leading-none tabular-nums ${tom === "ok" ? "text-emerald-500" : "text-ink-900"}`}>{valor}</p>
      <p className="mt-1.5 text-[12.5px] font-medium text-ink-700">{titulo}</p>
      {sub && <p className="mt-0.5 text-[11.5px] text-ink-400">{sub}</p>}
    </div>
  );
}

export default function ResumoProdutos({ resumos, empresa }) {
  const [mes, setMes] = useState("");
  const [uf, setUf] = useState("");
  const [op, setOp] = useState("ambas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [ordem, setOrdem] = useState({ campo: "venda.valor", dir: -1 });

  const produtos = useMemo(
    () => (resumos?.produtos || []).map((p) => ({ ...p, vis: Object.fromEntries(Object.entries(p.grupos || {}).map(([k, g]) => [k, grupoFiltrado(g, mes, uf)]).filter(([, g]) => g)) })),
    [resumos, mes, uf],
  );
  const get = (p, caminho) => {
    const [g, c] = caminho.split(".");
    return p.vis[g]?.[c] ?? null;
  };
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = produtos.filter((p) => {
      if (op === "venda" && !p.vis.venda) return false;
      if (op === "compra" && !p.vis.compra) return false;
      if (op === "ambas" && !p.vis.venda && !p.vis.compra) return false;
      if (op === "todas" && !Object.keys(p.vis).length) return false;
      return !q || [p.cProd, p.descricao, p.ncm].some((v) => String(v).toLowerCase().includes(q));
    });
    const { campo, dir } = ordem;
    return [...lista].sort((a, b) => {
      if (campo === "descricao") return String(a.descricao).localeCompare(String(b.descricao), "pt-BR") * dir;
      return ((get(a, campo) ?? -Infinity) - (get(b, campo) ?? -Infinity)) * dir || 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, busca, op, ordem]);

  if (!resumos) return <p className="text-[13px] text-ink-400">O resumo de produtos ainda não foi enviado pelo escritório.</p>;

  const filtrado = Boolean(mes || uf);
  const soma = (grupo) => produtos.reduce((acc, p) => (p.vis[grupo] ? { qtd: acc.qtd + p.vis[grupo].qtd, valor: acc.valor + p.vis[grupo].valor, n: acc.n + 1 } : acc), { qtd: 0, valor: 0, n: 0 });
  const t = resumos.totais || {};
  const sv = soma("venda");
  const sc = soma("compra");
  const un = (g, notas) => `${num(g.qtd, 0)} un.${notas != null ? ` em ${notas} nota(s)` : ""}`;
  const lider = (grupo) => {
    const p = [...produtos].filter((x) => x.vis[grupo]).sort((a, b) => b.vis[grupo].valor - a.vis[grupo].valor)[0];
    return p ? { titulo: `Produto líder: ${p.cProd}`, valor: moneyFull(p.vis[grupo].valor), sub: p.descricao } : null;
  };
  const maior = (g, rot) => (g?.top?.[0] ? { titulo: `${rot}: ${g.top[0].nome || "sem nome"}`, valor: pctDe(g.top[0].valor, g.valor), sub: `${moneyFull(g.top[0].valor)} do total` } : null);
  const outras = (k) => produtos.reduce((s, p) => s + (p.vis[k]?.valor || 0), 0);
  const cartoesVenda = [
    { titulo: "vendido", valor: moneyFull(sv.valor), sub: un(sv, filtrado ? null : t.venda?.notas), tom: "ok" },
    { titulo: "produtos vendidos", valor: sv.n, sub: filtrado ? null : `${t.venda?.contrapartes || 0} cliente(s) diferentes` },
    filtrado ? null : maior(t.venda, "Maior cliente"),
    lider("venda"),
  ];
  const cartoesCompra = [
    { titulo: "comprado", valor: moneyFull(sc.valor), sub: un(sc, filtrado ? null : t.compra?.notas) },
    { titulo: "produtos comprados", valor: sc.n, sub: filtrado ? null : `${t.compra?.contrapartes || 0} fornecedor(es) diferentes` },
    filtrado ? null : maior(t.compra, "Maior fornecedor"),
    lider("compra"),
  ];
  const cartoes =
    op === "venda" ? cartoesVenda
    : op === "compra" ? cartoesCompra
    : op === "todas" ? [
        { titulo: "vendido", valor: moneyFull(sv.valor), sub: un(sv), tom: "ok" },
        { titulo: "comprado", valor: moneyFull(sc.valor), sub: un(sc) },
        { titulo: "devoluções", valor: moneyFull(outras("devolucao")) },
        { titulo: "transferências", valor: moneyFull(outras("transferencia")) },
        { titulo: "outras operações (remessas, consignação…)", valor: moneyFull(outras("outras")) },
        { titulo: "produtos com movimento", valor: produtos.filter((p) => Object.keys(p.vis).length).length, sub: filtrado ? null : `${resumos.notas} nota(s) no período` },
      ]
    : [
        { titulo: "vendido", valor: moneyFull(sv.valor), sub: `${un(sv, filtrado ? null : t.venda?.notas)}${filtrado ? "" : ` · ${t.venda?.contrapartes || 0} cliente(s)`}`, tom: "ok" },
        { titulo: "comprado", valor: moneyFull(sc.valor), sub: `${un(sc, filtrado ? null : t.compra?.notas)}${filtrado ? "" : ` · ${t.compra?.contrapartes || 0} fornecedor(es)`}` },
        { titulo: "produtos com venda ou compra", valor: produtos.filter((p) => p.vis.venda || p.vis.compra).length, sub: `${sv.n} vendidos · ${sc.n} comprados` },
      ];

  const mostrarVenda = op !== "compra";
  const mostrarCompra = op !== "venda";
  const maxVenda = Math.max(1, ...visiveis.map((p) => p.vis.venda?.valor || 0));
  const maxCompra = Math.max(1, ...visiveis.map((p) => p.vis.compra?.valor || 0));
  const ordenar = (campo) => setOrdem((o) => (o.campo === campo ? { campo, dir: -o.dir } : { campo, dir: -1 }));
  const seta = (campo) => (ordem.campo === campo ? (ordem.dir < 0 ? " ▼" : " ▲") : "");
  const TH = ({ campo, children, direita = true }) => (
    <th className={`cursor-pointer whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400 hover:text-ink-700 ${direita ? "text-right" : "text-left"}`} onClick={() => ordenar(campo)} title="Ordenar">{children}{seta(campo)}</th>
  );
  const grupoCab = (rot, cols, cor) => <th colSpan={cols} className={`border-l border-line px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider ${cor}`}>{rot}</th>;
  const cols = (mostrarVenda ? 5 : 0) + (mostrarCompra ? 5 : 0) + (op === "todas" ? 3 : 0) + 1;
  const mesesDoAno = (resumos.meses || []).map((m) => [m, MESES[Number(m.slice(5, 7)) - 1] || m]);
  const seletor = "rounded-lg border border-line bg-surface-card px-2.5 py-2 text-[12.5px] text-ink-800 outline-none focus:border-accent-500 disabled:opacity-50";

  return (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{empresa || resumos.empresa || ""}</p>
        <h2 className="mt-1 text-[30px] font-bold leading-tight text-ink-900">Resumo de <em className="font-serif font-semibold italic text-accent-500">produtos</em>.</h2>
        <p className="mt-2 text-[12px] text-ink-500">Notas de {resumos.ano}{mesesDoAno.length ? ` · ${mesesDoAno[0][1]} a ${mesesDoAno[mesesDoAno.length - 1][1]}` : ""}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={seletor} value={mes} onChange={(e) => { setMes(e.target.value); if (e.target.value) setUf(""); }} title="Mês">
          <option value="">Ano todo</option>
          {mesesDoAno.map(([m, rot]) => <option key={m} value={m}>{rot}</option>)}
        </select>
        <select className={seletor} value={uf} disabled={Boolean(mes)} onChange={(e) => setUf(e.target.value)} title={mes ? "Para ver por estabelecimento, volte para Ano todo" : "Estabelecimento (UF do emitente)"}>
          <option value="">Todos os estabelecimentos</option>
          {(resumos.ufs || []).map((u) => <option key={u} value={u}>Emitente {u}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-line bg-surface-card" role="group" aria-label="Operações">
          {OPERACOES.map(([k, rot]) => (
            <button key={k} type="button" onClick={() => setOp(k)} className={`px-3 py-2 text-[12.5px] font-medium transition-colors ${op === k ? "bg-surface-muted text-ink-900" : "text-ink-500 hover:text-ink-900"}`}>{rot}</button>
          ))}
        </div>
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, código ou NCM…" className="w-full rounded-lg border border-line bg-surface-card py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
        </div>
      </div>
      {filtrado && <p className="text-[12px] text-ink-400">No recorte por {mes ? "mês" : "estabelecimento"} aparecem quantidade, valor e preço médio; notas, clientes e fornecedores só no ano todo.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.filter(Boolean).map((c) => <Cartao key={c.titulo} {...c} />)}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface-card">
        <div className="max-h-[680px] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[1100px] text-[13px]">
            <thead className="sticky top-0 z-[1] bg-surface-card shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th rowSpan={2} className="cursor-pointer px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400 hover:text-ink-700" onClick={() => ordenar("descricao")}>Produto{seta("descricao")}</th>
                {mostrarVenda && grupoCab("Vendas", 5, "text-emerald-600")}
                {mostrarCompra && grupoCab("Compras", 5, "text-sky-600")}
                {op === "todas" && grupoCab("Outras operações (valor)", 3, "text-ink-500")}
              </tr>
              <tr>
                {mostrarVenda && (<><TH campo="venda.qtd">Qtd.</TH><TH campo="venda.valor">Valor</TH><TH campo="venda.precoMedio">Preço médio</TH><TH campo="venda.notas">Notas</TH><TH campo="venda.contrapartes">Clientes</TH></>)}
                {mostrarCompra && (<><TH campo="compra.qtd">Qtd.</TH><TH campo="compra.valor">Valor</TH><TH campo="compra.precoMedio">Preço médio</TH><TH campo="compra.notas">Notas</TH><TH campo="compra.contrapartes">Fornec.</TH></>)}
                {op === "todas" && (<><TH campo="devolucao.valor">Devoluções</TH><TH campo="transferencia.valor">Transf.</TH><TH campo="outras.valor">Outras</TH></>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {visiveis.map((p) => {
                const v = p.vis.venda;
                const c = p.vis.compra;
                return (
                  <Fragment key={p.chave}>
                    <tr className="cursor-pointer transition-colors hover:bg-accent-50/40" onClick={() => setAberto(aberto === p.chave ? null : p.chave)}>
                      <td className="max-w-[340px] px-3 py-2"><b className="text-ink-900">{p.cProd}</b><small className="block truncate text-[11.5px] text-ink-400" title={p.descricao}>{p.descricao} · NCM {p.ncm || "—"}{p.un ? ` · ${p.un}` : ""}</small></td>
                      {mostrarVenda && (
                        <>
                          <td className="px-3 text-right tabular-nums">{v ? num(v.qtd) : "—"}</td>
                          <td className="px-3 text-right tabular-nums" style={v ? { background: `linear-gradient(to left, rgb(16 185 129 / 0.14) ${(v.valor / maxVenda) * 100}%, transparent 0)` } : undefined}>{v ? <b className="text-ink-900">{moneyFull(v.valor)}</b> : "—"}</td>
                          <td className="px-3 text-right tabular-nums">{v ? moneyFull(v.precoMedio) : "—"}</td>
                          <td className="px-3 text-right tabular-nums">{v?.notas ?? "—"}</td>
                          <td className="px-3 text-right tabular-nums">{v?.contrapartes ?? "—"}</td>
                        </>
                      )}
                      {mostrarCompra && (
                        <>
                          <td className="px-3 text-right tabular-nums">{c ? num(c.qtd) : "—"}</td>
                          <td className="px-3 text-right tabular-nums" style={c ? { background: `linear-gradient(to left, rgb(14 165 233 / 0.14) ${(c.valor / maxCompra) * 100}%, transparent 0)` } : undefined}>{c ? <b className="text-ink-900">{moneyFull(c.valor)}</b> : "—"}</td>
                          <td className="px-3 text-right tabular-nums">{c ? moneyFull(c.precoMedio) : "—"}</td>
                          <td className="px-3 text-right tabular-nums">{c?.notas ?? "—"}</td>
                          <td className="px-3 text-right tabular-nums">{c?.contrapartes ?? "—"}</td>
                        </>
                      )}
                      {op === "todas" && (
                        <>
                          <td className="px-3 text-right tabular-nums">{p.vis.devolucao ? moneyFull(p.vis.devolucao.valor) : "—"}</td>
                          <td className="px-3 text-right tabular-nums">{p.vis.transferencia ? moneyFull(p.vis.transferencia.valor) : "—"}</td>
                          <td className="px-3 text-right tabular-nums">{p.vis.outras ? moneyFull(p.vis.outras.valor) : "—"}</td>
                        </>
                      )}
                    </tr>
                    {aberto === p.chave && (
                      <tr className="bg-surface-page">
                        <td colSpan={cols} className="px-4 py-4">
                          <div className="flex flex-col gap-3">
                            {Object.entries(p.grupos).filter(([k]) => (op === "todas" ? true : op === "ambas" ? ["venda", "compra"].includes(k) : k === op)).map(([k, g]) => (
                              <Bloco key={k} titulo={resumos.grupos?.[k] || k} g={g} rotuloContra={k === "compra" ? "Fornecedores" : k === "venda" ? "Clientes" : "Contrapartes"} />
                            ))}
                            {filtrado && <p className="text-[11.5px] text-ink-400">O detalhe mostra o ano todo, sem o recorte de {mes ? "mês" : "estabelecimento"}.</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!visiveis.length && <tr><td colSpan={cols} className="px-4 py-10 text-center text-ink-400">Nenhum produto neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[12px] text-ink-400">{inteiro(visiveis.length)} produto{visiveis.length === 1 ? "" : "s"} · gerado em {resumos.geradoEm ? new Date(resumos.geradoEm).toLocaleDateString("pt-BR") : "—"}</p>
    </>
  );
}
