import { useRef, useState } from "react";
import { filesToGraph, parsePastedMarkdown, zipToFiles } from "../okf/io";
import type { ModelGraph } from "@mc/okf";

interface ImportDialogProps {
  onConfirm: (graph: ModelGraph) => void;
  onClose: () => void;
}

export function ImportDialog({ onConfirm, onClose }: ImportDialogProps) {
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleConfirm() {
    setError(null);
    try {
      let files: Record<string, string> = {};

      // Collect uploaded files (.zip bundles are unpacked; everything else is read as text)
      const uploadedFiles = fileInputRef.current?.files;
      if (uploadedFiles && uploadedFiles.length > 0) {
        for (const file of Array.from(uploadedFiles)) {
          if (file.name.endsWith(".zip")) {
            const buf = new Uint8Array(await file.arrayBuffer());
            Object.assign(files, zipToFiles(buf));
          } else {
            const text = await file.text();
            files[file.name] = text;
          }
        }
      }

      // Merge pasted text (takes precedence if both supplied)
      if (pasteText.trim()) {
        const pasted = parsePastedMarkdown(pasteText.trim());
        files = { ...files, ...pasted };
      }

      if (Object.keys(files).length === 0) {
        setError("Provide a file or paste markdown content.");
        return;
      }

      const graph = filesToGraph(files);

      // Mark all imported nodes as pending (not yet in OWOX)
      const markedGraph: ModelGraph = {
        ...graph,
        nodes: graph.nodes.map((n) => ({ ...n, status: "pending" as const, owoxId: null })),
      };

      onConfirm(markedGraph);
    } catch (e) {
      setError((e as Error).message ?? "Failed to parse OKF bundle.");
    }
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

        <a
          href="/ai-instructions.html"
          target="_blank"
          rel="noopener"
          className="text-[13px] text-indigo-600 hover:text-indigo-700 underline underline-offset-2 -mt-1"
        >
          Instructions for AI — how to generate an OKF model ↗
        </a>

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
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"<!-- path/to/file.md -->\n...content..."}
            rows={6}
            className="w-full text-[13px] font-mono border border-[#d8dee8] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && (
          <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-4 py-[7px] cursor-pointer hover:bg-[#f1f3f7]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="text-[13px] font-[550] bg-[#4f46e5] text-white border border-[#4f46e5] rounded-lg px-4 py-[7px] cursor-pointer hover:bg-[#4338ca]"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
