import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ModelNode } from "@mc/okf";
import { QuestionsPanel } from "./QuestionsPanel";
import * as qlib from "../../lib/questions";

const node: ModelNode = {
  key: "a", title: "Orders", inputSource: "SQL",
  schema: [{ name: "id", type: "INTEGER", pk: true }],
  position: { x: 0, y: 0 }, status: "pending",
};
const GOAL = { niche: "E-commerce / Retail", goal: "Increase ROAS while holding CPC" };

afterEach(() => vi.restoreAllMocks());

describe("QuestionsPanel", () => {
  it("renders generated questions and their 'unlocked by' tags", async () => {
    vi.spyOn(qlib, "getQuestions").mockResolvedValue([
      { question: "Which segments drive repeat orders?", unlockedBy: "Orders ⨝ Customers" },
    ]);
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} />);
    expect(await screen.findByText(/Which segments drive repeat orders/)).toBeTruthy();
    expect(screen.getByText(/Orders ⨝ Customers/)).toBeTruthy();
  });

  it("shows an error state when generation fails", async () => {
    vi.spyOn(qlib, "getQuestions").mockRejectedValue(new Error("boom"));
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} />);
    expect(await screen.findByText(/couldn't generate/i)).toBeTruthy();
  });

  it("re-fetches with force when Regenerate is clicked", async () => {
    const spy = vi.spyOn(qlib, "getQuestions").mockResolvedValue([{ question: "Q", unlockedBy: "U" }]);
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} />);
    await screen.findByText("Q");
    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.anything(), GOAL, { force: true }));
  });
});
