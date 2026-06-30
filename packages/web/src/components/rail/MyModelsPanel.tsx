import { useState } from "react";
import { Save, Pencil, Trash2 } from "lucide-react";
import type { SavedModel } from "../../lib/models";

export function MyModelsPanel({
  models,
  currentModelId,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: {
  models: SavedModel[];
  currentModelId: string | null;
  onOpen(id: string): void;
  onNew(): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
}) {
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  function commitRename() {
    if (!renaming) return;
    onRename(renaming.id, renaming.value.trim() || "Untitled model");
    setRenaming(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Saves perk header */}
      <div className="flex items-center gap-3 rounded-lg border border-[#d8dee8] px-3 py-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#e6f1fb] text-[#1e88e5]">
          <Save size={16} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-slate-900">Saves</div>
          <div className="text-[12px] text-slate-500">Keep your models and reopen them anytime</div>
        </div>
      </div>

      {/* New model button */}
      <button
        onClick={onNew}
        className="w-full rounded-lg bg-[#1e88e5] px-4 py-2.5 text-[14px] font-[550] text-white hover:bg-[#1976d2] cursor-pointer"
      >
        New model
      </button>

      {/* Model list */}
      <div className="flex flex-col gap-1.5">
        {models.length === 0 && (
          <p className="py-8 text-center text-[13px] text-slate-400">
            No saved models yet. Build one and hit{" "}
            <span className="font-medium text-slate-600">Save</span>.
          </p>
        )}
        {models.map(m => (
          <div
            key={m.id}
            className="group flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 hover:border-[#e6e9f0] hover:bg-[#f7f8fa]"
          >
            {renaming?.id === m.id ? (
              <input
                autoFocus
                value={renaming.value}
                onChange={e => setRenaming({ id: m.id, value: e.target.value })}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === "Enter") { commitRename(); }
                  if (e.key === "Escape") { setRenaming(null); }
                }}
                className="flex-1 rounded-md border border-[#1e88e5] px-2 py-1 text-[14px] outline-none"
              />
            ) : (
              <button
                onClick={() => onOpen(m.id)}
                className="flex-1 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-[550] text-slate-900">{m.name}</span>
                  {m.id === currentModelId && (
                    <span className="rounded-full bg-[#e6f1fb] px-2 py-0.5 text-[11px] font-medium text-[#1e88e5]">
                      current
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-slate-400">
                  Updated {new Date(m.updated_at).toLocaleString()}
                </div>
              </button>
            )}
            <button
              aria-label={`Rename ${m.name}`}
              onClick={() => setRenaming({ id: m.id, value: m.name })}
              className="rounded-md p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-[#f1f3f7] hover:text-slate-700 cursor-pointer"
            >
              <Pencil size={15} />
            </button>
            <button
              aria-label={`Delete ${m.name}`}
              onClick={() => onDelete(m.id)}
              className="rounded-md p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
