import { Link, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BarChart3, CircleCheck, Clock, Lightbulb, Sigma, TriangleAlert } from "lucide-react";
import { AREAS_DO_HUB } from "../lib/hub.js";
import { conteudoPorSlug, tempoDeLeitura } from "../lib/conteudos.js";
import Mosaico from "./Mosaico.jsx";
import { CartaoDeConteudo, TituloComItalico } from "./HubConteudos.jsx";
import { Ilustracao } from "./ilustracoes.jsx";
import { Revelar, Secao } from "./efeitos.jsx";

// Um conteúdo aberto (/hub/conteudos/:slug): o texto em seções, os desenhos,
// o "como ler" (bons sinais, sinais de alerta e o aviso de que depende do
// setor) e o caminho pro B.I. da empresa. O texto vem de lib/conteudos.js.

function Formula({ nome, conta, exemplo, texto }) {
  return (
    <div className="hub-cartao flex h-full flex-col p-6">
      <p className="text-[15.5px] font-bold leading-snug">{nome}</p>
      <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] px-3.5 py-3 text-[14px] font-semibold leading-snug text-[var(--hub-texto)]">
        <Sigma size={15} className="mt-0.5 shrink-0 text-[var(--hub-acento)]" aria-hidden="true" />
        {conta}
      </p>
      {exemplo && (
        <p className="mt-3 text-[13px] text-[var(--hub-texto-3)]">
          No exemplo: <span className="font-bold tabular-nums text-[var(--hub-texto)]">{exemplo}</span>
        </p>
      )}
      {texto && <p className="mt-2 text-[14px] leading-relaxed text-[var(--hub-texto-2)]">{texto}</p>}
    </div>
  );
}

function SecaoDoConteudo({ secao }) {
  return (
    <section id={secao.id} className="scroll-mt-28">
      <Revelar>
        <h2 className="hub-display text-[26px] font-bold leading-tight sm:text-[32px]">{secao.titulo}</h2>
      </Revelar>
      {(secao.paragrafos || []).map((paragrafo) => (
        <Revelar key={paragrafo.slice(0, 40)}>
          <p className="mt-4 max-w-[68ch] text-[16.5px] leading-[1.75] text-[var(--hub-texto-2)]">{paragrafo}</p>
        </Revelar>
      ))}
      {secao.formulas && (
        <div className={`mt-7 grid gap-4 ${secao.formulas.length > 1 ? "md:grid-cols-2" : ""}`}>
          {secao.formulas.map((formula, i) => (
            <Revelar key={formula.nome} atraso={(i % 2) * 0.06}>
              <Formula {...formula} />
            </Revelar>
          ))}
        </div>
      )}
      {secao.ilustracao && (
        <Revelar className="mt-8">
          <Ilustracao id={secao.ilustracao} legenda={secao.legenda} />
        </Revelar>
      )}
      {secao.itens && (
        <Revelar className="mt-7">
          <dl className="hub-cartao px-6 sm:px-8">
            {secao.itens.map((item) => (
              <div key={item.nome} className="grid gap-1.5 border-b border-[var(--hub-borda)] py-5 last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-6">
                <dt className="text-[15px] font-bold leading-snug">{item.nome}</dt>
                <dd className="text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">{item.texto}</dd>
              </div>
            ))}
          </dl>
        </Revelar>
      )}
    </section>
  );
}

function ListaDeSinais({ titulo, itens, bom }) {
  const Icone = bom ? CircleCheck : TriangleAlert;
  return (
    <div className="hub-cartao h-full p-6 sm:p-7">
      <p className="flex items-center gap-2.5 text-[15.5px] font-bold">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${bom ? "hub-sinal-bom" : "hub-sinal-alerta"}`}>
          <Icone size={18} aria-hidden="true" />
        </span>
        {titulo}
      </p>
      <ul className="mt-5 space-y-3.5">
        {itens.map((item) => (
          <li key={item} className="flex gap-3 text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">
            <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${bom ? "bg-[#1d9e75]" : "bg-[#d99a2b]"}`} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComoLer({ comoLer }) {
  return (
    <section id="como-ler" className="scroll-mt-28">
      <Revelar>
        <h2 className="hub-display text-[26px] font-bold leading-tight sm:text-[32px]">Como ler</h2>
      </Revelar>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <Revelar className="h-full">
          <ListaDeSinais titulo="Bons sinais" itens={comoLer.bons} bom />
        </Revelar>
        <Revelar atraso={0.06} className="h-full">
          <ListaDeSinais titulo="Sinais de alerta" itens={comoLer.alertas} />
        </Revelar>
      </div>
      <Revelar className="mt-4">
        <div className="relative overflow-hidden rounded-[24px] border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] px-6 py-6 shadow-[var(--hub-sombra)] sm:px-8">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#e8691f] to-[#f4a96f]" />
          <p className="flex items-center gap-2 text-[14.5px] font-bold">
            <Lightbulb size={17} className="text-[var(--hub-acento)]" aria-hidden="true" /> Depende do setor
          </p>
          <p className="mt-2 max-w-[75ch] text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">{comoLer.depende}</p>
        </div>
      </Revelar>
    </section>
  );
}

function NaoEncontrado() {
  return (
    <section className="mx-auto grid min-h-[56vh] hub-largura items-center gap-14 px-5 pb-10 pt-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
      <div>
        <Revelar>
          <span className="hub-selo">Conteúdo não encontrado</span>
        </Revelar>
        <Revelar atraso={0.06}>
          <h1 className="hub-display mt-6 text-[42px] font-extrabold leading-[1.04] sm:text-[56px]">
            Esse guia não está <span className="hub-italico">aqui</span>
            <span className="hub-pontuacao">.</span>
          </h1>
        </Revelar>
        <Revelar atraso={0.12}>
          <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">O endereço pode ter mudado ou o conteúdo saiu do ar. Os outros guias continuam na lista.</p>
        </Revelar>
        <Revelar atraso={0.18}>
          <Link to="/hub/conteudos" className="hub-botao hub-botao-primario mt-10">
            <ArrowLeft size={16} /> Ver todos os conteúdos
          </Link>
        </Revelar>
      </div>
      <Revelar atraso={0.1} className="relative mx-auto hidden w-full max-w-[400px] lg:block">
        <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.16), transparent 60%)" }} />
        <Mosaico colunas={5} linhas={5} degraus={2} className="relative" />
      </Revelar>
    </section>
  );
}

export default function HubConteudo() {
  const { slug } = useParams();
  const { irPara } = useOutletContext();
  const conteudo = conteudoPorSlug(slug);
  if (!conteudo) return <NaoEncontrado />;
  const bi = AREAS_DO_HUB.find((area) => area.id === "bi");
  const relacionados = conteudo.relacionados.map(conteudoPorSlug).filter(Boolean);
  const indice = [...conteudo.secoes.map((secao) => ({ id: secao.id, titulo: secao.titulo })), { id: "como-ler", titulo: "Como ler" }];

  return (
    <>
      <article>
        <header className="mx-auto hub-largura px-5 pb-12 pt-10 sm:px-8 lg:pt-14">
          <Revelar>
            <Link to="/hub/conteudos" className="inline-flex items-center gap-2 rounded-full py-1 text-[13.5px] font-semibold text-[var(--hub-texto-2)] transition-colors hover:text-[var(--hub-acento)]">
              <ArrowLeft size={15} /> Conteúdos
            </Link>
          </Revelar>
          <Revelar atraso={0.05} className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="hub-rotulo !text-[var(--hub-acento)]">{conteudo.categoria}</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--hub-texto-3)]">
              <Clock size={13} /> {tempoDeLeitura(conteudo)} min de leitura
            </span>
          </Revelar>
          <Revelar atraso={0.1}>
            <h1 className="hub-display mt-4 max-w-4xl text-[38px] font-extrabold leading-[1.05] sm:text-[54px]">
              <TituloComItalico titulo={conteudo.titulo} italico={conteudo.italico} />
            </h1>
          </Revelar>
          <Revelar atraso={0.15}>
            <p className="mt-6 max-w-3xl text-[18px] leading-relaxed text-[var(--hub-texto-2)]">{conteudo.intro}</p>
          </Revelar>
        </header>

        <div className="mx-auto grid hub-largura gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px] xl:gap-16">
          <div className="min-w-0 space-y-16">
            {conteudo.secoes.map((secao) => (
              <SecaoDoConteudo key={secao.id} secao={secao} />
            ))}
            <ComoLer comoLer={conteudo.comoLer} />
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-5">
              <nav aria-label="Nesta leitura" className="hub-cartao p-6">
                <p className="hub-rotulo">Nesta leitura</p>
                <ol className="mt-4 space-y-1">
                  {indice.map((item, i) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="flex gap-3 rounded-xl px-2 py-1.5 text-[13.5px] font-medium leading-snug text-[var(--hub-texto-2)] transition-colors hover:bg-[var(--hub-acento-suave)] hover:text-[var(--hub-texto)]">
                        <span className="w-4 shrink-0 text-right font-bold tabular-nums text-[var(--hub-texto-3)]">{i + 1}</span>
                        {item.titulo}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <div className="hub-cartao p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
                  <BarChart3 size={18} />
                </span>
                <p className="mt-4 text-[14.5px] font-bold">No seu B.I.</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--hub-texto-2)]">{conteudo.noBi}</p>
                <button type="button" onClick={() => irPara(bi)} className="hub-botao hub-botao-primario hub-botao-p mt-5 w-full">
                  Ver no meu B.I. <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </article>

      <section className="mx-auto mt-20 hub-largura px-5 sm:px-8">
        <Revelar>
          <div className="relative overflow-hidden rounded-[32px] bg-[#081d33] px-7 py-12 text-white sm:px-14">
            <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(600px circle at 90% 120%, rgba(232,105,31,0.45), transparent 60%), radial-gradient(500px circle at 0% -20%, rgba(47,111,237,0.35), transparent 60%)" }} />
            <Mosaico colunas={5} linhas={4} degraus={3} className="pointer-events-none absolute -right-6 bottom-[-20px] hidden w-[280px] opacity-50 md:block" />
            <div className="relative max-w-xl">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-white/55">Na prática</p>
              <h2 className="hub-display mt-3 text-[30px] font-bold leading-[1.1] sm:text-[38px]">
                Veja esses números na sua <span className="hub-italico">empresa</span>
                <span className="hub-pontuacao">.</span>
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-white/70">{conteudo.noBi}</p>
              <button type="button" onClick={() => irPara(bi)} className="hub-botao hub-botao-primario mt-8">
                Ver no meu B.I. <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Revelar>
      </section>

      {relacionados.length > 0 && (
        <Secao
          className="mt-24"
          rotulo="Continue lendo"
          titulo="Outros"
          italico="guias"
          depois="."
          acao={
            <Link to="/hub/conteudos" className="hub-botao hub-botao-fantasma">
              Todos os conteúdos <ArrowRight size={16} />
            </Link>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relacionados.map((item, i) => (
              <CartaoDeConteudo key={item.slug} conteudo={item} atraso={i * 0.06} />
            ))}
          </div>
        </Secao>
      )}
    </>
  );
}
