import { TriangleAlert, X } from "lucide-react";
import { setData } from "../data/useStore.js";
import { useAppState } from "../data/useStore.js";

// Aviso fixo quando a última gravação falhou. Antes várias telas (ex.: Vínculo DFC) mostravam a mudança como feita e a gravação falhava em
// silêncio — a pessoa recarregava e o trabalho tinha sumido. Some sozinho quando uma gravação seguinte dá certo.
export default function SaveErrorBanner() {
  const state = useAppState();
  if (!state.saveError) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex items-start gap-3 bg-danger-600 px-4 py-2.5 text-[13px] text-white shadow-lg">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">
        <b>Sua última alteração NÃO foi salva.</b> Não recarregue a página ainda: tente a alteração de novo (se persistir, copie o que mudou e recarregue com F5). Motivo: {state.saveError.message}
      </p>
      <button type="button" onClick={() => setData({ saveError: null })} aria-label="Fechar aviso" className="shrink-0 rounded p-1 hover:bg-white/20"><X size={14} /></button>
    </div>
  );
}
