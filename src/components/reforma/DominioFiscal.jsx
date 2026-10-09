import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { carregarFiscal } from "../../lib/reforma/api.js";
import { avisoDeRegime, comprasDaDominio, resumoFiscal, vendasDaDominio } from "../../lib/reforma/fiscal.js";
import { Cartao, botaoSecundario } from "./ui.jsx";
import { reais } from "../../lib/reforma/formato.js";

const data = (texto) => new Date(`${String(texto).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" });

// "Trazer da Domínio": vendas por NCM/serviço e compras das notas fiscais
// (Escrita Fiscal), pelo CNPJ da empresa da Reforma. Só o escritório usa
// (a RLS de dominio_fiscal só devolve pra ele). Substitui as vendas e as
// compras de `dados` — quem chama decide onde gravar (`alterar`).
export default function DominioFiscal({ cnpj, dados, alterar }) {
  const [fiscal, setFiscal] = useState(undefined); // undefined = carregando, null = não chegou
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let ativo = true;
    setFiscal(undefined);
    carregarFiscal(cnpj)
      .then((registro) => ativo && setFiscal(registro || null))
      .catch((error) => {
        console.error("Falha ao ler as notas da Domínio:", error);
        if (ativo) setFiscal(null);
      });
    return () => {
      ativo = false;
    };
  }, [cnpj]);

  function trazer() {
    if ((dados.vendas.length || dados.compras.length) && !confirm("Substituir as vendas e as compras pelas das notas fiscais da Domínio?")) return;
    const vendas = vendasDaDominio(fiscal, dados);
    const compras = comprasDaDominio(fiscal);
    alterar({ vendas, compras });
    setAviso(
      `Trouxe ${vendas.length} ${vendas.length === 1 ? "linha" : "linhas"} de venda e ${compras.length} de compra (média por mês), com a coluna "Na reforma" já sugerida pelos anexos da LC 214. ` +
        `Passe o mouse no selo embaixo de cada categoria pra ver o item do anexo e conferir se o produto é o descrito.`
    );
  }

  const resumo = fiscal ? resumoFiscal(fiscal) : null;
  const regimeErrado = fiscal ? avisoDeRegime(fiscal, dados.regime) : null;
  return (
    <Cartao
      dica="A Central (no computador do escritório) lê a Escrita Fiscal da Domínio uma vez por dia e manda o resumo: vendas por NCM/serviço e compras por tipo, somando matriz e filiais (mesma raiz de CNPJ). Ao trazer, os valores viram média por mês, as alíquotas viram efetivas (tributo ÷ valor) e a coluna Na reforma já vem pela LC 214."
      titulo="Notas fiscais da Domínio"
      subtitulo="Vendas por NCM (e serviços) e compras, direto da Escrita Fiscal — média por mês dos meses com nota. A categoria na reforma já vem sugerida pela LC 214."
      acoes={
        fiscal && (
          <button type="button" onClick={trazer} className={botaoSecundario}>
            <FileSpreadsheet size={14} />
            Trazer vendas e compras da Domínio
          </button>
        )
      }
    >
      {aviso ? (
        <p className="text-[12.5px] text-ink-600">{aviso}</p>
      ) : String(cnpj || "").replace(/\D/g, "").length !== 14 ? (
        <p className="text-[12.5px] text-ink-400">Cadastre o CNPJ da empresa (aba Configuração) pra puxar as notas da Domínio.</p>
      ) : fiscal === undefined ? (
        <p className="text-[12.5px] text-ink-400">Procurando as notas da Domínio…</p>
      ) : fiscal === null ? (
        <p className="text-[12.5px] text-ink-400">Ainda não chegou nada da Domínio pra este CNPJ. A Central manda as notas das empresas cadastradas na Reforma (com CNPJ) uma vez por dia, com o DC04 ligado.</p>
      ) : (
        <p className="text-[12.5px] text-ink-600">
          {data(fiscal.inicio)} a {data(fiscal.fim)} ({resumo.meses} {resumo.meses === 1 ? "mês" : "meses"} com nota) · vendas <strong className="font-mono text-ink-900">{reais(resumo.vendasMes)}</strong>/mês em {resumo.ncms} NCMs
          {resumo.servicos ? ` e ${resumo.servicos} ${resumo.servicos === 1 ? "serviço" : "serviços"}` : ""} · compras <strong className="font-mono text-ink-900">{reais(resumo.comprasMes)}</strong>/mês · recebido em{" "}
          {new Date(fiscal.synced_at).toLocaleDateString("pt-BR")}
        </p>
      )}
      {regimeErrado && (
        <p className="mt-2 rounded-lg bg-warning-50 px-3 py-2 text-[12.5px] text-warning-700">
          Pelas notas, a empresa fatura cerca de <strong>{reais(regimeErrado.anual)}</strong> por ano — {regimeErrado.texto}. Confira o regime na aba Empresa/Configuração.
        </p>
      )}
    </Cartao>
  );
}
