import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Download, PackageCheck, Plus, Search, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { groupCompanies } from "../lib/groups.js";
import { inteiro, moneyFull, pct } from "../lib/fmtNotas.js";
import {
  PORTAL_REVISA_NOTA, alvoDoProduto, codigosPossiveis, fetchPedidos, fetchRevisaNota, filtrarClientes, filtrarProdutos, ncmFormatado, opcoesDoProduto, pedidoAberto, pedidosDoAlvo, perfilDoCliente,
  resumoDeClientes, resumoDeProdutos, rotuloDaDecisao, rotuloDaReducao, situacaoDoProduto,
} from "../lib/revisaNota.js";
import { CartaoDePedido, FormNovoProduto, FormPerfil, JanelaDeAlteracao } from "../components/RevisaNotaPedidos.jsx";

// Revisa Nota (Ferramentas, só Micromedical por enquanto): abre como o B.I. — as abas do Revisa Nota em cima (Produtos, Resumo de produtos, Cadastro, Clientes e Consulta LC 214). A
// classificação é decidida pelo escritório; o cliente pede cadastro, mudança de classificação e perfil de comprador aqui mesmo e conversa com o escritório em cada pedido.
const LIMITE = 100;

const dataHora = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const dia = (iso) => {
  const [a, m, d] = String(iso || "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};
const abreviado = (valor) => {
  const v = Number(valor) || 0;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return moneyFull(v);
};

function Esqueleto() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-4 p-4 md:p-6">
      <div className="h-10 rounded-xl bg-surface-muted" />
      <div className="h-36 rounded-2xl bg-surface-muted" />
      <div className="h-80 rounded-2xl bg-surface-muted" />
    </div>
  );
}

const TONS = {
  verde: "bg-emerald-500/10 text-emerald-600",
  ambar: "bg-amber-500/15 text-amber-600",
  cinza: "bg-surface-muted text-ink-500",
  azul: "bg-sky-500/10 text-sky-600",
  laranja: "bg-accent-500/10 text-accent-700",
  neutro: "bg-surface-muted text-ink-600",
};
function Selo({ children, tom = "neutro" }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONS[tom]}`}>{children}</span>;
}

const TOM_SITUACAO = { decidido: "verde", duvida: "ambar", pendente: "cinza" };
const NOME_SITUACAO = { decidido: "Classificado", duvida: "Em dúvida", pendente: "Pendente" };
const TOM_PERFIL = { privado: "azul", publico: "laranja", sus_cebas: "verde", verificar: "ambar", sem: "cinza" };
const NOME_PERFIL = { privado: "Privado", publico: "Público", sus_cebas: "SUS / CEBAS", verificar: "A verificar", sem: "Sem perfil" };
const TOM_CONDICIONAL = { Sim: "ambar", "Não": "cinza", Depende: "laranja" };
const TEXTO_CONDICIONAL = {
  Sim: "O anexo tem mais de um código na tabela oficial: o código da nota pode mudar conforme uma condição, em geral quem compra (órgão público, SUS/CEBAS).",
  "Não": "Um código só para qualquer comprador.",
  Depende: "O NCM cai em anexos diferentes: o código depende de qual item da lei descreve o produto.",
  "—": "O NCM não está em nenhum anexo da LC 214 (em regra, tributação integral).",
};

// Resumo da aba: o total e uma barra com a divisão por valor; cada pedaço é um botão que filtra a lista (clique de novo para limpar).
function ResumoEmFaixas({ titulo, total, itens, ativo, onEscolher }) {
  const soma = itens.reduce((s, i) => s + i.valor, 0) || 1;
  return (
    <section className="rounded-2xl border border-line bg-surface-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-ink-500">{titulo}</p>
          <p className="mt-0.5 flex items-baseline gap-2.5">
            <span className="text-[30px] font-bold leading-none tabular-nums text-ink-900">{inteiro(total.qtd)}</span>
            <span className="text-[13px] text-ink-500">{abreviado(total.valor)} no período</span>
          </p>
        </div>
        {ativo !== "todos" && <button type="button" onClick={() => onEscolher("todos")} className="text-[12px] font-medium text-accent-600 hover:underline">Limpar filtro</button>}
      </div>
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
        {itens.map((i) => i.valor > 0 && <span key={i.id} className={`${i.cor} transition-opacity ${ativo !== "todos" && ativo !== i.id ? "opacity-25" : ""}`} style={{ width: `${(i.valor / soma) * 100}%` }} />)}
      </div>
      <div className={`mt-4 grid gap-2.5 ${itens.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {itens.map((i) => {
          const sel = ativo === i.id;
          return (
            <button key={i.id} type="button" onClick={() => onEscolher(sel ? "todos" : i.id)} aria-pressed={sel} className={`rounded-xl border px-4 py-3 text-left transition-colors ${sel ? "border-accent-500/60 bg-accent-500/5" : "border-line hover:bg-surface-muted/60"}`}>
              <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-600"><span className={`h-2.5 w-2.5 rounded-full ${i.cor}`} />{i.nome}</p>
              <p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-ink-900">{inteiro(i.qtd)}</p>
              <p className="mt-1 text-[12px] text-ink-400">{pct(i.valor, total.valor)} do valor · {abreviado(i.valor)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Cabecalho({ colunas }) {
  return (
    <thead className="sticky top-0 z-[1] bg-surface-card text-ink-400 shadow-[0_1px_0_var(--color-line)]">
      <tr>
        {colunas.map(([nome, direita]) => (
          <th key={nome} className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide ${direita ? "text-right" : "text-left"}`}>{nome}</th>
        ))}
      </tr>
    </thead>
  );
}

function Secao({ titulo, children, direita }) {
  return (
    <section className="rounded-xl border border-line bg-surface-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{titulo}</h3>
        {direita}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Dado({ rotulo, children }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-400">{rotulo}</p>
      <p className="mt-0.5 text-[13.5px] text-ink-900">{children || "—"}</p>
    </div>
  );
}

function Janela({ aoFechar, topo, children }) {
  useEffect(() => {
    const fecha = (event) => event.key === "Escape" && aoFechar();
    window.addEventListener("keydown", fecha);
    return () => window.removeEventListener("keydown", fecha);
  }, [aoFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]" onClick={aoFechar}>
      <div className="flex h-full max-h-[860px] w-full max-w-5xl flex-col rounded-2xl bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">{topo}</div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-surface-page p-5">{children}</div>
      </div>
    </div>
  );
}

// Detalhe de um produto: a decisão do escritório, os pedidos/conversa dele, a sugestão completa da lei, os outros códigos que poderiam entrar e o que significa o "Condicional".
function DetalheProduto({ produto, lista, companyId, pedidos, recarregarPedidos, onClose }) {
  const lei = lista.lei || {};
  const d = produto.decisao;
  const sit = situacaoDoProduto(produto);
  const opcoes = opcoesDoProduto(produto, lei);
  const codigos = codigosPossiveis(produto, lei);
  const decididoK = d?.status === "decidido" && d.anexo ? `${d.anexo}|${d.item}` : "";
  const estab = lista.estabs?.[produto.emp];
  const meusPedidos = pedidosDoAlvo(pedidos, alvoDoProduto(produto), "alteracao");
  const temAberto = meusPedidos.some(pedidoAberto);
  const [pedindo, setPedindo] = useState(false);

  return (
    <>
      <Janela
        aoFechar={onClose}
        topo={
          <>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Produto · {produto.codigo}{estab ? ` · ${estab}` : ""}</span>
            <h2 className="mt-0.5 text-[18px] font-semibold text-ink-900">{produto.descricao}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-400">NCM {ncmFormatado(produto.ncm)} · {moneyFull(produto.valor)} em {inteiro(produto.notas)} nota{produto.notas === 1 ? "" : "s"}{produto.ultima ? ` · última venda ${dia(produto.ultima)}` : ""}</p>
          </>
        }
      >
        <Secao titulo="Decisão do escritório" direita={<Selo tom={TOM_SITUACAO[sit]}>{NOME_SITUACAO[sit]}</Selo>}>
          {d ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Dado rotulo="Classificação">{d.anexo ? `Anexo ${d.anexo} · item ${d.item}` : d.status === "duvida" ? "Em dúvida" : "Tributação integral"}</Dado>
              <Dado rotulo="Tratamento">{d.tratamento}</Dado>
              <Dado rotulo="Código na nota (cClassTrib)">{d.cClassTrib ? `${d.cClassTrib}${d.cst ? ` · CST ${d.cst}` : ""}` : ""}</Dado>
              <Dado rotulo="Decidido em">{d.decididoEm ? dia(d.decididoEm) : ""}</Dado>
              {d.itemTexto && <div className="col-span-2 md:col-span-4"><Dado rotulo="Item da lei">{d.itemTexto}</Dado></div>}
              {d.ncmCorreto && <Dado rotulo="NCM corrigido pelo escritório">{ncmFormatado(d.ncmCorreto)}</Dado>}
              {d.observacao && <div className="col-span-2 md:col-span-4"><Dado rotulo="Observação do escritório">{d.observacao}</Dado></div>}
            </div>
          ) : (
            <p className="text-[13px] text-ink-500">Ainda sem decisão do escritório para este produto.</p>
          )}
        </Secao>

        <Secao
          titulo="Pedidos de mudança e conversa"
          direita={!temAberto ? <button type="button" onClick={() => setPedindo(true)} className="rounded-lg bg-accent-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-accent-600">Pedir alteração</button> : null}
        >
          <div className="flex flex-col gap-3">
            {meusPedidos.map((p, i) => <CartaoDePedido key={p.id} pedido={p} aberto={i === 0 && pedidoAberto(p)} mostrarAlvo={false} onMudou={recarregarPedidos} />)}
            {!meusPedidos.length && <p className="text-[13px] text-ink-500">Nenhum pedido para este produto. Se a classificação não estiver certa, peça a alteração e converse com o escritório por aqui.</p>}
          </div>
        </Secao>

        <Secao titulo={`Sugestão da lei (LC 214) · ${opcoes.length} ${opcoes.length === 1 ? "item possível" : "itens possíveis"}`}>
          {!opcoes.length ? (
            <p className="text-[13px] text-ink-500">O NCM {ncmFormatado(produto.ncm)} não aparece em nenhum anexo da LC 214. Em regra, é tributação integral — o escritório confere o NCM e o cadastro.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {opcoes.map((o) => {
                const sugerido = produto.sug?.k === o.k;
                return (
                  <div key={o.k} className={`rounded-lg border p-3 ${o.k === decididoK ? "border-emerald-500/50 bg-emerald-500/5" : "border-line"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink-900">Anexo {o.anexo} · item {o.item}</span>
                      {o.rotulo && <Selo tom="laranja">{o.reducao != null ? `${o.reducao === 100 ? "100% · alíq. zero" : `${o.reducao}%`}` : o.rotulo}</Selo>}
                      {sugerido && <Selo tom="azul">Sugerido{produto.sug?.c ? ` · confiança ${produto.sug.c}` : ""}</Selo>}
                      {o.k === decididoK && <Selo tom="verde">Decidido pelo escritório</Selo>}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">{o.descricao}</p>
                    {o.codigos?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {o.codigos.map((c) => (
                          <span key={c.cClassTrib} title={c.nome} className={`rounded-md border px-2 py-0.5 text-[11.5px] tabular-nums ${d?.cClassTrib === c.cClassTrib ? "border-emerald-500/60 text-emerald-600" : "border-line text-ink-600"}`}>{c.cClassTrib}<span className="ml-1 text-ink-400">{c.nome}</span></span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Secao>

        <Secao titulo="Códigos de cClassTrib que podem entrar">
          {codigos.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-ink-400"><th className="py-1.5 pr-4">Código</th><th className="py-1.5 pr-4">Descrição (tabela oficial)</th><th className="py-1.5">Anexo</th></tr></thead>
                <tbody>
                  {codigos.map((c) => (
                    <tr key={c.cClassTrib} className="border-t border-line">
                      <td className="whitespace-nowrap py-1.5 pr-4 font-medium tabular-nums text-ink-900">{c.cClassTrib}{d?.cClassTrib === c.cClassTrib && <Check size={13} className="ml-1.5 inline text-emerald-500" />}</td>
                      <td className="py-1.5 pr-4 text-ink-700">{c.nome}</td>
                      <td className="whitespace-nowrap py-1.5 text-ink-500">{c.anexos.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-ink-500">Fora dos anexos, o produto usa o código de tributação integral (000001).</p>
          )}
          {produto.cond && <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-[12.5px] text-ink-600"><b className="text-ink-800">Condicional: {produto.cond}.</b> {TEXTO_CONDICIONAL[produto.cond] || ""}</p>}
        </Secao>
      </Janela>
      {pedindo && <JanelaDeAlteracao produto={produto} opcoes={opcoes} lista={lista} companyId={companyId} onFechar={() => setPedindo(false)} onCriado={async () => { setPedindo(false); await recarregarPedidos(); }} />}
    </>
  );
}

function DetalheCliente({ cliente, companyId, pedidos, recarregarPedidos, onClose }) {
  const perf = perfilDoCliente(cliente);
  const meusPedidos = pedidosDoAlvo(pedidos, cliente.chave, "perfil");
  const temAberto = meusPedidos.some(pedidoAberto);
  const [pedindo, setPedindo] = useState(false);
  return (
    <Janela
      aoFechar={onClose}
      topo={
        <>
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Comprador</span>
          <h2 className="mt-0.5 text-[18px] font-semibold text-ink-900">{cliente.nome}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-400">{cliente.doc}{cliente.municipio ? ` · ${cliente.municipio}` : ""}{cliente.uf ? ` / ${cliente.uf}` : ""} · {moneyFull(cliente.valor)} em {inteiro(cliente.notas)} nota{cliente.notas === 1 ? "" : "s"}{cliente.ultima ? ` · última compra ${dia(cliente.ultima)}` : ""}</p>
        </>
      }
    >
      <Secao titulo="Perfil confirmado pelo escritório" direita={<Selo tom={TOM_PERFIL[perf] || "cinza"}>{NOME_PERFIL[perf] || perf}</Selo>}>
        {cliente.perfil ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Dado rotulo="Perfil">{NOME_PERFIL[perf]}</Dado>
            <Dado rotulo="Validade do CEBAS">{cliente.perfil.cebasValidade ? dia(cliente.perfil.cebasValidade) : ""}</Dado>
            <Dado rotulo="Confirmado em">{cliente.perfil.atualizadoEm ? dia(cliente.perfil.atualizadoEm) : ""}</Dado>
            {cliente.perfil.comprovante && <div className="col-span-2 md:col-span-4"><Dado rotulo="Comprovante">{cliente.perfil.comprovante}</Dado></div>}
            {cliente.perfil.observacao && <div className="col-span-2 md:col-span-4"><Dado rotulo="Observação do escritório">{cliente.perfil.observacao}</Dado></div>}
          </div>
        ) : (
          <p className="text-[13px] text-ink-500">O escritório ainda não confirmou o perfil deste comprador (privado, órgão público ou SUS com CEBAS). Isso define se pode ser aplicado o código do art. 144 II.</p>
        )}
      </Secao>
      <Secao
        titulo="Pedidos de perfil e conversa"
        direita={!temAberto && !pedindo ? <button type="button" onClick={() => setPedindo(true)} className="rounded-lg bg-accent-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-accent-600">Pedir perfil deste comprador</button> : null}
      >
        <div className="flex flex-col gap-3">
          {pedindo && <FormPerfil cliente={cliente} companyId={companyId} onCancelar={() => setPedindo(false)} onCriado={async () => { setPedindo(false); await recarregarPedidos(); }} />}
          {meusPedidos.map((p, i) => <CartaoDePedido key={p.id} pedido={p} aberto={i === 0 && pedidoAberto(p)} mostrarAlvo={false} onMudou={recarregarPedidos} />)}
          {!meusPedidos.length && !pedindo && <p className="text-[13px] text-ink-500">Nenhum pedido para este comprador. Se você sabe o perfil dele, envie o pedido e informe o comprovante.</p>}
        </div>
      </Secao>
    </Janela>
  );
}

// Itens possíveis do NCM agrupados por anexo, como no Revisa Nota: [anexo, [itens], [% distintos]].
function gruposDoProduto(produto, lei) {
  const mapa = new Map();
  for (const o of opcoesDoProduto(produto, lei)) {
    if (!mapa.has(o.anexo)) mapa.set(o.anexo, { itens: [], pcts: [] });
    const g = mapa.get(o.anexo);
    g.itens.push(String(o.item));
    const r = rotuloDaReducao(o.reducao, o.rotulo);
    if (r && !g.pcts.includes(r)) g.pcts.push(r);
  }
  return [...mapa.entries()].map(([anexo, g]) => [anexo, g.itens, g.pcts]);
}

const CONDICIONAL_FILTRO = [["todos", "Todos"], ["Sim", "Sim"], ["Não", "Não"], ["Depende", "Depende"]];

function Produtos({ lista, companyId, pedidos, recarregarPedidos, atualizadoEm }) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const [ncmSel, setNcmSel] = useState("");
  const [lcFiltro, setLcFiltro] = useState("todos");
  const [cond, setCond] = useState("todos");
  const [painel, setPainel] = useState(false);
  const [baixar, setBaixar] = useState(false);
  const [compacta, setCompacta] = useState(() => {
    try { return localStorage.getItem("athos-revisa-densidade") === "compacta"; } catch { return false; }
  });
  const [limite, setLimite] = useState(LIMITE);
  const [aberto, setAberto] = useState(null);
  const produtos = lista.produtos;
  const lei = useMemo(() => lista.lei || {}, [lista.lei]);
  const resumo = useMemo(() => resumoDeProdutos(produtos), [produtos]);
  const gruposPor = useMemo(() => new Map(produtos.map((p) => [`${p.emp}|${p.codigo}`, gruposDoProduto(p, lei)])), [produtos, lei]);
  const ncms = useMemo(() => {
    const m = {};
    produtos.forEach((p) => { m[p.ncm] = (m[p.ncm] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [produtos]);
  const emAnexo = useMemo(() => produtos.filter((p) => p.lc).length, [produtos]);
  const contCond = useMemo(() => {
    const c = { Sim: 0, "Não": 0, Depende: 0 };
    produtos.forEach((p) => { if (p.cond in c) c[p.cond] += 1; });
    return c;
  }, [produtos]);
  const filtrados = useMemo(
    () => filtrarProdutos(produtos, { busca, situacao }).filter((p) => (!ncmSel || p.ncm === ncmSel) && (lcFiltro === "todos" || (lcFiltro === "anexo" ? p.lc : !p.lc)) && (cond === "todos" || p.cond === cond)),
    [produtos, busca, situacao, ncmSel, lcFiltro, cond],
  );
  const mostrados = filtrados.slice(0, limite);
  const mostrarFilial = Object.keys(lista.estabs || {}).length > 1;
  const nAtivos = (ncmSel ? 1 : 0) + (lcFiltro !== "todos" ? 1 : 0) + (cond !== "todos" ? 1 : 0);
  const limpar = () => { setNcmSel(""); setLcFiltro("todos"); setSituacao("todos"); setCond("todos"); setLimite(LIMITE); };
  const chips = [
    ncmSel && [`NCM ${ncmFormatado(ncmSel)}`, () => setNcmSel("")],
    lcFiltro !== "todos" && [lcFiltro === "anexo" ? "Em anexo LC 214" : "Fora dos anexos", () => setLcFiltro("todos")],
    situacao !== "todos" && [{ pendente: "Pendentes", duvida: "Em análise", decidido: "Decididas" }[situacao], () => setSituacao("todos")],
    cond !== "todos" && [`Condicional: ${cond.toLowerCase()}`, () => setCond("todos")],
  ].filter(Boolean);
  const total = resumo.total;
  const escolherSituacao = (id) => { setSituacao(id); setLimite(LIMITE); };
  const alternarDensidade = () => setCompacta((c) => {
    const n = !c;
    try { localStorage.setItem("athos-revisa-densidade", n ? "compacta" : "confortavel"); } catch { /* sem armazenamento: só não lembra */ }
    return n;
  });
  const baixarCsv = () => {
    setBaixar(false);
    const linhas = [["Código", "Descrição", "NCM", "LC 214", "Anexo", "Itens", "Condicional", "Valor vendido", "Última venda", "Decisão"]];
    filtrados.forEach((p) => {
      const g = gruposPor.get(`${p.emp}|${p.codigo}`) || [];
      linhas.push([p.codigo, p.descricao, ncmFormatado(p.ncm), p.lc ? "sim" : "não", g.map(([a]) => a).join(" / "), g.map(([a, it]) => `${a}: ${it.join(", ")}`).join(" | "), p.cond || "", String(Number(p.valor) || 0).replace(".", ","), dia(p.ultima), rotuloDaDecisao(p)]);
    });
    const texto = linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿", texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "revisa-nota-produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const pad = compacta ? "py-1.5" : "py-2.5";
  const botaoFiltro = (ativo) => `rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors ${ativo ? "border-accent-500 bg-accent-500/10 text-accent-700" : "border-line text-ink-600 hover:bg-surface-muted"}`;

  return (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{lista.empresa || ""}</p>
        <h2 className="mt-1 text-[30px] font-bold leading-tight text-ink-900">Produtos <em className="font-serif font-semibold italic text-accent-500">vendidos</em>.</h2>
        <p className="mt-2 text-[12px] text-ink-500"><span className="font-medium text-emerald-500">● ao vivo</span>{atualizadoEm ? ` · atualizado em ${atualizadoEm}` : ""}</p>
      </div>

      <section className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="text-[12px] text-ink-500">Classificados</p>
          <p className="mt-0.5 text-[40px] font-bold leading-none tabular-nums text-ink-900">{inteiro(resumo.decidido.qtd)}<small className="ml-1 text-[16px] font-normal text-ink-400">/ {inteiro(total.qtd)}</small></p>
        </div>
        <div className="min-w-[280px] flex-1">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            <span className="bg-emerald-500" style={{ width: `${total.qtd ? (resumo.decidido.qtd / total.qtd) * 100 : 0}%` }} />
            <span className="bg-amber-500" style={{ width: `${total.qtd ? (resumo.duvida.qtd / total.qtd) * 100 : 0}%` }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {[["decidido", "decididas", "bg-emerald-500"], ["duvida", "em análise", "bg-amber-500"], ["pendente", "pendentes", "bg-ink-300"]].map(([k, t, cor]) => (
              <button key={k} type="button" onClick={() => escolherSituacao(situacao === k ? "todos" : k)} title={`Mostrar só: ${t}`} className={`flex items-center gap-1.5 text-[12px] ${situacao === k ? "text-ink-900" : "text-ink-500"} hover:text-ink-900`}>
                <i className={`h-1.5 w-1.5 rounded-full ${cor}`} />
                <b className="tabular-nums text-ink-900">{inteiro(resumo[k].qtd)}</b> {t}
              </button>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-ink-500">Vendido no período</p>
          <p className="mt-0.5 text-[26px] font-bold leading-none tabular-nums text-ink-900">{moneyFull(total.valor)}</p>
          <p className="mt-1 text-[11px] text-ink-400">{inteiro(ncms.length)} NCMs</p>
        </div>
      </section>

      <div className="relative flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(LIMITE); }} placeholder="Buscar por código, descrição ou NCM…" className="w-full rounded-lg border border-line bg-surface-card py-2.5 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line bg-surface-card" role="group" aria-label="Situação">
          {[["todos", "Todas"], ["pendente", "Pendentes"], ["duvida", "Em análise"], ["decidido", "Decididas"]].map(([k, t]) => (
            <button key={k} type="button" onClick={() => escolherSituacao(k)} className={`px-3 py-2 text-[12.5px] font-medium transition-colors ${situacao === k ? "bg-surface-muted text-ink-900" : "text-ink-500 hover:text-ink-900"}`}>
              {t} {k !== "todos" && <b className="ml-0.5 tabular-nums text-ink-400">{inteiro(resumo[k].qtd)}</b>}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setPainel(!painel); setBaixar(false); }} aria-expanded={painel} className="rounded-lg border border-line bg-surface-card px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-muted">
          Mais filtros {nAtivos > 0 && <b className="ml-1 rounded-full bg-accent-500 px-1.5 text-[11px] text-white">{nAtivos}</b>}
        </button>
        <button type="button" onClick={alternarDensidade} title={compacta ? "Linhas compactas (clique para confortável)" : "Linhas confortáveis (clique para compactar)"} aria-label="Densidade das linhas" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-card text-ink-600 hover:bg-surface-muted">{compacta ? "☰" : "≡"}</button>
        <button type="button" onClick={() => { setBaixar(!baixar); setPainel(false); }} title="Baixar a lista" aria-label="Baixar a lista" aria-expanded={baixar} className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-white hover:bg-accent-600"><Download size={15} /></button>
        {baixar && (
          <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface-card shadow-lg" role="menu">
            <button type="button" role="menuitem" onClick={baixarCsv} className="block w-full px-3 py-2 text-left text-[12.5px] text-ink-800 hover:bg-surface-muted">Planilha (.csv)</button>
          </div>
        )}
        {painel && (
          <div className="absolute right-0 top-full z-20 mt-1 w-full max-w-[460px] rounded-xl border border-line bg-surface-card p-4 shadow-lg">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">NCM</p>
                <select value={ncmSel} onChange={(e) => { setNcmSel(e.target.value); setLimite(LIMITE); }} className="w-full rounded-lg border border-line bg-surface-card px-2.5 py-2 text-[12.5px] text-ink-800 outline-none focus:border-accent-500">
                  <option value="">Todos os NCMs ({ncms.length})</option>
                  {ncms.map(([n, q]) => <option key={n} value={n}>{ncmFormatado(n)} · {q} produto(s)</option>)}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">NCM na LC 214</p>
                <div className="flex flex-wrap gap-1.5">
                  {[["todos", "Todos", produtos.length], ["anexo", "Em anexo", emAnexo], ["fora", "Fora dos anexos", produtos.length - emAnexo]].map(([k, t, q]) => (
                    <button key={k} type="button" onClick={() => { setLcFiltro(k); setLimite(LIMITE); }} className={botaoFiltro(lcFiltro === k)}>{t} <b className="ml-0.5 tabular-nums">{inteiro(q)}</b></button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400" title="O código deste produto pode mudar por uma condição (em geral, quem compra)?">Código muda conforme o comprador?</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONDICIONAL_FILTRO.map(([k, t]) => (
                    <button key={k} type="button" onClick={() => { setCond(k); setLimite(LIMITE); }} className={botaoFiltro(cond === k)}>{t} {k !== "todos" && <b className="ml-0.5 tabular-nums">{contCond[k]}</b>}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
              <button type="button" onClick={limpar} className="text-[12.5px] font-medium text-ink-500 hover:text-ink-900">Limpar tudo</button>
              <button type="button" onClick={() => setPainel(false)} className="rounded-lg bg-accent-500 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600">Ver {inteiro(filtrados.length)} produtos</button>
            </div>
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(([rot, tirar]) => (
            <button key={rot} type="button" onClick={tirar} title="Tirar este filtro" className="rounded-full border border-accent-500/40 bg-accent-500/10 px-2.5 py-0.5 text-[12px] font-medium text-accent-700">{rot} <span aria-hidden="true">✕</span></button>
          ))}
          <button type="button" onClick={limpar} className="text-[12px] font-medium text-ink-500 hover:text-ink-900">Limpar tudo</button>
          <span className="text-[12px] text-ink-400">{inteiro(filtrados.length)} de {inteiro(produtos.length)} produtos</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface-card">
        <div className="max-h-[680px] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[1180px] text-[13px]">
            <Cabecalho colunas={[["Código"], ["Descrição"], ["NCM"], ["LC"], ["Anexo"], ["Item"], ["%"], ["Condicional"], ["Valor vendido", true], ["Última venda"], ["Decisão"]]} />
            <tbody className="divide-y divide-line/60">
              {mostrados.map((p) => {
                const grupos = gruposPor.get(`${p.emp}|${p.codigo}`) || [];
                const sit = situacaoDoProduto(p);
                const abertos = pedidosDoAlvo(pedidos, alvoDoProduto(p)).filter(pedidoAberto).length;
                const duvida = p.decisao?.status === "duvida";
                return (
                  <tr key={`${p.emp}|${p.codigo}`} onClick={() => setAberto(p)} className="cursor-pointer align-middle transition-colors hover:bg-accent-50/40">
                    <td className={`whitespace-nowrap px-4 ${pad}`}><p className="font-semibold text-ink-900">{p.codigo}</p>{mostrarFilial && <p className="text-[10.5px] uppercase tracking-wide text-ink-400">{lista.estabs?.[p.emp]}</p>}</td>
                    <td className={`max-w-[360px] px-4 ${pad} text-ink-900`}><p className="line-clamp-2" title={p.descricao}>{p.descricao}</p></td>
                    <td className={`whitespace-nowrap px-4 ${pad} font-semibold tabular-nums text-ink-800`}>{ncmFormatado(p.ncm)}</td>
                    <td className={`px-4 ${pad} text-center`}>{p.lc ? <Check size={15} className="mx-auto text-emerald-500" /> : <X size={15} className="mx-auto text-rose-500" />}</td>
                    <td className={`whitespace-nowrap px-4 ${pad} text-ink-700`}>{grupos.length ? grupos.map(([anx]) => <div key={anx}>{anx}</div>) : <span className="text-ink-300">fora dos anexos</span>}</td>
                    <td className={`max-w-[170px] px-4 ${pad} tabular-nums text-ink-700`}>
                      {grupos.length ? grupos.map(([anx, its]) => <div key={anx}>{its.slice(0, 8).join(", ")}{its.length > 8 ? ` +${its.length - 8}` : ""}</div>) : <span className="text-ink-300">fora dos anexos</span>}
                    </td>
                    <td className={`whitespace-nowrap px-4 ${pad} text-[12px] font-medium text-emerald-600`}>
                      {grupos.length ? grupos.map(([anx, , pcts]) => <div key={anx} title={pcts.join(" / ")}>{pcts[0] || <span className="font-normal text-ink-300">—</span>}</div>) : <span className="font-normal text-ink-400">0%</span>}
                    </td>
                    <td className={`whitespace-nowrap px-4 ${pad}`}>{p.cond && p.cond !== "—" ? <Selo tom={TOM_CONDICIONAL[p.cond] || "cinza"}>{p.cond}</Selo> : <span className="text-ink-300">—</span>}</td>
                    <td className={`whitespace-nowrap px-4 ${pad} text-right font-semibold tabular-nums text-ink-900`}>{moneyFull(p.valor)}</td>
                    <td className={`whitespace-nowrap px-4 ${pad} tabular-nums text-ink-600`}>{dia(p.ultima)}</td>
                    <td className={`px-4 ${pad}`} title="Clique para ver o produto e pedir a alteração da classificação">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-ink-900"><span className={`h-1.5 w-1.5 rounded-full ${sit === "decidido" ? "bg-emerald-500" : sit === "duvida" ? "bg-amber-500" : "bg-ink-300"}`} />{rotuloDaDecisao(p)}{duvida && p.decisao?.observacao && <span className="text-amber-500" aria-label="Tem observação">!</span>}</span>
                      {duvida && p.decisao?.observacao && <small className="block max-w-[200px] truncate text-[11px] font-normal text-ink-400" title={p.decisao.observacao}>{p.decisao.observacao}</small>}
                      {abertos > 0 && <small className="block text-[11px] font-medium text-sky-600">alteração pedida</small>}
                    </td>
                  </tr>
                );
              })}
              {!mostrados.length && <tr><td colSpan={11} className="px-4 py-10 text-center text-ink-400">Nenhum produto com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtrados.length > limite && (
          <div className="border-t border-line px-4 py-3 text-center">
            <button type="button" onClick={() => setLimite((l) => l + LIMITE)} className="rounded-lg border border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface-muted">Mostrar mais ({inteiro(filtrados.length - limite)} restantes)</button>
          </div>
        )}
      </div>
      {aberto && <DetalheProduto produto={aberto} lista={lista} companyId={companyId} pedidos={pedidos} recarregarPedidos={recarregarPedidos} onClose={() => setAberto(null)} />}
    </>
  );
}

function Clientes({ lista, companyId, pedidos, recarregarPedidos }) {
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState("todos");
  const [uf, setUf] = useState("todos");
  const [limite, setLimite] = useState(LIMITE);
  const [aberto, setAberto] = useState(null);
  const clientes = lista.clientes;
  const resumo = useMemo(() => resumoDeClientes(clientes), [clientes]);
  const ufs = useMemo(() => [...new Set(clientes.map((c) => c.uf).filter(Boolean))].sort(), [clientes]);
  const filtrados = useMemo(() => filtrarClientes(clientes, { busca, perfil, uf }), [clientes, busca, perfil, uf]);
  const mostrados = filtrados.slice(0, limite);
  const escolher = (id) => { setPerfil(id); setLimite(LIMITE); };
  const semPerfil = { qtd: resumo.sem.qtd + resumo.verificar.qtd, valor: resumo.sem.valor + resumo.verificar.valor };

  return (
    <>
      <ResumoEmFaixas
        titulo="Compradores"
        total={resumo.total}
        ativo={perfil}
        onEscolher={escolher}
        itens={[
          { id: "privado", nome: "Privados", qtd: resumo.privado.qtd, valor: resumo.privado.valor, cor: "bg-sky-500" },
          { id: "publico", nome: "Públicos", qtd: resumo.publico.qtd, valor: resumo.publico.valor, cor: "bg-accent-500" },
          { id: "sus_cebas", nome: "SUS / CEBAS", qtd: resumo.sus_cebas.qtd, valor: resumo.sus_cebas.valor, cor: "bg-emerald-500" },
          { id: "sem", nome: "Sem perfil confirmado", ...semPerfil, cor: "bg-ink-300" },
        ]}
      />

      <section className="rounded-2xl border border-line bg-surface-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[260px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(LIMITE); }} placeholder="Buscar por nome, documento ou cidade…" className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
          </div>
          {ufs.length > 1 && (
            <select value={uf} onChange={(e) => { setUf(e.target.value); setLimite(LIMITE); }} aria-label="UF" className="rounded-lg border border-line bg-surface-card px-2.5 py-2 text-[12.5px] text-ink-700 outline-none focus:border-accent-500">
              <option value="todos">Todas as UFs</option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
          <p className="ml-auto text-[12px] text-ink-500">{inteiro(filtrados.length)} comprador{filtrados.length === 1 ? "" : "es"} · {abreviado(filtrados.reduce((s, c) => s + (Number(c.valor) || 0), 0))}{lista.de ? ` · ${dia(lista.de)} a ${dia(lista.ate)}` : ""}</p>
        </div>
        <div className="max-h-[680px] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[920px] text-[13px]">
            <Cabecalho colunas={[["Comprador"], ["Documento"], ["Cidade / UF"], ["Compras", true], ["Perfil"], ["Observação"]]} />
            <tbody className="divide-y divide-line/60">
              {mostrados.map((c) => {
                const perf = perfilDoCliente(c);
                const abertos = pedidosDoAlvo(pedidos, c.chave).filter(pedidoAberto).length;
                return (
                  <tr key={c.chave} onClick={() => setAberto(c)} className="cursor-pointer align-middle transition-colors hover:bg-accent-50/40">
                    <td className="max-w-[320px] px-4 py-2.5 text-ink-900"><p className="truncate font-medium" title={c.nome}>{c.nome}</p>{abertos > 0 && <span className="mt-0.5 inline-block rounded bg-sky-500/10 px-1.5 text-[10.5px] font-semibold text-sky-600">pedido em andamento</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-600">{c.doc}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{[c.municipio, c.uf].filter(Boolean).join(" / ")}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-ink-900"><span className="font-semibold">{moneyFull(c.valor)}</span><p className="text-[11px] text-ink-400">{inteiro(c.notas)} nota{c.notas === 1 ? "" : "s"}{c.ultima ? ` · última ${dia(c.ultima)}` : ""}</p></td>
                    <td className="whitespace-nowrap px-4 py-2.5"><Selo tom={TOM_PERFIL[perf] || "cinza"}>{NOME_PERFIL[perf] || perf}</Selo>{c.perfil?.cebasValidade && <p className="mt-0.5 text-[11px] text-ink-400">CEBAS até {dia(c.perfil.cebasValidade)}</p>}</td>
                    <td className="max-w-[280px] px-4 py-2.5 text-[12px] text-ink-500"><p className="truncate" title={c.perfil?.observacao || c.perfil?.comprovante || ""}>{c.perfil?.observacao || c.perfil?.comprovante || ""}</p></td>
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
      </section>
      {aberto && <DetalheCliente cliente={aberto} companyId={companyId} pedidos={pedidos} recarregarPedidos={recarregarPedidos} onClose={() => setAberto(null)} />}
    </>
  );
}

// Aba Cadastro: pedir um produto novo e acompanhar todos os pedidos (de produto e de comprador) com a conversa de cada um.
function Cadastro({ companyId, pedidos, recarregarPedidos }) {
  const [filtro, setFiltro] = useState("abertos");
  const [novo, setNovo] = useState(false);
  const abertos = pedidos.filter(pedidoAberto).length;
  const lista = pedidos.filter((p) => (filtro === "abertos" ? pedidoAberto(p) : true));
  return (
    <>
      <section className="rounded-2xl border border-line bg-surface-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Cadastrar produto novo</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-500">Envie o produto para o escritório classificar. A conversa fica no pedido, logo abaixo.</p>
          </div>
          {!novo && <button type="button" onClick={() => setNovo(true)} className="flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600"><Plus size={14} /> Cadastrar produto</button>}
        </div>
        {novo && <div className="mt-4 border-t border-line pt-4"><FormNovoProduto companyId={companyId} onCancelar={() => setNovo(false)} onCriado={async () => { setNovo(false); await recarregarPedidos(); }} /></div>}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink-900">Seus pedidos</h2>
          <div className="inline-flex rounded-xl bg-surface-muted p-1 text-[12.5px]">
            {[["abertos", `Em andamento${abertos ? ` (${abertos})` : ""}`], ["todos", `Todos (${pedidos.length})`]].map(([id, nome]) => (
              <button key={id} type="button" onClick={() => setFiltro(id)} className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${filtro === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{nome}</button>
            ))}
          </div>
        </div>
        {lista.map((p) => <CartaoDePedido key={p.id} pedido={p} onMudou={recarregarPedidos} />)}
        {!lista.length && <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-ink-400">{filtro === "abertos" ? "Nenhum pedido em andamento." : "Nenhum pedido ainda."}</p>}
      </section>
    </>
  );
}

function EmPreparacao({ titulo }) {
  return (
    <section className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-ink-900">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-ink-500">Esta aba ainda está sendo trazida do portal do Revisa Nota para cá. Enquanto isso, ela continua disponível no portal.</p>
      <a href={PORTAL_REVISA_NOTA} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-4 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-muted">Abrir no portal <ArrowUpRight size={14} /></a>
    </section>
  );
}

const ABAS = [
  { id: "produtos", nome: "Produtos" },
  { id: "resumo", nome: "Resumo de produtos" },
  { id: "cadastro", nome: "Cadastro" },
  { id: "clientes", nome: "Clientes" },
  { id: "lei", nome: "Consulta LC 214" },
];

export default function RevisaNota() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const grupo = state.activeGroupId ? state.groups.find((item) => item.id === state.activeGroupId) : null;
  const membros = useMemo(() => (grupo ? groupCompanies(grupo) : company ? [company] : []), [grupo, company, state.companies]);
  const idsMembros = membros.map((m) => m.id).join(",");
  const [conjuntos, setConjuntos] = useState(null); // [{ empresa, companyId, produtos, clientes, atualizadoEm }]
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("produtos");
  const [escolhida, setEscolhida] = useState(0);
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    if (!membros.length) return undefined;
    let ativo = true;
    setConjuntos(null);
    setErro("");
    Promise.all(membros.map((m) => fetchRevisaNota(m.id).then((r) => ({ ...r, companyId: m.id }))))
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

  const atual = conjuntos?.[escolhida] || null;
  const companyId = atual?.companyId || "";

  const recarregarPedidos = useCallback(async () => {
    if (!companyId) return;
    try {
      setPedidos(await fetchPedidos(companyId));
    } catch (err) {
      console.error("Falha ao ler os pedidos do Revisa Nota:", err);
    }
  }, [companyId]);
  // lê os pedidos ao abrir e a cada 15 s (a resposta do escritório chega sozinha)
  useEffect(() => {
    if (!companyId) return undefined;
    recarregarPedidos();
    const t = setInterval(recarregarPedidos, 15000);
    return () => clearInterval(t);
  }, [companyId, recarregarPedidos]);

  if (!membros.length) return <p className="p-6 text-[13px] text-ink-400">Abra uma empresa ou um grupo para ver o Revisa Nota.</p>;
  if (erro) return <p className="p-6 text-[13px] text-danger-600">{erro}</p>;
  if (!conjuntos) return <Esqueleto />;

  const abertos = pedidos.filter(pedidoAberto).length;

  return (
    <div className="flex w-full flex-col">
      <nav className="bi-abas flex items-center gap-4 overflow-x-auto border-b border-line bg-surface-card px-5 py-1" aria-label="Abas do Revisa Nota">
        {ABAS.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)} className={`bi-aba flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-[13px] transition-colors ${aba === a.id ? "border-accent-500 font-medium text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"}`}>
            {a.nome}
            {a.id === "cadastro" && abertos > 0 && <span className="rounded-full bg-accent-500 px-1.5 text-[10.5px] font-semibold text-white">{abertos}</span>}
          </button>
        ))}
        <a href={PORTAL_REVISA_NOTA} target="_blank" rel="noreferrer" className="ml-auto flex shrink-0 items-center gap-1 text-[12px] text-ink-400 hover:text-ink-700">Portal do Revisa Nota <ArrowUpRight size={12} /></a>
      </nav>

      <div className="flex flex-col gap-4 p-4 md:p-6">
        {!atual ? (
          <div className="rounded-2xl border border-line bg-surface-card p-6">
            <p className="text-[13px] text-ink-500">Ainda não chegaram dados do Revisa Nota para {grupo ? "este grupo" : "esta empresa"}. O escritório envia assim que a classificação estiver pronta.</p>
          </div>
        ) : (
          <>
            <div className={`${aba === "produtos" && conjuntos.length === 1 ? "hidden" : "flex"} flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-500`}>
              <PackageCheck size={15} className="text-accent-600" />
              {conjuntos.length > 1 ? (
                conjuntos.map((c, i) => (
                  <button key={c.empresa} type="button" onClick={() => setEscolhida(i)} className={`rounded-full border px-3 py-1 font-medium ${i === escolhida ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{c.empresa}</button>
                ))
              ) : (
                <span className="font-medium text-ink-700">{atual.empresa}</span>
              )}
              {atual.atualizadoEm && <span>· atualizado em {dataHora(atual.atualizadoEm)}</span>}
            </div>

            {aba === "produtos" && (atual.produtos ? <Produtos lista={atual.produtos} companyId={companyId} pedidos={pedidos} recarregarPedidos={recarregarPedidos} atualizadoEm={atual.atualizadoEm ? dataHora(atual.atualizadoEm) : ""} /> : <p className="text-[13px] text-ink-400">A lista de produtos ainda não foi enviada.</p>)}
            {aba === "resumo" && <EmPreparacao titulo="Resumo de produtos" />}
            {aba === "cadastro" && <Cadastro companyId={companyId} pedidos={pedidos} recarregarPedidos={recarregarPedidos} />}
            {aba === "clientes" && (atual.clientes ? <Clientes lista={atual.clientes} companyId={companyId} pedidos={pedidos} recarregarPedidos={recarregarPedidos} /> : <p className="text-[13px] text-ink-400">A lista de clientes ainda não foi enviada.</p>)}
            {aba === "lei" && <EmPreparacao titulo="Consulta LC 214" />}
          </>
        )}
      </div>
    </div>
  );
}
