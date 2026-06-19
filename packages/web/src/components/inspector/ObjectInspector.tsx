import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ModelNode, InputSource, SchemaField } from "@mc/okf";
import { SchemaEditor } from "./SchemaEditor";
import { InputSourceIcon, OutputSchemaIcon } from "../../lib/icons";

const INPUT_SOURCES: InputSource[] = ["SQL", "CONNECTOR", "VIEW", "TABLE"];

const DEFINITION_HINT: Record<InputSource, { label: string; placeholder: string }> = {
  SQL: { label: "SQL query", placeholder: "SELECT … FROM `project.dataset.table`" },
  VIEW: { label: "View definition (SQL)", placeholder: "SELECT … FROM …" },
  TABLE: { label: "Table reference", placeholder: "project.dataset.table" },
  CONNECTOR: { label: "Connector details", placeholder: "Configured in OWOX after creation" },
};

function usDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

interface ObjectInspectorProps {
  node: ModelNode;
  onUpdate: (patch: Partial<ModelNode>) => void;
}

export function ObjectInspector({ node, onUpdate }: ObjectInspectorProps) {
  const isCreated = node.status === "created";
  const [defOpen, setDefOpen] = useState(false);
  const defHint = DEFINITION_HINT[node.inputSource];

  const statusClass = isCreated
    ? "bg-[#ecfdf5] text-[#047857]"
    : "bg-[#f1f5f9] text-[#475569]";
  const statusText = isCreated
    ? `✓ Created in OWOX · id ${node.owoxId ?? ""}`
    : "◷ Draft — will be created on Push";

  return (
    <div className="flex flex-col gap-[15px]">
      {/* Status pill */}
      <div className={`text-[12px] px-[11px] py-[9px] rounded-lg flex items-center gap-2 ${statusClass}`}>
        {statusText}
      </div>

      {/* Title */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Title
        </label>
        <input
          type="text"
          value={node.title}
          onChange={e => onUpdate({ title: e.target.value })}
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0fe]"
        />
      </div>

      {/* Input source */}
      <div>
        <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          <InputSourceIcon size={13} className="text-slate-400" />
          Input source
          <span
            className="w-[14px] h-[14px] rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold inline-flex items-center justify-center cursor-help normal-case tracking-normal"
            title="How this Data Mart gets its data. New marts default to SQL; can also be Connector, View or Table."
          >
            i
          </span>
        </label>
        <select
          value={node.inputSource}
          onChange={e => onUpdate({ inputSource: e.target.value as InputSource })}
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0fe]"
        >
          {INPUT_SOURCES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Definition (collapsible, optional) */}
      <div className="border border-[#d8dee8] rounded-lg overflow-hidden">
        <button
          onClick={() => setDefOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc]"
        >
          {defOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] flex-1">Definition</span>
          <span className="text-[11px] text-slate-400">{node.definition?.trim() ? "set" : "optional"}</span>
        </button>
        {defOpen && (
          <div className="px-3 pb-3 pt-1 border-t border-[#eef1f5]">
            <label className="block text-[11px] text-slate-500 mb-[5px]">{defHint.label}</label>
            <textarea
              value={node.definition ?? ""}
              onChange={e => onUpdate({ definition: e.target.value })}
              placeholder={defHint.placeholder}
              rows={4}
              className="w-full text-[12px] font-mono px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 resize-y min-h-[64px] focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0fe]"
            />
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Description
        </label>
        <textarea
          value={node.description ?? ""}
          onChange={e => onUpdate({ description: e.target.value })}
          rows={3}
          className="w-full text-[13px] px-[10px] py-2 border border-[#d8dee8] rounded-lg text-slate-900 resize-y min-h-[60px] focus:outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef0fe]"
        />
      </div>

      {/* Output schema */}
      <div>
        <label className="flex items-center gap-[5px] text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          <OutputSchemaIcon size={13} className="text-slate-400" />
          Output schema
          <span
            className="w-[14px] h-[14px] rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold inline-flex items-center justify-center cursor-help normal-case tracking-normal"
            title="Fields this Data Mart outputs. Set the data type and mark primary keys — these are pushed to the mart schema."
          >
            i
          </span>
        </label>
        <SchemaEditor
          schema={node.schema}
          onChange={schema => onUpdate({ schema: schema as SchemaField[] })}
        />
      </div>

      {/* Details */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.3px] mb-[6px]">
          Details
        </label>
        {isCreated ? (
          <div className="text-[12px] text-slate-500 flex flex-col gap-1 p-[2px]">
            <span>Created: <strong className="text-slate-900 font-semibold">{usDate(node.createdAt)}</strong></span>
            <span>By: <strong className="text-slate-900 font-semibold">{node.createdBy ?? "—"}</strong></span>
            <span>OWOX id: <strong className="text-slate-900 font-semibold">{node.owoxId ?? "—"}</strong></span>
          </div>
        ) : (
          <div className="text-[12px] text-slate-400 italic p-[2px]">
            Created date and author appear after Push.
          </div>
        )}
      </div>
    </div>
  );
}
