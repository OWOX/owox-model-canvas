import type { ModelNode, ModelEdge } from "@mc/okf";

// When a join key references a field that doesn't exist yet, we have to create
// it. Defaulting to STRING breaks the join if the other side is e.g. an INTEGER
// primary key (OWOX rejects "Incompatible types"). Instead, infer the new
// field's type from the field on the OTHER side of the same join key. Falls
// back to STRING when the counterpart is unknown too.
export function joinFieldType(
  nodes: ModelNode[],
  edges: ModelEdge[],
  nodeKey: string,
  fieldName: string,
): string {
  if (!fieldName) return "STRING";
  for (const e of edges) {
    for (const k of e.keys) {
      let otherKey: string | undefined;
      let otherField: string | undefined;
      if (e.from === nodeKey && k.left === fieldName) { otherKey = e.to; otherField = k.right; }
      else if (e.to === nodeKey && k.right === fieldName) { otherKey = e.from; otherField = k.left; }
      if (otherKey && otherField) {
        const t = nodes.find(n => n.key === otherKey)?.schema.find(f => f.name === otherField)?.type;
        if (t) return t;
      }
    }
  }
  return "STRING";
}

// A foreign key's type must equal the primary key it references, or OWOX rejects
// the relationship ("Incompatible types"). When a join key's two fields differ
// in type and exactly one side is a PK, align the non-PK (FK) side to the PK
// side's type. Returns the types to apply to [left, right], or null when nothing
// should change (equal types, or ambiguous: both or neither side is a PK).
export function alignedJoinTypes(
  left: { type: string; pk: boolean },
  right: { type: string; pk: boolean },
): { left: string; right: string } | null {
  if (left.type === right.type) return null;
  if (left.pk && !right.pk) return { left: left.type, right: left.type };
  if (right.pk && !left.pk) return { left: right.type, right: right.type };
  return null;
}
