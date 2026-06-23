import { useState } from "react";
import { NICHE_PRESETS, type BusinessGoal, type NichePreset } from "../state/goal";

const DISCLAIMER =
  "Allows you to see potential questions you may answer with these data marts and relationships. " +
  "Mart titles, descriptions and field names are processed by Google Gemini to generate the questions; " +
  "your row-level data is never sent.";

interface GoalDialogProps {
  current: BusinessGoal | null;
  onConfirm: (g: BusinessGoal) => void;
  onClear: () => void;
  onClose: () => void;
}

export function GoalDialog({ current, onConfirm, onClear, onClose }: GoalDialogProps) {
  const initialNiche = NICHE_PRESETS.find(n => n.label === current?.niche) ?? null;
  const [niche, setNiche] = useState<NichePreset | { label: string } | null>(
    initialNiche ?? (current ? { label: current.niche } : null),
  );
  const [goal, setGoal] = useState<string>(current?.goal ?? "");

  const presetGoals = niche && "goals" in niche ? niche.goals : [];
  const canApply = !!niche?.label && goal.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[460px] max-w-[92vw] max-h-[88vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif" }}
      >
        <h3 className="text-[15px] font-[650] text-slate-900 mb-2">Business Goal</h3>
        <p className="text-[12px] text-slate-500 leading-[1.5] mb-4">{DISCLAIMER}</p>

        {/* Step 1 — niche */}
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">Niche</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {NICHE_PRESETS.map(n => (
            <button
              key={n.id}
              onClick={() => { setNiche(n); setGoal(""); }}
              className={`text-[12.5px] text-left px-3 py-2 rounded-lg border ${niche?.label === n.label ? "border-[#4f46e5] bg-[#eef0fe] text-[#4f46e5]" : "border-[#d8dee8] text-slate-900 hover:bg-[#f1f3f7]"}`}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* Step 2 — goal */}
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">Goal</label>
        <div className="flex flex-col gap-2 mb-3">
          {presetGoals.map(g => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`text-[12.5px] text-left px-3 py-2 rounded-lg border ${goal === g ? "border-[#4f46e5] bg-[#eef0fe] text-[#4f46e5]" : "border-[#d8dee8] text-slate-900 hover:bg-[#f1f3f7]"}`}
            >
              {g}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="…or type your own goal"
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0fe] mb-4"
        />

        <div className="flex items-center gap-2">
          <button
            disabled={!canApply}
            onClick={() => canApply && onConfirm({ niche: niche!.label, goal: goal.trim() })}
            className="text-[13px] font-[550] bg-[#4f46e5] text-white rounded-lg px-4 py-[8px] cursor-pointer hover:bg-[#4338ca] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          {current && (
            <button onClick={onClear} className="text-[13px] text-slate-500 px-3 py-[8px] rounded-lg hover:bg-[#f1f3f7]">
              Clear
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-[13px] text-slate-500 px-3 py-[8px] rounded-lg hover:bg-[#f1f3f7]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
