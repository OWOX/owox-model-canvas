import { useRef, useState, useCallback, useEffect } from "react";
import { PanelRightOpen } from "lucide-react";
import type { ModelNode, ModelEdge } from "@mc/okf";
import { ObjectInspector } from "./ObjectInspector";
import { RelationshipInspector } from "./RelationshipInspector";
import { QuestionsPanel } from "./QuestionsPanel";
import type { BusinessGoal } from "../../state/goal";
import { joinFieldType } from "../../sync/joinFieldType";

type Selection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

interface InspectorProps {
  selection: Selection;
  nodes: ModelNode[];
  edges: ModelEdge[];
  onUpdateNode: (key: string, patch: Partial<ModelNode>) => void;
  onUpdateEdge: (id: string, patch: Partial<ModelEdge>) => void;
  onClose: () => void;
  goal?: BusinessGoal | null;
  questionsEnabled?: boolean;
  onEditGoal?: () => void;
  /**
   * When true, render ONLY the selection body (ObjectInspector / RelationshipInspector /
   * QuestionsPanel / EmptyState) — no outer drawer wrapper, border, width, resize handle,
   * header, or ReopenTab. Used when the Inspector is hosted inside the right ModelSheet.
   * Default false preserves the standalone drawer behaviour byte-for-byte.
   */
  embedded?: boolean;
}

const MIN_WIDTH = 320;

function EmptyState() {
  return (
    <div className="px-6 py-[46px] text-center text-slate-500 text-[13px] leading-[1.6]">
      <svg
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        width={42} height={42}
        className="mx-auto mb-3 opacity-35"
      >
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="4" width="7" height="6" rx="1.5" />
        <rect x="9" y="14" width="7" height="6" rx="1.5" />
      </svg>
      <div>
        Select an object or relationship to edit.
        <br /><br />
        Changes here are pushed to the matching Data Mart.
      </div>
    </div>
  );
}

// Clean icon tab shown when the inspector is collapsed (no awkward rotated text).
function ReopenTab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Open inspector"
      aria-label="Open inspector"
      className="group absolute right-0 top-1/2 -translate-y-1/2 z-20 flex h-[46px] w-[32px] items-center justify-center rounded-l-xl border border-r-0 border-[#d8dee8] bg-white text-slate-500 shadow-[-3px_0_12px_rgba(15,23,42,0.07)] cursor-pointer transition-colors hover:bg-[#f1f3f7] hover:text-[#1e88e5]"
    >
      <PanelRightOpen size={18} />
      <span className="pointer-events-none absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-[0_6px_18px_rgba(15,23,42,0.28)]">
        Open inspector
      </span>
    </button>
  );
}

export function Inspector({
  selection, nodes, edges, onUpdateNode, onUpdateEdge, onClose, goal, questionsEnabled, onEditGoal, embedded = false,
}: InspectorProps) {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(320);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const selectedNode = selection?.type === "node"
    ? nodes.find(n => n.key === selection.id)
    : undefined;
  const selectedEdge = selection?.type === "edge"
    ? edges.find(e => e.id === selection.id)
    : undefined;

  const title = selectedNode
    ? (selectedNode.title.trim() || "Untitled")
    : selectedEdge ? "Relationship" : "Inspector";

  // Resize drag handlers
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(
        window.innerWidth * 0.5,
        Math.max(MIN_WIDTH, startWidthRef.current + delta)
      );
      setWidth(newWidth);
    }
    function onMouseUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Selection body — shared between the standalone drawer and the embedded
  // (Sheet-hosted) render so editing behaviour is identical in both.
  const body = selectedNode ? (
    <>
      <ObjectInspector
        node={selectedNode}
        onUpdate={patch => onUpdateNode(selectedNode.key, patch)}
      />
      {questionsEnabled && (
        <QuestionsPanel
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          goal={goal ?? null}
          onEditGoal={onEditGoal ?? (() => {})}
        />
      )}
    </>
  ) : selectedEdge ? (
    <RelationshipInspector
      edge={selectedEdge}
      fromNode={nodes.find(n => n.key === selectedEdge.from)}
      toNode={nodes.find(n => n.key === selectedEdge.to)}
      onUpdate={patch => onUpdateEdge(selectedEdge.id, patch)}
      onEnsureField={(nodeKey, fieldName) => {
        const node = nodes.find(n => n.key === nodeKey);
        if (!node || !fieldName || node.schema.some(f => f.name === fieldName)) return;
        // Match the type of the field on the other side of the join so a key
        // pointing at an INTEGER PK isn't created as STRING (OWOX rejects it).
        const type = joinFieldType(nodes, [selectedEdge], nodeKey, fieldName);
        onUpdateNode(nodeKey, { schema: [...node.schema, { name: fieldName, type, pk: false }] });
      }}
    />
  ) : (
    <EmptyState />
  );

  // Embedded: render only the body. The hosting ModelSheet provides the outer
  // chrome (header, padding, overflow, close button), so we skip all of ours.
  if (embedded) return body;

  if (!open) {
    return (
      <div className="relative flex-shrink-0" style={{ width: 0 }}>
        <ReopenTab onClick={() => setOpen(true)} />
      </div>
    );
  }

  return (
    <div
      ref={drawerRef}
      className="bg-white border-l border-[#d8dee8] flex-shrink-0 flex flex-col z-10 shadow-[-4px_0_16px_rgba(15,23,42,0.04)] relative"
      style={{ width, minWidth: MIN_WIDTH, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif" }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        className="absolute left-0 top-0 w-[7px] h-full cursor-col-resize z-[18] group"
        title="Drag to resize"
      >
        <div className="absolute left-[2px] top-0 w-[2px] h-full bg-transparent group-hover:bg-[#1e88e5] transition-colors" />
      </div>

      {/* Header */}
      <div className="px-4 py-[14px] border-b border-[#d8dee8] flex items-center gap-2 flex-shrink-0">
        <h3 className="text-[13.5px] font-[650] flex-1 text-slate-900">{title}</h3>
        <button
          onClick={() => { onClose(); setOpen(false); }}
          title="Close inspector"
          className="cursor-pointer text-slate-500 border-none bg-none text-[18px] leading-none hover:text-slate-900 transition-colors p-0 bg-transparent"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-4 overflow-y-auto flex-1 min-h-0">
        {body}
      </div>
    </div>
  );
}
