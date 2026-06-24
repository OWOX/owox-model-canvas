import { X, Rocket, Plus, Download, ExternalLink } from "lucide-react";
import type { ModelGraph } from "@mc/okf";
import { TEMPLATES } from "../templates";
import { LibraryIcon } from "../lib/icons";
import { IMPORT_GUIDE_URL } from "../lib/links";

interface Props {
  /** Roll a template onto the canvas. */
  onUseTemplate: (graph: ModelGraph, name: string) => void;
  /** Dismiss and start from an empty canvas. */
  onStartBlank: () => void;
  /** Open the OKF import flow. */
  onImport: () => void;
}

// First-screen chooser shown to brand-new visitors: pick a template (value
// first), start blank, or import an existing model. Dismissing (X / backdrop)
// is treated as "start blank".
export function WelcomeDialog({ onUseTemplate, onStartBlank, onImport }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onStartBlank}>
      <div
        className="w-[640px] max-h-[88vh] flex flex-col rounded-2xl border border-[#d8dee8] bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-[#e6e9f0] flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.2px]">Start your data model</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              Pick a template to explore, start from a blank canvas, or import an existing model.
              It's free — no sign-in needed.
            </p>
          </div>
          <button onClick={onStartBlank} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        {/* Templates */}
        <div className="overflow-y-auto px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <LibraryIcon size={14} className="text-[#1e88e5]" /> Start from a template
          </div>
          {TEMPLATES.map(t => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[#e2e6ec] px-4 py-3 hover:bg-[#f8fafc]">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold">{t.name}</div>
                <div className="text-[12px] text-slate-500 truncate">{t.description}</div>
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">{t.graph.nodes.length} marts · {t.graph.edges.length} links</span>
              <button
                onClick={() => onUseTemplate(structuredClone(t.graph), t.name)}
                title={`Roll out the ${t.name} model`}
                className="flex items-center gap-[6px] rounded-lg bg-[#1e88e5] px-3 py-[6px] text-[12px] font-semibold text-white hover:bg-[#1976d2] whitespace-nowrap"
              >
                <Rocket size={13} /> Use
              </button>
            </div>
          ))}
        </div>

        {/* Footer: start blank / import */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-[#e6e9f0] flex-shrink-0">
          <button
            onClick={onStartBlank}
            className="flex items-center gap-[7px] text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[8px] cursor-pointer hover:bg-[#f1f3f7]"
          >
            <Plus size={15} /> Start blank
          </button>
          <button
            onClick={onImport}
            className="flex items-center gap-[7px] text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[8px] cursor-pointer hover:bg-[#f1f3f7]"
          >
            <Download size={15} /> Import OKF
          </button>
          <div className="flex-1" />
          <a
            href={IMPORT_GUIDE_URL}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-[5px] text-[12.5px] font-[550] text-[#1e88e5] hover:underline"
          >
            Import guide <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
