import type { ReactNode } from "react";
import { PanelRight, Clock, Share2 } from "lucide-react";
import type { RightPanelId } from "./useRightPanel";

const ModelsGlyph = ({ size = 20 }: { size?: number }) => (
  // OWOX Model Canvas favicon — hub-and-spoke, drawn in currentColor for the rail
  <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth={4.5} strokeLinecap="round">
      <line x1="24" y1="24" x2="24" y2="9" /><line x1="24" y1="24" x2="38" y2="19.5" />
      <line x1="24" y1="24" x2="33" y2="36" /><line x1="24" y1="24" x2="15" y2="36" />
      <line x1="24" y1="24" x2="10" y2="19.5" />
    </g>
    <g fill="currentColor">
      <circle cx="24" cy="9" r="5" /><circle cx="38" cy="19.5" r="5" /><circle cx="33" cy="36" r="5" />
      <circle cx="15" cy="36" r="5" /><circle cx="10" cy="19.5" r="5" /><circle cx="24" cy="24" r="6" />
    </g>
  </svg>
);

const ITEMS: { id: RightPanelId; label: string; icon: ReactNode }[] = [
  { id: "inspect", label: "Inspect", icon: <PanelRight size={20} /> },
  { id: "models", label: "My Models", icon: <ModelsGlyph /> },
  { id: "history", label: "History", icon: <Clock size={20} /> },
  { id: "share", label: "Share", icon: <Share2 size={20} /> },
];

export function RightRail({ active, onOpen, signedIn, highlightId }: {
  active: RightPanelId | null; onOpen: (id: RightPanelId) => void; signedIn: boolean;
  highlightId?: RightPanelId | null;
}) {
  void signedIn; // reserved for sign-in-gated affordances in later tasks
  return (
    <nav className="w-[74px] flex-shrink-0 border-l border-[#d8dee8] bg-[#fafafa] flex flex-col items-center gap-1 py-[14px] px-[6px] z-20">
      {ITEMS.map(it => {
        const on = it.id === (highlightId ?? active);
        return (
          <button
            key={it.id}
            onClick={() => onOpen(it.id)}
            aria-current={on ? "true" : undefined}
            className={`w-full flex flex-col items-center gap-1 py-[9px] px-1 rounded-lg text-[11px] font-medium border ${
              on ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)] border-[#d8dee8]"
                 : "border-transparent text-slate-500 hover:bg-[#f1f3f7] hover:text-slate-900"}`}
          >
            {it.icon}{it.label}
          </button>
        );
      })}
    </nav>
  );
}
