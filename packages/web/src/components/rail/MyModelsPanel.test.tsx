import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyModelsPanel } from "./MyModelsPanel";

const models = [{ id: "m1", name: "Ecommerce OKF", updated_at: "2026-06-29T00:00:00Z" }];

describe("MyModelsPanel", () => {
  it("renders saved models and triggers rename", () => {
    const onRename = vi.fn();
    render(<MyModelsPanel models={models} currentModelId="m1" onOpen={() => {}} onNew={() => {}} onRename={onRename} onDelete={() => {}} />);
    expect(screen.getByText("Ecommerce OKF")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /rename ecommerce okf/i }));
    // inline edit appears; type + commit
    fireEvent.change(screen.getByDisplayValue("Ecommerce OKF"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByDisplayValue("Renamed"), { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("m1", "Renamed");
  });

  it("shows a current badge on the active model", () => {
    render(<MyModelsPanel models={models} currentModelId="m1" onOpen={() => {}} onNew={() => {}} onRename={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("current")).toBeTruthy();
  });

  it("calls onOpen when the row body is clicked", () => {
    const onOpen = vi.fn();
    render(<MyModelsPanel models={models} currentModelId={null} onOpen={onOpen} onNew={() => {}} onRename={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByText("Ecommerce OKF"));
    expect(onOpen).toHaveBeenCalledWith("m1");
  });

  it("calls onDelete when the delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<MyModelsPanel models={models} currentModelId={null} onOpen={() => {}} onNew={() => {}} onRename={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete ecommerce okf/i }));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("cancels rename on Escape", () => {
    const onRename = vi.fn();
    render(<MyModelsPanel models={models} currentModelId={null} onOpen={() => {}} onNew={() => {}} onRename={onRename} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /rename ecommerce okf/i }));
    fireEvent.change(screen.getByDisplayValue("Ecommerce OKF"), { target: { value: "Typed" } });
    fireEvent.keyDown(screen.getByDisplayValue("Typed"), { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    // input should be gone, name still shows
    expect(screen.getByText("Ecommerce OKF")).toBeTruthy();
  });

  it("calls onNew when New model is clicked", () => {
    const onNew = vi.fn();
    render(<MyModelsPanel models={models} currentModelId={null} onOpen={() => {}} onNew={onNew} onRename={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /new model/i }));
    expect(onNew).toHaveBeenCalled();
  });

  it("shows the Saves perk header", () => {
    render(<MyModelsPanel models={models} currentModelId={null} onOpen={() => {}} onNew={() => {}} onRename={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Saves")).toBeTruthy();
    expect(screen.getByText("Keep your models and reopen them anytime")).toBeTruthy();
  });

  it("shows empty state when no models", () => {
    render(<MyModelsPanel models={[]} currentModelId={null} onOpen={() => {}} onNew={() => {}} onRename={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/no saved models yet/i)).toBeTruthy();
  });
});
