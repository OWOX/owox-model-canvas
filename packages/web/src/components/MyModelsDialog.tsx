import { useEffect, useState } from "react";
import { Trash2, Pencil, FolderOpen } from "lucide-react";
import type { ModelGraph } from "@mc/okf";
import { listModels, loadModel, updateModel, deleteModel, type SavedModel } from "../lib/models";

export function MyModelsDialog({ onOpen, onClose }: { onOpen: (graph: ModelGraph, id: string, name: string) => void; onClose: () => void }) {
  const [models, setModels] = useState<SavedModel[] | null>(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  async function refresh() {
    try { setModels(await listModels()); }
    catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { void refresh(); }, []);

  async function open(id: string, name: string) {
    setBusyId(id); setErr("");
    try { onOpen(await loadModel(id), id, name); onClose(); }
    catch (e) { setErr((e as Error).message); setBusyId(null); }
  }
  async function remove(id: string) {
    setBusyId(id); setErr("");
    try { await deleteModel(id); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyId(null); }
  }
  async function commitRename() {
    if (!renaming) return;
    const { id, name } = renaming;
    setRenaming(null);
    try { await updateModel(id, { name: name.trim() || "Untitled model" }); await refresh(); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[520px] max-h-[80vh] overflow-y-auto rounded-2xl border border-[#d8dee8] bg-white p-7 shadow-xl" onClick={e => e.stopPropagation()}>
        <h1 className="text-lg font-semibold">My models</h1>
        <p className="mt-1 text-[13px] text-slate-500">Open a saved model, or manage your library.</p>

        {err && <p className="mt-3 text-[12.5px] text-red-600">{err}</p>}

        <div className="mt-5 flex flex-col gap-1.5">
          {models === null && <p className="py-6 text-center text-[13px] text-slate-400">Loading…</p>}
          {models?.length === 0 && (
            <p className="py-8 text-center text-[13px] text-slate-400">No saved models yet. Build one and hit <span className="font-medium text-slate-600">Save</span>.</p>
          )}
          {models?.map(m => (
            <div key={m.id} className="group flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 hover:border-[#e6e9f0] hover:bg-[#f7f8fa]">
              {renaming?.id === m.id ? (
                <input
                  autoFocus
                  value={renaming.name}
                  onChange={e => setRenaming({ id: m.id, name: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === "Enter") void commitRename(); if (e.key === "Escape") setRenaming(null); }}
                  className="flex-1 rounded-md border border-[#1e88e5] px-2 py-1 text-[14px] outline-none"
                />
              ) : (
                <button onClick={() => open(m.id, m.name)} disabled={busyId === m.id} className="flex-1 text-left cursor-pointer disabled:opacity-50">
                  <div className="text-[14px] font-[550] text-slate-900">{m.name}</div>
                  <div className="text-[12px] text-slate-400">Updated {new Date(m.updated_at).toLocaleString()}</div>
                </button>
              )}
              <button title="Open" onClick={() => open(m.id, m.name)} disabled={busyId === m.id} className="rounded-md p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-[#e6f1fb] hover:text-[#1e88e5] cursor-pointer"><FolderOpen size={16} /></button>
              <button title="Rename" onClick={() => setRenaming({ id: m.id, name: m.name })} className="rounded-md p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-[#f1f3f7] hover:text-slate-700 cursor-pointer"><Pencil size={15} /></button>
              <button title="Delete" onClick={() => remove(m.id)} disabled={busyId === m.id} className="rounded-md p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-5 w-full text-[13px] text-slate-500 hover:text-slate-800 cursor-pointer">Close</button>
      </div>
    </div>
  );
}
