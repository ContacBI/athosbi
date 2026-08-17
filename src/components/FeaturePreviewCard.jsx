import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function FeaturePreviewCard({ icon: Icon, title, description, to }) {
  const navigate = useNavigate();
  const isReady = Boolean(to);
  const Wrapper = isReady ? "button" : "div";

  return (
    <Wrapper
      type={isReady ? "button" : undefined}
      onClick={isReady ? () => navigate(to) : undefined}
      className={`flex w-full items-start gap-3.5 rounded-2xl bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${
        isReady ? "hover:-translate-y-0.5" : ""
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-500">
        <Icon size={19} strokeWidth={1.7} />
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-ink-900">{title}</p>
          {!isReady && (
            <span className="rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning-500">
              Em breve
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-ink-400">{description}</p>
      </div>
      {isReady && <ChevronRight size={16} className="mt-2 shrink-0 text-ink-400" />}
    </Wrapper>
  );
}
