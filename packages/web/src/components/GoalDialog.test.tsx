import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalDialog } from "./GoalDialog";

describe("GoalDialog", () => {
  it("shows the privacy disclaimer up front", () => {
    render(<GoalDialog current={null} onConfirm={() => {}} onClear={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/processed by Google Gemini/i)).toBeTruthy();
  });

  it("walks niche → goal and confirms the selection", () => {
    const onConfirm = vi.fn();
    render(<GoalDialog current={null} onConfirm={onConfirm} onClear={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText("E-commerce / Retail"));
    fireEvent.click(screen.getByText("Increase ROAS while holding CPC"));
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onConfirm).toHaveBeenCalledWith({ niche: "E-commerce / Retail", goal: "Increase ROAS while holding CPC" });
  });

  it("accepts a custom goal", () => {
    const onConfirm = vi.fn();
    render(<GoalDialog current={null} onConfirm={onConfirm} onClear={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText("SaaS / Subscription"));
    fireEvent.change(screen.getByPlaceholderText(/your own goal/i), { target: { value: "Grow seats per account" } });
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onConfirm).toHaveBeenCalledWith({ niche: "SaaS / Subscription", goal: "Grow seats per account" });
  });
});
