import { useState } from "react";
import { GripVertical } from "lucide-react";
import type { SchemaField } from "@mc/okf";
import { InfoTip } from "./InfoTip";

// Canonical OWOX schema types — the set accepted across storages (BigQuery,
// Snowflake, …). Note: no DATETIME (not in the cross-storage enum).
const FIELD_TYPES = ["STRING", "INTEGER", "FLOAT", "NUMERIC", "BOOLEAN", "DATE", "TIME", "TIMESTAMP", "BYTES", "GEOGRAPHY", "VARIANT"];

interface SchemaEditorProps {
  schema: SchemaField[];
  onChange: (schema: SchemaField[]) => void;
}

export function SchemaEditor({ schema, onChange }: SchemaEditorProps) {
  // Row being dragged and the row it's hovering over — for reordering fields.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function updateField(i: number, patch: Partial<SchemaField>) {
    onChange(schema.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }

  function removeField(i: number) {
    onChange(schema.filter((_, idx) => idx !== i));
  }

  function addField() {
    onChange([...schema, { name: "", type: "STRING", pk: false }]);
  }

  // Move a field from one position to another, preserving the order of the rest.
  function moveField(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = schema.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  // Handle · Name · Type · PK · Alias · Description · remove. Wider than the
  // inspector, so the grid scrolls horizontally inside the bordered box.
  const cols = "16px minmax(110px,1fr) 96px 42px minmax(110px,1fr) minmax(150px,1.4fr) 24px";
  const inputCls = "w-full text-[12.5px] px-[7px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]";

  return (
    <div className="border border-[#d8dee8] rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[588px]">
          {/* Header */}
          <div
            className="grid bg-[#f8fafc] px-[10px] py-[7px] text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.3px] border-b border-[#d8dee8] gap-[6px]"
            style={{ gridTemplateColumns: cols }}
          >
            <span />
            <span>Name</span>
            <span>Type</span>
            <span className="flex items-center gap-[3px]">PK <InfoTip text="Primary key — uniquely identifies a row. Marks the field as a key when pushed to OWOX; used to anchor relationships." /></span>
            <span className="flex items-center gap-[3px]">Alias <InfoTip text="Business-friendly label for the field (e.g. “Net Revenue” for net_revenue). Optional; shown to business users." /></span>
            <span className="flex items-center gap-[3px]">Description <InfoTip text="What the field means and, for metrics, how it's calculated. Flows to OKF export and the AI question suggestions." /></span>
            <span />
          </div>

          {/* Rows — drag the grip handle to reorder */}
          {schema.map((field, i) => (
            <div
              key={i}
              onDragOver={e => { if (dragIdx === null) return; e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
              onDrop={e => { e.preventDefault(); if (dragIdx !== null) moveField(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
              className={`grid px-[10px] py-[6px] border-b border-[#eef1f5] last:border-b-0 items-center gap-[6px] transition-colors ${dragIdx === i ? "opacity-40" : ""} ${overIdx === i && dragIdx !== null && dragIdx !== i ? "bg-[#e6f1fb]" : ""}`}
              style={{ gridTemplateColumns: cols }}
            >
              <span
                draggable
                onDragStart={e => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                title="Drag to reorder"
                className="flex items-center justify-center text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={13} />
              </span>
              <input
                type="text"
                value={field.name}
                onChange={e => updateField(i, { name: e.target.value })}
                placeholder="field name"
                className={inputCls}
              />
              <select
                value={field.type}
                onChange={e => updateField(i, { type: e.target.value })}
                className="w-full text-[11.5px] px-[6px] py-[5px] border border-[#d8dee8] rounded-lg text-slate-900 focus:outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#e6f1fb]"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="checkbox"
                checked={field.pk}
                onChange={e => updateField(i, { pk: e.target.checked })}
                title="Primary key"
                className="w-4 h-4 mx-auto block cursor-pointer accent-[#1e88e5]"
              />
              <input
                type="text"
                value={field.alias ?? ""}
                onChange={e => updateField(i, { alias: e.target.value || undefined })}
                placeholder="alias"
                className={inputCls}
              />
              <input
                type="text"
                value={field.description ?? ""}
                onChange={e => updateField(i, { description: e.target.value || undefined })}
                placeholder="description"
                className={inputCls}
              />
              <button
                onClick={() => removeField(i)}
                title="Remove field"
                className="border-none bg-transparent text-slate-300 cursor-pointer text-[15px] p-0 hover:text-[#ef4444] flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add field */}
      <button
        onClick={addField}
        className="w-full border-none bg-white px-2 py-[8px] text-[12.5px] font-semibold text-[#1e88e5] cursor-pointer hover:bg-[#f8fafc] transition-colors border-t border-[#eef1f5]"
      >
        + Add field
      </button>
    </div>
  );
}
