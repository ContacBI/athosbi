import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AREAS_DO_HUB } from "../lib/hub.js";
import Mosaico from "./Mosaico.jsx";
import { Revelar } from "./efeitos.jsx";

// Área que ainda não tem nada (Serviços, Conteúdos, Ferramentas): só o nome
// e o caminho de volta, até a equipe alimentar.
export default function HubEmBreve({ area: id }) {
  const navigate = useNavigate();
  const area = AREAS_DO_HUB.find((item) => item.id === id);
  if (!area) return null;
  return (
    <section className="mx-auto grid min-h-[56vh] max-w-[1320px] items-center gap-14 px-5 pb-10 pt-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
      <div>
        <Revelar>
          <span className="hub-selo">Em preparação</span>
        </Revelar>
        <Revelar atraso={0.06}>
          <h1 className="hub-display mt-6 text-[48px] font-extrabold leading-[1.02] sm:text-[64px]">
            {area.nome}
            <span className="hub-italico">.</span>
          </h1>
        </Revelar>
        <Revelar atraso={0.12}>
          <p className="mt-5 max-w-[460px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Esta área ainda está sendo preparada pela equipe da Athos.</p>
        </Revelar>
        <Revelar atraso={0.18}>
          <button type="button" onClick={() => navigate("/hub")} className="hub-botao hub-botao-fantasma mt-10">
            <ArrowLeft size={16} /> Voltar ao início
          </button>
        </Revelar>
      </div>
      <Revelar atraso={0.1} className="relative mx-auto hidden w-full max-w-[400px] lg:block">
        <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.16), transparent 60%)" }} />
        <Mosaico colunas={5} linhas={5} degraus={2} className="relative" />
      </Revelar>
    </section>
  );
}
