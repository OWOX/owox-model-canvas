import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { RightPanelId } from "./useRightPanel";

export function ModelSheet({ active, title, onClose, children }: {
  active: RightPanelId | null; title: string; onClose: () => void; children: ReactNode;
}) {
  if (!active) return null;
  return (
    <>
      {/* overlay covers the canvas, NOT the rail (rail sits to the right of this) */}
      <div className="absolute inset-0 bg-black/50 z-[15]" onClick={onClose} />
      <aside
        role="dialog" aria-label={title}
        className="absolute top-0 bottom-0 right-[74px] w-[560px] max-w-[calc(100%-74px)] bg-white border-l border-[#d8dee8]
                   shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] z-[16] flex flex-col"
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-[#d8dee8]">
          <h2 className="m-0 text-[17px] font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-[30px] h-[30px] flex items-center justify-center rounded-md text-slate-500 hover:bg-[#f1f3f7]">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </aside>
    </>
  );
}
