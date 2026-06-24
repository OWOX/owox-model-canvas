import { useEffect, useState, useCallback } from "react";
import { Sparkles } from "lucide-react";
import type { ModelNode, ModelEdge } from "@mc/okf";
import type { BusinessGoal } from "../../state/goal";
import { buildFocus, getQuestions, AiLimitError, type InsightQuestion } from "../../lib/questions";

interface QuestionsPanelProps {
  node: ModelNode;
  nodes: ModelNode[];
  edges: ModelEdge[];
  goal: BusinessGoal | null;
  onEditGoal: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; questions: InsightQuestion[] }
  | { kind: "limit" }
  | { kind: "error" };

export function QuestionsPanel({ node, nodes, edges, goal, onEditGoal }: QuestionsPanelProps) {
  const [state, setState] = useState<State>({ kind: "idle" });

  // Reset to idle whenever the selected mart changes. We NEVER auto-generate —
  // every generation is a paid Gemini call, so it only ever fires on an explicit
  // button click (selecting marts while exploring must cost nothing).
  useEffect(() => { setState({ kind: "idle" }); }, [node.key]);

  const isEmpty = node.schema.length === 0 && !node.description?.trim();

  const generate = useCallback(async (force: boolean) => {
    if (!goal) return;
    setState({ kind: "loading" });
    try {
      const focus = buildFocus(nodes, edges, node.key);
      const questions = await getQuestions(focus, goal, { force });
      setState({ kind: "ready", questions });
    } catch (e) {
      setState({ kind: e instanceof AiLimitError ? "limit" : "error" });
    }
  }, [goal, nodes, edges, node.key]);

  const primaryBtn = "w-full text-[13px] font-[550] bg-[#1e88e5] text-white rounded-lg px-4 py-2 cursor-pointer hover:bg-[#1976d2] flex items-center justify-center gap-[6px]";

  return (
    <div className="mt-4 pt-4 border-t border-[#d8dee8]">
      <div className="flex items-center gap-2 mb-[10px]">
        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] flex-1">Questions this unlocks</h4>
        {state.kind === "ready" && (
          <button onClick={() => void generate(true)} className="text-[11px] text-[#1e88e5] hover:underline cursor-pointer">
            Regenerate
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="text-[12px] text-slate-400 italic">Add fields or a description to this mart to unlock questions.</div>
      ) : (
        <>
          {/* CTA — no Gemini call until the user explicitly clicks */}
          {state.kind === "idle" && (
            goal ? (
              <button onClick={() => void generate(false)} className={primaryBtn}>
                <Sparkles size={15} /> Generate based on business goal
              </button>
            ) : (
              <button onClick={onEditGoal} className={primaryBtn}>
                <Sparkles size={15} /> Set business goal &amp; generate
              </button>
            )
          )}
          {state.kind === "loading" && (
            <div className="text-[12px] text-slate-400 italic">Generating questions…</div>
          )}
          {state.kind === "limit" && (
            <div className="text-[12px] text-slate-500">
              Ooops! The free AI API limit has been reached for today. Try again later.{" "}
              {goal && <button onClick={() => void generate(true)} className="text-[#1e88e5] hover:underline cursor-pointer">Retry</button>}
            </div>
          )}
          {state.kind === "error" && (
            <div className="text-[12px] text-slate-500">
              Couldn't generate questions.{" "}
              {goal && <button onClick={() => void generate(true)} className="text-[#1e88e5] hover:underline cursor-pointer">Try again</button>}
            </div>
          )}
          {state.kind === "ready" && (
            <ul className="flex flex-col gap-[10px]">
              {state.questions.map((q, i) => (
                <li key={i} className="text-[13px] text-slate-900 leading-[1.45]">
                  {q.question}
                  <span className="block text-[11px] text-slate-400 mt-[2px]">unlocked by {q.unlockedBy}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Niche/goal hint — always links to the Business Goal settings */}
          <p className="text-[11px] text-slate-500 leading-[1.45] mt-3">
            {goal ? (
              <>
                Based on niche <span className="font-semibold text-slate-700">{goal.niche}</span> → goal{" "}
                <span className="font-semibold text-slate-700">{goal.goal}</span>.{" "}
                <button onClick={onEditGoal} className="text-[#1e88e5] hover:underline cursor-pointer">Edit</button>
              </>
            ) : (
              // The prominent CTA above already opens the goal dialog — no second link here.
              <>Questions are generated from your business niche &amp; goal.</>
            )}
          </p>

          <p className="text-[10.5px] text-slate-400 leading-[1.4] mt-2">
            Generated by Google Gemini from mart titles, descriptions and field names. Row-level data is never sent.
          </p>
        </>
      )}
    </div>
  );
}
