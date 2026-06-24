import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeDialog } from "./WelcomeDialog";
import { TEMPLATES } from "../templates";

describe("WelcomeDialog", () => {
  const props = () => ({ onUseTemplate: vi.fn(), onStartBlank: vi.fn(), onImport: vi.fn() });

  it("lists every template with a Use button", () => {
    render(<WelcomeDialog {...props()} />);
    for (const t of TEMPLATES) expect(screen.getByText(t.name)).toBeTruthy();
    expect(screen.getAllByText("Use").length).toBe(TEMPLATES.length);
  });

  it("rolls out a template (deep-cloned, not the shared instance)", () => {
    const p = props();
    render(<WelcomeDialog {...p} />);
    fireEvent.click(screen.getAllByText("Use")[0]);
    expect(p.onUseTemplate).toHaveBeenCalledTimes(1);
    const graph = p.onUseTemplate.mock.calls[0][0];
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph).not.toBe(TEMPLATES[0].graph); // a clone, safe to mutate
  });

  it("offers Start blank and Import paths", () => {
    const p = props();
    render(<WelcomeDialog {...p} />);
    fireEvent.click(screen.getByText("Start blank"));
    expect(p.onStartBlank).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Import OKF"));
    expect(p.onImport).toHaveBeenCalledTimes(1);
  });

  it("links to an import guide", () => {
    render(<WelcomeDialog {...props()} />);
    const link = screen.getByText(/Import guide/).closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/ai-instructions.html");
    expect(link.target).toBe("_blank");
  });
});
