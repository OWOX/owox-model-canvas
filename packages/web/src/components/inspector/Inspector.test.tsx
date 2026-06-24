import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ModelNode } from "@mc/okf";
import { Inspector } from "./Inspector";
import * as qlib from "../../lib/questions";

const node: ModelNode = {
  key: "a", title: "Orders", inputSource: "SQL",
  schema: [{ name: "id", type: "INTEGER", pk: true }],
  position: { x: 0, y: 0 }, status: "pending",
};
const GOAL = { niche: "E-commerce / Retail", goal: "Increase ROAS while holding CPC" };
const noop = () => {};

afterEach(() => vi.restoreAllMocks());

describe("Inspector + QuestionsPanel", () => {
  it("shows the questions block when the feature is enabled (does not auto-generate)", () => {
    const spy = vi.spyOn(qlib, "getQuestions").mockResolvedValue([{ question: "Q", unlockedBy: "U" }]);
    render(
      <Inspector selection={{ type: "node", id: "a" }} nodes={[node]} edges={[]} goal={GOAL}
        questionsEnabled onEditGoal={noop} onUpdateNode={noop} onUpdateEdge={noop} onClose={noop} />,
    );
    expect(screen.getByText(/Questions this unlocks/i)).toBeTruthy();
    expect(spy).not.toHaveBeenCalled(); // generation is click-only
  });

  it("still shows the questions block when AI is off, with a graceful note", () => {
    render(
      <Inspector selection={{ type: "node", id: "a" }} nodes={[node]} edges={[]} goal={GOAL}
        questionsEnabled={false} onEditGoal={noop} onUpdateNode={noop} onUpdateEdge={noop} onClose={noop} />,
    );
    expect(screen.getByText(/Questions this unlocks/i)).toBeTruthy();
    expect(screen.getByText(/aren't enabled on this deployment/i)).toBeTruthy();
  });
});
