import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowDown, ArrowRight, BarChart3, Clock, Gauge, Scale, Waves } from "lucide-react";
import { AREAS_DO_HUB } from "../lib/hub.js";
import { CATEGORIAS_DE_CONTEUDO, CONTEUDOS, tempoDeLeitura } from "../lib/conteudos.js";
import Mosaico from "./Mosaico.jsx";
import { Miniatura } from "./ilustracoes.jsx";
import { Revelar, Secao, moverLuz } from "./efeitos.jsx";

// Conteúdos (pedido do Izaias, 29/10/2026): guias curtos que explicam os
// demonstrativos e os indicadores do B.I., com desenhos. O texto de cada um
// fica em lib/conteudos.js; a página de leitura é a HubConteudo.jsx.

// Título com a palavra em itálico laranja (a mesma assinatura dos títulos
// do hub). A pontuação logo depois do itálico encosta nele (o ponto final
// ou o dois-pontos de "Margens: …").
export function TituloComItalico({ titulo, italico }) {
  const posicao = italico ? titulo.lastIndexOf(italico) : -1;
  if (posicao < 0) return `${titulo}.`;
  const depois = titulo.slice(posicao + italico.length);
  const encostada = /^[.,:;!?]/.test(depois) ? depois[0] : "";
  const resto = depois.slice(encostada.length);
  return (
    <>
      {titulo.slice(0, posicao)}
      <span className="hub-italico">{italico}</span>
      {encostada && <span className="hub-pontuacao">{encostada}</span>}
      {resto ? `${resto}.` : !encostada && <span className="hub-pontuacao">.</span>}
    </>
  );
}

// `destaque`: o primeiro da lista ocupa duas colunas no computador, com o
// desenho ao lado do texto — e a grade de três fecha as linhas sem buraco.
export function CartaoDeConteudo({ conteudo, atraso = 0, destaque = false }) {
  return (
    <Revelar atraso={atraso} className={`h-full ${destaque ? "lg:col-span-2" : ""}`}>
      <Link to={`/hub/conteudos/${conteudo.slug}`} onPointerMove={moverLuz} className={`hub-cartao hub-cartao-vivo group flex h-full flex-col ${destaque ? "lg:flex-row" : ""}`}>
        <span className={`m-3 mb-0 flex items-center rounded-[18px] border border-[var(--hub-borda)] bg-[var(--hub-fundo)] px-8 py-6 sm:px-10 ${destaque ? "lg:mb-3 lg:w-[52%] lg:shrink-0 lg:px-14" : ""}`}>
          <Miniatura id={conteudo.miniatura} />
        </span>
        <span className={`flex flex-1 flex-col p-6 pt-5 ${destaque ? "lg:justify-center lg:p-10" : ""}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-[var(--hub-texto-3)]">
            <span className="text-[var(--hub-acento)]">{conteudo.categoria}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {tempoDeLeitura(conteudo)} min de leitura
            </span>
          </span>
          <span className={`hub-display mt-3 block text-[21px] font-bold leading-snug ${destaque ? "lg:text-[30px] lg:leading-tight" : ""}`}>{conteudo.titulo}</span>
          <span className={`mt-2 block text-[14.5px] leading-relaxed text-[var(--hub-texto-2)] ${destaque ? "lg:text-[16px]" : ""}`}>{conteudo.resumo}</span>
          <span className={`mt-auto inline-flex items-center gap-2 pt-6 text-[14px] font-bold text-[var(--hub-acento)] ${destaque ? "lg:mt-2" : ""}`}>
            Ler <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </span>
      </Link>
    </Revelar>
  );
}

const FILTROS = ["Todos", ...CATEGORIAS_DE_CONTEUDO];

export default function HubConteudos() {
  const { irPara } = useOutletContext();
  const [filtro, setFiltro] = useState("Todos");
  const lista = filtro === "Todos" ? CONTEUDOS : CONTEUDOS.filter((conteudo) => conteudo.categoria === filtro);
  const bi = AREAS_DO_HUB.find((area) => area.id === "bi");
  const primeiro = CONTEUDOS[0];

  return (
    <>
      <section className="mx-auto grid hub-largura items-center gap-12 px-5 pb-14 pt-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:pt-16">
        <div>
          <Revelar>
            <p className="hub-rotulo">Conteúdos</p>
          </Revelar>
          <Revelar atraso={0.06}>
            <h1 className="hub-display mt-5 text-[42px] font-extrabold leading-[1.03] sm:text-[58px]">
              Os relatórios da sua empresa, <span className="hub-italico">traduzidos</span>
              <span className="hub-pontuacao">.</span>
            </h1>
          </Revelar>
          <Revelar atraso={0.12}>
            <p className="mt-6 max-w-[580px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Guias curtos, sem juridiquês, para entender a DRE, o balanço, o fluxo de caixa e os indicadores que o escritório fecha todo mês — com exemplos desenhados.</p>
          </Revelar>
          <Revelar atraso={0.18} className="mt-8 flex flex-wrap gap-3">
            <Link to={`/hub/conteudos/${primeiro.slug}`} className="hub-botao hub-botao-primario">
              Começar pela DRE <ArrowRight size={17} />
            </Link>
            <a href="#todos-os-conteudos" className="hub-botao hub-botao-fantasma">
              Ver todos <ArrowDown size={16} />
            </a>
          </Revelar>
        </div>
        <Revelar atraso={0.1} className="relative mx-auto hidden w-full max-w-[380px] lg:block">
          <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.2), transparent 60%)" }} />
          <Mosaico colunas={5} linhas={5} degraus={3} icones={{ "0-1": BarChart3, "1-3": Scale, "2-0": Waves, "0-4": Gauge }} className="relative" />
        </Revelar>
      </section>

      <Secao
        id="todos-os-conteudos"
        rotulo={`${CONTEUDOS.length} guias`}
        titulo="Para ler no seu"
        italico="ritmo"
        depois="."
        acao={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar os conteúdos">
            {FILTROS.map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => setFiltro(nome)}
                aria-pressed={filtro === nome}
                className={`h-10 rounded-full border px-4 text-[13.5px] font-semibold transition-colors ${filtro === nome ? "border-[var(--hub-acento)] bg-[var(--hub-acento-suave)] text-[var(--hub-texto)]" : "border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] text-[var(--hub-texto-2)] hover:text-[var(--hub-texto)]"}`}
              >
                {nome}
                <span className="ml-1.5 text-[var(--hub-texto-3)]">{nome === "Todos" ? CONTEUDOS.length : CONTEUDOS.filter((conteudo) => conteudo.categoria === nome).length}</span>
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((conteudo, i) => (
            <CartaoDeConteudo key={conteudo.slug} conteudo={conteudo} destaque={i === 0} atraso={(i % 3) * 0.06} />
          ))}
        </div>
      </Secao>

      <section className="mx-auto mt-24 hub-largura px-5 sm:px-8">
        <Revelar>
          <div className="relative overflow-hidden rounded-[32px] bg-[#081d33] px-7 py-14 text-white sm:px-14">
            <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(600px circle at 90% 120%, rgba(232,105,31,0.45), transparent 60%), radial-gradient(500px circle at 0% -20%, rgba(47,111,237,0.35), transparent 60%)" }} />
            <Mosaico colunas={5} linhas={4} degraus={3} className="pointer-events-none absolute -right-6 bottom-[-20px] hidden w-[300px] opacity-50 md:block" />
            <div className="relative max-w-xl">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">Da teoria aos seus números</p>
              <h2 className="hub-display mt-3 text-[32px] font-bold leading-[1.08] sm:text-[42px]">
                Agora, veja tudo isso na sua <span className="hub-italico">empresa</span>
                <span className="hub-pontuacao">.</span>
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-white/70">A DRE, o balanço, o fluxo de caixa e os indicadores de cada mês estão no seu B.I. Ficou com dúvida em algum número? A sua equipe na Athos explica.</p>
              <button type="button" onClick={() => irPara(bi)} className="hub-botao hub-botao-primario mt-8">
                Ver no meu B.I. <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Revelar>
      </section>
    </>
  );
}
