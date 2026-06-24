import { useState } from "react";
import { ChevronRight, ChevronDown, X, Rocket } from "lucide-react";
import type { ModelGraph } from "@mc/okf";
import { TEMPLATES, type Template } from "../templates";
import { DataMartIcon, JoinIcon, LibraryIcon } from "../lib/icons";

interface Props {
  onUse: (graph: ModelGraph, name: string) => void;
  onClose: () => void;
}

export function LibraryDialog({ onUse, onClose }: Props) {
  const [openId, setOpenId] = useState<string | null>(TEMPLATES[0]?.id ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-[620px] max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-[#d8dee8] bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#d8dee8] flex-shrink-0">
          <LibraryIcon size={18} className="text-[#1e88e5]" />
          <h2 className="text-[15px] font-semibold flex-1">Template library</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
          {TEMPLATES.map(t => (
            <TemplateRow
              key={t.id}
              template={t}
              open={openId === t.id}
              onToggle={() => setOpenId(openId === t.id ? null : t.id)}
              onUse={() => onUse(structuredClone(t.graph), t.name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateRow({ template, open, onToggle, onUse }: { template: Template; open: boolean; onToggle: () => void; onUse: () => void }) {
  const { nodes, edges } = template.graph;
  return (
    <div className="shrink-0 rounded-xl border border-[#e2e6ec] overflow-hidden">
      <div onClick={onToggle} role="button" className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8fafc] text-left cursor-pointer">
        {open ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate">{template.name}</div>
          <div className="text-[12px] text-slate-500 truncate">{template.description}</div>
        </div>
        <span className="text-[11px] text-slate-500 whitespace-nowrap flex-shrink-0">{nodes.length} marts · {edges.length} links</span>
        <button
          onClick={e => { e.stopPropagation(); onUse(); }}
          title="Roll out this model onto the canvas"
          className="flex items-center gap-[6px] rounded-lg bg-[#1e88e5] px-3 py-[6px] text-[12px] font-semibold text-white hover:bg-[#1976d2] whitespace-nowrap"
        >
          <Rocket size={13} /> Use
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-[#fbfcfe] border-t border-[#eef1f5] overflow-y-auto" style={{ maxHeight: "46vh" }}>
          <div className="flex flex-col gap-1.5 mt-2">
            {nodes.map(n => <MartRow key={n.key} title={n.title} fields={n.schema} />)}
          </div>

          {edges.length > 0 && (
            <div className="mt-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Relationships</div>
              <ul className="flex flex-col gap-1">
                {edges.map(e => {
                  const from = nodes.find(n => n.key === e.from)?.title ?? e.from;
                  const to = nodes.find(n => n.key === e.to)?.title ?? e.to;
                  const cond = e.keys.map(k => `${k.left} = ${k.right}`).join(", ");
                  return (
                    <li key={e.id} className="flex items-center gap-2 text-[12px] text-slate-600">
                      <JoinIcon size={13} className="text-slate-400 flex-shrink-0" />
                      <span><b className="text-slate-800">{from}</b> {e.bidirectional ? "↔" : "→"} <b className="text-slate-800">{to}</b></span>
                      <span className="text-slate-400">·</span>
                      <code className="text-[11px] text-slate-500">{cond}</code>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MartRow({ title, fields }: { title: string; fields: { name: string; type: string; pk: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[#e9edf2] bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc]">
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <DataMartIcon size={14} className="text-slate-500" />
        <span className="text-[13px] font-medium flex-1">{title}</span>
        <span className="text-[11px] text-slate-500">{fields.length} fields</span>
      </button>
      {open && (
        <table className="w-full text-[12px] border-t border-[#eef1f5]">
          <tbody>
            {fields.map(f => (
              <tr key={f.name} className="border-b border-[#f3f5f8] last:border-0">
                <td className="px-3 py-1.5 font-mono text-slate-700">{f.name}</td>
                <td className="px-3 py-1.5 text-slate-500">{f.type}</td>
                <td className="px-3 py-1.5 text-right text-[10.5px] text-[#1e88e5] font-semibold">{f.pk ? "PK" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
