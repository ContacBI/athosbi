import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { carregarFiscal } from "../../lib/reforma/api.js";
import { comprasDaDominio, resumoFiscal, vendasDaDominio } from "../../lib/reforma/fiscal.js";
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
      `Trouxe ${vendas.length} ${vendas.length === 1 ? "linha" : "linhas"} de venda e ${compras.length} de compra (média por mês). ` +
        `Agora confira, NCM a NCM, a coluna "Na reforma" — é ela que diz se o produto tem alíquota reduzida ou zero.`
    );
  }

  const resumo = fiscal ? resumoFiscal(fiscal) : null;
  return (
    <Cartao
      titulo="Notas fiscais da Domínio"
      subtitulo="Vendas por NCM (e serviços) e compras, direto da Escrita Fiscal — média por mês dos últimos 12 meses fechados."
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
          {data(fiscal.inicio)} a {data(fiscal.fim)} · vendas <strong className="font-mono text-ink-900">{reais(resumo.vendasMes)}</strong>/mês em {resumo.ncms} NCMs
          {resumo.servicos ? ` e ${resumo.servicos} ${resumo.servicos === 1 ? "serviço" : "serviços"}` : ""} · compras <strong className="font-mono text-ink-900">{reais(resumo.comprasMes)}</strong>/mês · recebido em{" "}
          {new Date(fiscal.synced_at).toLocaleDateString("pt-BR")}
        </p>
      )}
    </Cartao>
  );
}
