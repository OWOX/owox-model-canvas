import { useState } from "react";
import type { ModelGraph } from "@mc/okf";

interface TemplateApplyDialogProps {
  graph: ModelGraph;
  name: string;
  onConfirm: (mode: "replace" | "merge") => void;
  onClose: () => void;
}

// Shown when "Use" is clicked on a template while the canvas already has content.
// Mirrors the OKF / OWOX import dialogs: choose Replace vs Merge and see how many
// marts and relationships will be added before committing.
export function TemplateApplyDialog({ graph, name, onConfirm, onClose }: TemplateApplyDialogProps) {
  const [mode, setMode] = useState<"replace" | "merge">("replace");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-[440px] max-w-[95vw] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">Add “{name}” to the canvas</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <p className="text-[13px] text-slate-600 -mt-1">
          Your canvas already has content. Choose how to apply this template.
        </p>

        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-[12px] font-medium text-slate-500">When applying to the canvas</span>
          {(["replace", "merge"] as const).map(m => (
            <label key={m} className="flex items-center gap-2 text-[13px] text-slate-800 cursor-pointer">
              <input type="radio" name="template-mode" checked={mode === m} onChange={() => setMode(m)} />
              {m === "replace" ? "Replace the canvas" : "Merge into the canvas"}
            </label>
          ))}
          <p className="text-[12px] text-slate-500">
            Will import {graph.nodes.length} marts, {graph.edges.length} relationships.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-4 py-[7px] cursor-pointer hover:bg-[#f1f3f7]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mode)}
            className="text-[13px] font-[550] bg-[#1e88e5] text-white border border-[#1e88e5] rounded-lg px-4 py-[7px] cursor-pointer hover:bg-[#1976d2]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
