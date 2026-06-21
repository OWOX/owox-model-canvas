import { describe, it, expect } from "vitest";
import type { ModelNode, ModelEdge } from "@mc/okf";
import { joinFieldType, alignedJoinTypes } from "./joinFieldType";

const nodes: ModelNode[] = [
  { key: "badges", title: "Badges", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 },
    schema: [{ name: "id", type: "INTEGER", pk: true }, { name: "user_id", type: "INTEGER", pk: false }] },
  { key: "newobj", title: "New object", inputSource: "SQL", status: "pending", owoxId: null, position: { x: 0, y: 0 },
    schema: [] },
];
const edges: ModelEdge[] = [
  { id: "e1", from: "newobj", to: "badges", keys: [{ left: "id", right: "id" }], bidirectional: false },
];

describe("joinFieldType", () => {
  it("infers a missing field's type from the counterpart (INTEGER, not STRING)", () => {
    // newobj.id is missing; the join pairs it with badges.id (INTEGER).
    expect(joinFieldType(nodes, edges, "newobj", "id")).toBe("INTEGER");
  });

  it("returns the counterpart type for the other side too", () => {
    expect(joinFieldType(nodes, edges, "badges", "id")).toBe("STRING"); // newobj.id missing → unknown → STRING
  });

  it("falls back to STRING when neither side resolves", () => {
    expect(joinFieldType(nodes, edges, "newobj", "ghost")).toBe("STRING");
  });

  it("returns STRING for an empty field name", () => {
    expect(joinFieldType(nodes, edges, "newobj", "")).toBe("STRING");
  });
});

describe("alignedJoinTypes (FK type follows the referenced PK)", () => {
  it("aligns the non-PK FK side to the PK side's type", () => {
    // New object.id (STRING, FK) joined to Tags.id (INTEGER, PK) → both INTEGER.
    expect(alignedJoinTypes({ type: "STRING", pk: false }, { type: "INTEGER", pk: true }))
      .toEqual({ left: "INTEGER", right: "INTEGER" });
  });
  it("aligns when the PK is on the left", () => {
    expect(alignedJoinTypes({ type: "INTEGER", pk: true }, { type: "STRING", pk: false }))
      .toEqual({ left: "INTEGER", right: "INTEGER" });
  });
  it("returns null when types already match", () => {
    expect(alignedJoinTypes({ type: "INTEGER", pk: true }, { type: "INTEGER", pk: false })).toBeNull();
  });
  it("returns null when both sides are PKs (ambiguous)", () => {
    expect(alignedJoinTypes({ type: "STRING", pk: true }, { type: "INTEGER", pk: true })).toBeNull();
  });
  it("returns null when neither side is a PK (ambiguous)", () => {
    expect(alignedJoinTypes({ type: "STRING", pk: false }, { type: "INTEGER", pk: false })).toBeNull();
  });
});
