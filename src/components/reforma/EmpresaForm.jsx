import { useState } from "react";
import { Building2, Database, Factory, Store } from "lucide-react";
import { SIMPLES_ANEXOS, simplesAliquota } from "../../lib/reforma/parametros.js";
import { dadosDaContabilidade } from "../../lib/reforma/contabilidade.js";
import { Cartao, NumeroInput, Selecao, botaoSecundario } from "./ui.jsx";
import { porcento, reais } from "../../lib/reforma/formato.js";

const REGIMES = [
  { id: "simples", nome: "Simples Nacional", icone: Store, texto: "Paga o DAS. A simulação compara ficar no Simples com recolher IBS/CBS por fora (opção a partir de 2027)." },
  { id: "presumido", nome: "Lucro Presumido", icone: Building2, texto: "PIS/Cofins cumulativo (3,65%), sem crédito de PIS/Cofins nas compras." },
  { id: "real", nome: "Lucro Real", icone: Factory, texto: "PIS/Cofins não cumulativo (9,25%), com crédito nas compras." },
];

const mesAno = (chave) => {
  const [ano, mes] = String(chave).split("-");
  return `${mes}/${ano.slice(2)}`;
};

// Aba "Empresa": regime, dados do Simples e o atalho pra trazer os números
// da contabilidade (quando a empresa tem lançamentos no B.I.).
export default function EmpresaForm({ dados, alterar, company }) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const simples = dados.regime === "simples" ? simplesAliquota(dados.anexoPadrao, dados.rbt12) : null;
  const temContabilidade = Number(company?.journalCount) > 0 || company?.journalCount === null || company?.journalCount === undefined;

  async function trazerDaContabilidade() {
    if (buscando) return;
    if ((dados.vendas.length || dados.compras.length) && !confirm("Substituir as vendas e compras desta simulação pelos números da contabilidade?")) return;
    setBuscando(true);
    setAviso("");
    try {
      const contabil = await dadosDaContabilidade(company);
      if (!contabil || (!contabil.vendas.length && !contabil.compras.length)) {
        setAviso("Não achei lançamentos de receita ou compras dessa empresa na contabilidade.");
        return;
      }
      alterar({
        regime: contabil.regime,
        rbt12: contabil.regime === "simples" ? contabil.rbt12 : dados.rbt12,
        vendas: contabil.vendas,
        compras: contabil.compras,
      });
      const periodo = `${mesAno(contabil.meses[0])} a ${mesAno(contabil.meses[contabil.meses.length - 1])}`;
      setAviso(
        `Trouxe a média de ${contabil.meses.length} ${contabil.meses.length === 1 ? "mês" : "meses"} (${periodo}). Regime sugerido pelos tributos pagos: ${REGIMES.find((item) => item.id === contabil.regime).nome}. ` +
          `Confira as alíquotas e, pra simular produto a produto, divida cada linha nos seus produtos/serviços (botão de duplicar na aba Vendas).`
      );
    } catch (error) {
      console.error("Falha ao ler a contabilidade:", error);
      setAviso("Não consegui ler a contabilidade agora. Tente de novo em instantes.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo="Regime tributário hoje" subtitulo="Escolha como a empresa recolhe os tributos atualmente.">
        <div className="grid gap-2 md:grid-cols-3">
          {REGIMES.map((regime) => {
            const ativo = dados.regime === regime.id;
            const Icone = regime.icone;
            return (
              <button
                key={regime.id}
                type="button"
                onClick={() => alterar({ regime: regime.id })}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors ${ativo ? "border-accent-500 bg-accent-50" : "border-line hover:border-accent-200 hover:bg-surface-muted"}`}
              >
                <span className={`flex items-center gap-1.5 text-[13.5px] font-medium ${ativo ? "text-accent-700" : "text-ink-900"}`}>
                  <Icone size={15} strokeWidth={1.8} />
                  {regime.nome}
                </span>
                <span className="text-[12px] text-ink-500">{regime.texto}</span>
              </button>
            );
          })}
        </div>

        {simples && (
          <div className="mt-4 grid gap-3 rounded-lg bg-surface-muted p-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-[12px] text-ink-600">
              Receita bruta dos últimos 12 meses (RBT12)
              <NumeroInput valor={dados.rbt12} onChange={(rbt12) => alterar({ rbt12 })} prefixo="R$" ariaLabel="RBT12" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-600">
              Anexo principal
              <Selecao valor={dados.anexoPadrao} onChange={(anexoPadrao) => alterar({ anexoPadrao })} opcoes={Object.entries(SIMPLES_ANEXOS).map(([id, anexo]) => ({ valor: id, rotulo: anexo.nome }))} ariaLabel="Anexo" />
            </label>
            <div className="text-[12px] text-ink-600">
              Alíquota efetiva do DAS
              <p className="mt-1 font-mono text-[18px] font-semibold text-ink-900">{porcento(simples.efetiva, { casas: 2 })}</p>
              <p className="text-[11.5px] text-ink-400">
                Faixa {simples.faixa} · nominal {simples.nominal.toLocaleString("pt-BR")}% − {reais(simples.deducao)}
                {simples.foraDoLimite ? " · acima de R$ 4,8 mi (fora do Simples)" : ""}
              </p>
            </div>
            <p className="text-[11.5px] text-ink-400 md:col-span-3">Item com outro anexo (ex.: serviço numa empresa de comércio) pode ser ajustado na aba Vendas.</p>
          </div>
        )}
      </Cartao>

      {company && temContabilidade && (
        <Cartao
          titulo="Começar pelos números da contabilidade"
          subtitulo="Traz o faturamento por tipo de receita, as compras e despesas que geram crédito e as alíquotas efetivas de hoje — média dos últimos 12 meses no B.I."
          acoes={
            <button type="button" onClick={trazerDaContabilidade} disabled={buscando} className={botaoSecundario}>
              <Database size={14} />
              {buscando ? "Lendo a contabilidade…" : "Trazer da contabilidade"}
            </button>
          }
        >
          {aviso ? <p className="text-[12.5px] text-ink-600">{aviso}</p> : <p className="text-[12px] text-ink-400">Folha de pagamento fica de fora: não paga IBS/CBS nem gera crédito.</p>}
        </Cartao>
      )}
    </div>
  );
}
