import type { Edge } from "@xyflow/react";
import type { ModelNode, ModelEdge } from "@mc/okf";
import type { ViewMode } from "../../state/viewMode";

function compactEdge(e: ModelEdge): Edge {
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    type: "rel",
    data: { keys: e.keys, bidirectional: e.bidirectional, cardinality: e.cardinality, modelEdgeId: e.id } as unknown as Record<string, unknown>,
  };
}

// Reconnect (dragging an edge end to another port) is scoped to the SELECTED
// relationship only. Otherwise, when several edges share a node handle their
// reconnect anchors overlap and React Flow grabs whichever is topmost — not the
// one the user picked. ERD view is display-only, so reconnect is off there.
export function isEdgeReconnectable(
  modelEdgeId: string | undefined,
  selectedEdgeId: string | null,
  viewMode: ViewMode,
): boolean {
  return viewMode !== "erd" && modelEdgeId != null && modelEdgeId === selectedEdgeId;
}

export function buildRfEdges(edges: ModelEdge[], nodes: ModelNode[], viewMode: ViewMode): Edge[] {
  if (viewMode !== "erd") return edges.map(compactEdge);

  const fieldsByKey = new Map<string, Set<string>>(
    nodes.map(n => [n.key, new Set(n.schema.map(f => f.name))]),
  );

  return edges.flatMap(e => {
    const usable = e.keys.filter(k => k.left || k.right);
    if (usable.length === 0) return [compactEdge(e)];

    const srcFields = fieldsByKey.get(e.from);
    const tgtFields = fieldsByKey.get(e.to);

    // Keep the same side the edge uses in compact mode — the stored
    // sourceHandle/targetHandle ("left"/"right") — and only move the anchor
    // vertically onto the field row. Otherwise the arrow would jump sides when
    // toggling views. fr:<field> = right edge of the row, fl:<field> = left edge.
    const srcSide = e.sourceHandle === "left" ? "fl" : "fr";
    const tgtSide = e.targetHandle === "right" ? "fr" : "fl";

    return usable.map((k, i): Edge => ({
      id: `${e.id}::${i}`,
      source: e.from,
      target: e.to,
      sourceHandle: k.left && srcFields?.has(k.left) ? `${srcSide}:${k.left}` : (e.sourceHandle ?? "right"),
      targetHandle: k.right && tgtFields?.has(k.right) ? `${tgtSide}:${k.right}` : (e.targetHandle ?? "left"),
      type: "rel",
      data: { keys: [k], bidirectional: e.bidirectional, cardinality: e.cardinality, modelEdgeId: e.id } as unknown as Record<string, unknown>,
    }));
  });
}
