import { describe, it, expect, vi, afterEach } from "vitest";
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

const gen = () => screen.getByRole("button", { name: /get question ideas/i });

afterEach(() => vi.restoreAllMocks());

describe("QuestionsPanel", () => {
  it("does NOT call Gemini on mount — only on an explicit click", async () => {
    const spy = vi.spyOn(qlib, "getQuestions").mockResolvedValue([
      { question: "Which segments drive repeat orders?", unlockedBy: "Orders ⨝ Customers" },
    ]);
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} onEditGoal={() => {}} />);
    expect(spy).not.toHaveBeenCalled();           // nothing fired automatically

    fireEvent.click(gen());
    expect(await screen.findByText(/Which segments drive repeat orders/)).toBeTruthy();
    expect(screen.getByText(/Orders ⨝ Customers/)).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("shows an error state (with retry) when generation fails", async () => {
    vi.spyOn(qlib, "getQuestions").mockRejectedValue(new Error("boom"));
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} onEditGoal={() => {}} />);
    fireEvent.click(gen());
    expect(await screen.findByText(/couldn't generate/i)).toBeTruthy();
  });

  it("shows the friendly limit message when the AI quota is hit", async () => {
    vi.spyOn(qlib, "getQuestions").mockRejectedValue(new qlib.AiLimitError());
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} onEditGoal={() => {}} />);
    fireEvent.click(gen());
    expect(await screen.findByText(/free AI API limit has been reached/i)).toBeTruthy();
  });

  it("re-fetches with force when Refresh is clicked", async () => {
    const spy = vi.spyOn(qlib, "getQuestions").mockResolvedValue([{ question: "Q", unlockedBy: "U" }]);
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} onEditGoal={() => {}} />);
    fireEvent.click(gen());
    await screen.findByText("Q");
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.anything(), GOAL, { force: true }));
  });

  it("with no goal set, shows a Set-business-goal CTA that opens the goal dialog and never calls Gemini", () => {
    const spy = vi.spyOn(qlib, "getQuestions");
    const onEditGoal = vi.fn();
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={null} onEditGoal={onEditGoal} />);
    fireEvent.click(screen.getByRole("button", { name: /set goal to get ideas/i }));
    expect(onEditGoal).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("shows the chosen niche and goal in the hint, with an Edit link", () => {
    const onEditGoal = vi.fn();
    render(<QuestionsPanel node={node} nodes={[node]} edges={[]} goal={GOAL} onEditGoal={onEditGoal} />);
    expect(screen.getByText("E-commerce / Retail")).toBeTruthy();
    expect(screen.getByText("Increase ROAS while holding CPC")).toBeTruthy();
    fireEvent.click(screen.getByText("Edit"));
    expect(onEditGoal).toHaveBeenCalledTimes(1);
  });

  it("shows the empty hint (no CTA) when the mart has no fields or description", () => {
    const empty = { ...node, schema: [] };
    render(<QuestionsPanel node={empty} nodes={[empty]} edges={[]} goal={GOAL} onEditGoal={() => {}} />);
    expect(screen.getByText(/Add fields or a description/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get question ideas/i })).toBeNull();
  });
});
