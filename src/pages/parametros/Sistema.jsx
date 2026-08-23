import { ListTree, GitBranch, SlidersHorizontal } from "lucide-react";
import PageHeader from "../../components/PageHeader.jsx";
import FeaturePreviewCard from "../../components/FeaturePreviewCard.jsx";

const ITEMS = [
  {
    icon: ListTree,
    title: "Plano gerencial",
    description: "Estrutura de códigos, contas e demonstrativos usada por todas as empresas.",
    to: "/parametros/sistema/plano-gerencial",
  },
  {
    icon: GitBranch,
    title: "Estrutura e regras da DFC",
    description: "Linhas da DFC direta e as regras que classificam cada movimento de caixa.",
  },
];

export default function Sistema() {
  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros gerais"
        title="Configurações do sistema"
        description="Regras e estruturas compartilhadas por todas as empresas do portal."
        icon={SlidersHorizontal}
      />

      <div className="flex flex-col gap-3">
        {ITEMS.map((item) => (
          <FeaturePreviewCard key={item.title} {...item} />
        ))}
      </div>
    </div>
  );
}
