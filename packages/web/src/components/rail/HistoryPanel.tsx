import { Clock, GitCompare, RotateCcw } from "lucide-react";
import type { ModelVersion } from "../../lib/models";

export function HistoryPanel({
  versions,
  onCompare,
  onRestore,
  signedIn,
}: {
  versions: ModelVersion[];
  onCompare(id: string): void;
  onRestore(id: string): void;
  signedIn: boolean;
}) {
  void signedIn; // reserved for future signed-out state handling

  return (
    <div className="flex flex-col gap-5">
      {/* Perk description header */}
      <div className="flex items-center gap-3 rounded-lg border border-[#d8dee8] px-3 py-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#e6f1fb] text-[#1e88e5]">
          <Clock size={16} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-slate-900">Version history</div>
          <div className="text-[12px] text-slate-500">Snapshot every save; compare and restore</div>
        </div>
      </div>

      {/* Current canvas row */}
      <div className="flex items-center justify-between rounded-lg border border-[#d8dee8] px-3 py-2.5">
        <span className="text-[13px] font-[550] text-slate-900">Current</span>
        {versions.length > 0 && (
          <button
            onClick={() => onCompare(versions[0].id)}
            className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#1e88e5] cursor-pointer"
          >
            <GitCompare size={13} /> Compare
          </button>
        )}
      </div>

      {/* Version list */}
      <div className="flex flex-col gap-1">
        {versions.length === 0 && (
          <p className="py-6 text-center text-[13px] text-slate-400">
            No versions yet — Save to snapshot one.
          </p>
        )}
        {versions.map((v, i) => (
          <div key={v.id} className="group rounded-lg px-2 py-1.5 hover:bg-[#f7f8fa]">
            <div className="text-[13px] font-[550] text-slate-800">
              {i === 0 ? "Latest" : `Version ${versions.length - i}`}
            </div>
            <div className="text-[11px] text-slate-400">
              {new Date(v.created_at).toLocaleString()}
            </div>
            <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => onCompare(v.id)}
                className="flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-[#1e88e5] cursor-pointer"
              >
                <GitCompare size={13} /> Compare
              </button>
              <button
                onClick={() => onRestore(v.id)}
                className="flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-[#1e88e5] cursor-pointer"
              >
                <RotateCcw size={13} /> Restore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
