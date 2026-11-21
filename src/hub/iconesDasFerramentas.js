import { ArrowLeftRight, BarChart3, Gauge, PackageCheck, Percent, Receipt, Target, Wrench } from "lucide-react";

// O ícone de cada ferramenta (lib/modulos.js), o mesmo no hub e no menu do B.I.
const ICONES = { orcamento: Target, "carga-tributaria": Percent, "analise-desempenho": Gauge, "entradas-saidas": ArrowLeftRight, "dre-gerencial": BarChart3, "revisa-nota": PackageCheck, "apuracao-icms": Receipt };

export const iconeDaFerramenta = (id) => ICONES[id] || Wrench;
