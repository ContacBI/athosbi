import { Copy, Plus, Trash2 } from "lucide-react";
import { CATEGORIAS, SIMPLES_ANEXOS } from "../../lib/reforma/parametros.js";
import { novaCompra, novaVenda, novoId, padraoCompra } from "../../lib/reforma/calculo.js";
import { Cartao, NumeroInput, Selecao, TextoInput, botaoSecundario } from "./ui.jsx";
import { reais } from "../../lib/reforma/formato.js";

const OPCOES_CATEGORIA = CATEGORIAS.map((categoria) => ({ valor: categoria.id, rotulo: categoria.nome }));
const th = "whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400";
const td = "px-1.5 py-1.5 align-middle";

function Acoes({ onDuplicar, onExcluir }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" onClick={onDuplicar} title="Duplicar (pra dividir em produtos)" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
        <Copy size={13} />
      </button>
      <button type="button" onClick={onExcluir} title="Excluir" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function acoesDaLista(lista, onLista) {
  return {
    mudar: (id, patch) => onLista(lista.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    duplicar: (id) => {
      const index = lista.findIndex((item) => item.id === id);
      const copia = { ...lista[index], id: novoId(id.startsWith("c") ? "c" : "v"), descricao: `${lista[index].descricao || "Item"} (cópia)` };
      onLista([...lista.slice(0, index + 1), copia, ...lista.slice(index + 1)]);
    },
    excluir: (id) => onLista(lista.filter((item) => item.id !== id)),
  };
}

// Aba "Vendas": um item por produto/serviço (ou grupo de produtos com a
// mesma tributação). Colunas mudam com o regime (Simples tem anexo e
// ICMS-ST; PIS/Cofins monofásico vale pra todos).
export function VendasTabela({ dados, onVendas }) {
  const { mudar, duplicar, excluir } = acoesDaLista(dados.vendas, onVendas);
  const simples = dados.regime === "simples";
  const total = dados.vendas.reduce((soma, item) => soma + (Number(item.receita) || 0), 0);
  return (
    <Cartao
      titulo="O que a empresa vende"
      subtitulo="Um item por produto ou serviço — ou por grupo com a mesma tributação. Valores por mês. Use o NCM (produto) ou NBS (serviço) pra conferir a categoria na reforma."
      acoes={
        <>
          <button type="button" onClick={() => onVendas([...dados.vendas, novaVenda(dados, "mercadoria")])} className={botaoSecundario}>
            <Plus size={14} />
            Produto
          </button>
          <button type="button" onClick={() => onVendas([...dados.vendas, novaVenda(dados, "servico")])} className={botaoSecundario}>
            <Plus size={14} />
            Serviço
          </button>
        </>
      }
    >
      {dados.vendas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-[12.5px] text-ink-400">Nenhum item ainda. Adicione um produto ou serviço — ou traga da contabilidade na aba Empresa.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Produto / serviço</th>
                <th className={th}>Tipo</th>
                <th className={th}>NCM / NBS</th>
                <th className={th}>Faturamento / mês</th>
                <th className={th} title="Quanto desse item é vendido pra outras empresas (que tomam crédito)">% p/ empresas</th>
                <th className={th}>ICMS / ISS</th>
                {!simples && <th className={th}>IPI</th>}
                <th className={th}>PIS/Cofins</th>
                {simples && <th className={th}>Anexo</th>}
                {simples && <th className={th}>ICMS-ST</th>}
                <th className={th}>Na reforma</th>
                <th className={th} title="Imposto Seletivo — só bebidas, cigarros, veículos, minerais etc.">Seletivo</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {dados.vendas.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    <TextoInput valor={item.descricao} onChange={(descricao) => mudar(item.id, { descricao })} placeholder="Ex.: Anel de prata" className="w-full min-w-[180px]" ariaLabel="Produto ou serviço" />
                  </td>
                  <td className={td}>
                    <Selecao
                      valor={item.tipo}
                      onChange={(tipo) => mudar(item.id, tipo === "servico" ? { tipo, iss: item.iss || 5, icms: 0, ipi: 0 } : { tipo, icms: item.icms || 18, iss: 0 })}
                      opcoes={[{ valor: "mercadoria", rotulo: "Produto" }, { valor: "servico", rotulo: "Serviço" }]}
                      ariaLabel="Tipo"
                    />
                  </td>
                  <td className={td}>
                    <TextoInput valor={item.codigo} onChange={(codigo) => mudar(item.id, { codigo })} placeholder={item.tipo === "servico" ? "NBS" : "NCM"} className="w-[110px]" ariaLabel="NCM ou NBS" />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.receita} onChange={(receita) => mudar(item.id, { receita })} prefixo="R$" className="w-[140px]" ariaLabel="Faturamento por mês" />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.b2b} onChange={(b2b) => mudar(item.id, { b2b })} sufixo="%" casas={0} max={100} className="w-[80px]" ariaLabel="Percentual vendido para empresas" />
                  </td>
                  <td className={td}>
                    {item.tipo === "servico" ? (
                      <NumeroInput valor={item.iss} onChange={(iss) => mudar(item.id, { iss })} sufixo="% ISS" max={100} className="w-[105px]" ariaLabel="ISS" />
                    ) : (
                      <NumeroInput valor={item.icms} onChange={(icms) => mudar(item.id, { icms })} sufixo="% ICMS" max={100} className="w-[110px]" ariaLabel="ICMS" />
                    )}
                  </td>
                  {!simples && (
                    <td className={td}>
                      {item.tipo === "servico" ? <span className="px-2 text-[12px] text-ink-300">—</span> : <NumeroInput valor={item.ipi} onChange={(ipi) => mudar(item.id, { ipi })} sufixo="%" max={100} className="w-[75px]" ariaLabel="IPI" />}
                    </td>
                  )}
                  <td className={td}>
                    <Selecao
                      valor={item.pisCofins}
                      onChange={(pisCofins) => mudar(item.id, { pisCofins })}
                      opcoes={[
                        { valor: "normal", rotulo: "Normal" },
                        { valor: "monofasico", rotulo: "Monofásico" },
                        { valor: "zero", rotulo: "Alíquota zero" },
                      ]}
                      ariaLabel="PIS/Cofins"
                    />
                  </td>
                  {simples && (
                    <td className={td}>
                      <Selecao valor={item.anexo || dados.anexoPadrao} onChange={(anexo) => mudar(item.id, { anexo })} opcoes={Object.keys(SIMPLES_ANEXOS).map((id) => ({ valor: id, rotulo: `Anexo ${id}` }))} ariaLabel="Anexo do Simples" />
                    </td>
                  )}
                  {simples && (
                    <td className={`${td} text-center`}>
                      {item.tipo === "servico" ? (
                        <span className="text-[12px] text-ink-300">—</span>
                      ) : (
                        <input type="checkbox" checked={Boolean(item.icmsSt)} onChange={(event) => mudar(item.id, { icmsSt: event.target.checked })} aria-label="ICMS por substituição tributária" />
                      )}
                    </td>
                  )}
                  <td className={td}>
                    <Selecao valor={item.categoria} onChange={(categoria) => mudar(item.id, { categoria })} opcoes={OPCOES_CATEGORIA} ariaLabel="Categoria na reforma" />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.seletivo} onChange={(seletivo) => mudar(item.id, { seletivo })} sufixo="%" max={100} className="w-[75px]" ariaLabel="Imposto Seletivo" />
                  </td>
                  <td className={td}>
                    <Acoes onDuplicar={() => duplicar(item.id)} onExcluir={() => excluir(item.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 pt-2 text-[12px] font-medium text-ink-500" colSpan={3}>
                  Total
                </td>
                <td className="px-2 pt-2 text-right font-mono text-[12.5px] font-semibold text-ink-900">{reais(total, { centavos: true })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <details className="mt-3 text-[12px] text-ink-500">
        <summary className="cursor-pointer text-ink-600">Categorias na reforma (exemplos)</summary>
        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
          {CATEGORIAS.map((categoria) => (
            <li key={categoria.id}>
              <strong className="text-ink-700">{categoria.nome}:</strong> {categoria.exemplo}
            </li>
          ))}
        </ul>
      </details>
    </Cartao>
  );
}

const TIPOS_COMPRA = [
  { valor: "mercadoria", rotulo: "Mercadoria p/ revenda" },
  { valor: "insumo", rotulo: "Matéria-prima / insumo" },
  { valor: "servico", rotulo: "Serviço tomado" },
  { valor: "energia", rotulo: "Energia / telecom" },
  { valor: "aluguel", rotulo: "Aluguel" },
  { valor: "outros", rotulo: "Uso e consumo / outros" },
];

// Aba "Compras e despesas": o que gera (ou passa a gerar) crédito. Folha de
// pagamento não entra.
export function ComprasTabela({ dados, onCompras }) {
  const { mudar, duplicar, excluir } = acoesDaLista(dados.compras, onCompras);
  const regimeNormal = dados.regime !== "simples";
  const total = dados.compras.reduce((soma, item) => soma + (Number(item.valor) || 0), 0);
  return (
    <Cartao
      titulo="O que a empresa compra"
      subtitulo="Compras e despesas com fornecedores, por mês. Na reforma quase tudo gera crédito de IBS/CBS — inclusive o que hoje não gera. Folha de pagamento não entra."
      acoes={
        <button type="button" onClick={() => onCompras([...dados.compras, novaCompra()])} className={botaoSecundario}>
          <Plus size={14} />
          Compra / despesa
        </button>
      }
    >
      {dados.compras.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-[12.5px] text-ink-400">Nenhuma compra ainda. Sem compras, a simulação não considera crédito nenhum.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Descrição</th>
                <th className={th}>Tipo</th>
                <th className={th}>Valor / mês</th>
                <th className={th}>Fornecedor</th>
                <th className={th} title="ICMS (mercadoria/energia) ou ISS (serviço) que vem embutido no preço do fornecedor">ICMS / ISS</th>
                {regimeNormal && <th className={th}>IPI</th>}
                {regimeNormal && <th className={th} title="Hoje a empresa toma crédito de ICMS nessa compra?">Créd. ICMS hoje</th>}
                {dados.regime === "real" && <th className={th} title="Hoje a empresa toma crédito de PIS/Cofins nessa compra (Lucro Real)?">Créd. PIS/Cofins hoje</th>}
                <th className={th}>Na reforma</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {dados.compras.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    <TextoInput valor={item.descricao} onChange={(descricao) => mudar(item.id, { descricao })} placeholder="Ex.: Prata e insumos" className="w-full min-w-[170px]" ariaLabel="Descrição" />
                  </td>
                  <td className={td}>
                    <Selecao valor={item.tipo} onChange={(tipo) => mudar(item.id, padraoCompra(tipo))} opcoes={TIPOS_COMPRA} ariaLabel="Tipo de compra" />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.valor} onChange={(valor) => mudar(item.id, { valor })} prefixo="R$" className="w-[140px]" ariaLabel="Valor por mês" />
                  </td>
                  <td className={td}>
                    <Selecao
                      valor={item.fornecedor}
                      onChange={(fornecedor) => mudar(item.id, { fornecedor })}
                      opcoes={[
                        { valor: "normal", rotulo: "Regime normal" },
                        { valor: "simples", rotulo: "Do Simples" },
                        { valor: "semCredito", rotulo: "Sem crédito (pessoa física)" },
                      ]}
                      ariaLabel="Fornecedor"
                    />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.aliquota} onChange={(aliquota) => mudar(item.id, { aliquota })} sufixo={item.tipo === "servico" ? "% ISS" : "% ICMS"} max={100} className="w-[110px]" ariaLabel="ICMS ou ISS embutido" />
                  </td>
                  {regimeNormal && (
                    <td className={td}>
                      {["mercadoria", "insumo"].includes(item.tipo) ? <NumeroInput valor={item.ipi} onChange={(ipi) => mudar(item.id, { ipi })} sufixo="%" max={100} className="w-[75px]" ariaLabel="IPI" /> : <span className="px-2 text-[12px] text-ink-300">—</span>}
                    </td>
                  )}
                  {regimeNormal && (
                    <td className={`${td} text-center`}>
                      {["mercadoria", "insumo", "energia"].includes(item.tipo) ? (
                        <input type="checkbox" checked={Boolean(item.creditoIcms)} onChange={(event) => mudar(item.id, { creditoIcms: event.target.checked })} aria-label="Crédito de ICMS hoje" />
                      ) : (
                        <span className="text-[12px] text-ink-300">—</span>
                      )}
                    </td>
                  )}
                  {dados.regime === "real" && (
                    <td className={`${td} text-center`}>
                      <input type="checkbox" checked={item.creditoPisCofins !== false} onChange={(event) => mudar(item.id, { creditoPisCofins: event.target.checked })} aria-label="Crédito de PIS/Cofins hoje" />
                    </td>
                  )}
                  <td className={td}>
                    <Selecao valor={item.categoria} onChange={(categoria) => mudar(item.id, { categoria })} opcoes={OPCOES_CATEGORIA} ariaLabel="Categoria na reforma" />
                  </td>
                  <td className={td}>
                    <Acoes onDuplicar={() => duplicar(item.id)} onExcluir={() => excluir(item.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 pt-2 text-[12px] font-medium text-ink-500" colSpan={2}>
                  Total
                </td>
                <td className="px-2 pt-2 text-right font-mono text-[12.5px] font-semibold text-ink-900">{reais(total, { centavos: true })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Cartao>
  );
}
