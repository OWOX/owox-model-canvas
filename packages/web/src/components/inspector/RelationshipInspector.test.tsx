import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { RelationshipInspector } from "./RelationshipInspector";
import type { ModelEdge, ModelNode } from "@mc/okf";

const from: ModelNode = { key: "tx", title: "Transactions", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 }, schema: [{ name: "block_hash", type: "STRING", pk: true }] };
const to: ModelNode = { key: "blocks", title: "Blocks", inputSource: "TABLE", status: "pending", owoxId: null, position: { x: 0, y: 0 }, schema: [{ name: "hash", type: "STRING", pk: true }] };
const edge: ModelEdge = { id: "e1", from: "tx", to: "blocks", keys: [{ left: "block_hash", right: "hash" }], bidirectional: false };

describe("RelationshipInspector cardinality", () => {
  it("has an Advanced section and a cardinality select that patches the edge", () => {
    const onUpdate = vi.fn();
    const { getByText, getByLabelText } = render(
      <RelationshipInspector edge={edge} fromNode={from} toNode={to} onUpdate={onUpdate} onEnsureField={() => {}} />,
    );
    expect(getByText("Advanced")).toBeTruthy();
    fireEvent.change(getByLabelText("Cardinality"), { target: { value: "N:1" } });
    expect(onUpdate).toHaveBeenCalledWith({ cardinality: "N:1" });
  });

  it("shows a side-labeled caption when set", () => {
    const { getByText } = render(
      <RelationshipInspector edge={{ ...edge, cardinality: "N:1" }} fromNode={from} toNode={to} onUpdate={() => {}} onEnsureField={() => {}} />,
    );
    expect(getByText("Transactions (N) → Blocks (1)")).toBeTruthy();
  });
});
