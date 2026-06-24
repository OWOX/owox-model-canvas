import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { filesToGraph, parsePastedMarkdown, zipToFiles } from "../okf/io";
import type { ModelGraph } from "@mc/okf";

interface ImportDialogProps {
  onConfirm: (graph: ModelGraph, mode: "replace" | "merge") => void;
  onClose: () => void;
}

export function ImportDialog({ onConfirm, onClose }: ImportDialogProps) {
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ModelGraph | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy the AI authoring guide to the clipboard so the user can paste it into
  // Claude/ChatGPT to generate an importable OKF model. Falls back to opening
  // the raw guide if the clipboard is blocked.
  async function copyInstructions() {
    try {
      const md = await fetch("/okf-format.md").then(r => r.text());
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open("/okf-format.md", "_blank");
    }
  }

  // Parse the current inputs into a ModelGraph (pending nodes — OKF carries no
  // OWOX identity). Throws on empty/invalid input.
  async function buildGraph(paste: string): Promise<ModelGraph> {
    let files: Record<string, string> = {};
    const uploaded = fileInputRef.current?.files;
    if (uploaded && uploaded.length > 0) {
      for (const file of Array.from(uploaded)) {
        if (file.name.endsWith(".zip")) {
          Object.assign(files, zipToFiles(new Uint8Array(await file.arrayBuffer())));
        } else {
          files[file.name] = await file.text();
        }
      }
    }
    if (paste.trim()) files = { ...files, ...parsePastedMarkdown(paste.trim()) };
    if (Object.keys(files).length === 0) throw new Error("Provide a file or paste markdown content.");
    const graph = filesToGraph(files);
    return { ...graph, nodes: graph.nodes.map(n => ({ ...n, status: "pending" as const, owoxId: null })) };
  }

  // Re-parse to drive the live preview/count. Empty input clears both; a parse
  // error is shown (and clears the preview) so the count never lies.
  async function refresh(paste: string) {
    const hasInput = (fileInputRef.current?.files?.length ?? 0) > 0 || paste.trim().length > 0;
    if (!hasInput) { setPreview(null); setError(null); return; }
    try { setPreview(await buildGraph(paste)); setError(null); }
    catch (e) { setPreview(null); setError((e as Error).message ?? "Failed to parse OKF bundle."); }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-w-[95vw] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">Import OKF bundle</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* Generate a model with AI: copy the authoring guide → paste into
            Claude/ChatGPT. The raw guide also lives at /okf-format.md so an
            assistant can fetch it directly. */}
        <div className="-mt-1 flex flex-col gap-1.5 rounded-lg border border-[#e6e9f0] bg-[#f7f8fa] px-3 py-2.5">
          <span className="text-[12.5px] text-slate-600">No model yet? Generate one with AI:</span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={copyInstructions}
              className="flex items-center gap-[6px] rounded-lg bg-[#1e88e5] px-3 py-[6px] text-[12.5px] font-[550] text-white hover:bg-[#1976d2]"
            >
              {copied ? <><Check size={14} /> Copied — paste into Claude</> : <><Copy size={14} /> Copy AI instructions</>}
            </button>
            <a
              href="/ai-instructions.html"
              target="_blank"
              rel="noopener"
              className="text-[12.5px] text-[#1e88e5] hover:text-[#1976d2] underline underline-offset-2"
            >
              View guide ↗
            </a>
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-[13px] font-medium text-slate-700 mb-1">
            Upload .md / .txt / .zip files
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.zip"
            multiple
            onChange={() => void refresh(pasteText)}
            className="block w-full text-[13px] text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-[#d8dee8] file:bg-white file:text-[13px] file:font-medium file:cursor-pointer hover:file:bg-[#f1f3f7]"
          />
        </div>

        {/* Paste area */}
        <div>
          <label className="block text-[13px] font-medium text-slate-700 mb-1">
            Or paste markdown content
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); void refresh(e.target.value); }}
            placeholder={"<!-- path/to/file.md -->\n...content..."}
            rows={6}
            className="w-full text-[13px] font-mono border border-[#d8dee8] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e88e5]"
          />
        </div>

        {error && (
          <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Apply mode + count — mirrors the OWOX-import dialog */}
        {preview && (
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
            <span className="text-[12px] font-medium text-slate-500">When applying to the canvas</span>
            {(["replace", "merge"] as const).map(m => (
              <label key={m} className="flex items-center gap-2 text-[13px] text-slate-800 cursor-pointer">
                <input type="radio" name="okf-mode" checked={mode === m} onChange={() => setMode(m)} />
                {m === "replace" ? "Replace the canvas" : "Merge into the canvas"}
              </label>
            ))}
            <p className="text-[12px] text-slate-500">
              Will import {preview.nodes.length} marts, {preview.edges.length} relationships.
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-4 py-[7px] cursor-pointer hover:bg-[#f1f3f7]"
          >
            Cancel
          </button>
          <button
            onClick={() => preview && onConfirm(preview, mode)}
            disabled={!preview}
            className="text-[13px] font-[550] bg-[#1e88e5] text-white border border-[#1e88e5] rounded-lg px-4 py-[7px] cursor-pointer hover:bg-[#1976d2] disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
