import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PushConfirmDialog } from "./PushConfirmDialog";

const base = {
  projectTitle: "MCP Demo",
  storage: { title: "BigQuery EU", type: "GOOGLE_BIGQUERY" },
  counts: { marts: 3, relationships: 2 },
};

describe("PushConfirmDialog", () => {
  it("shows the target project, storage and counts", () => {
    render(<PushConfirmDialog {...base} onConfirm={() => {}} onChangeProject={() => {}} onClose={() => {}} />);
    expect(screen.getByText("MCP Demo")).toBeTruthy();
    expect(screen.getByText(/BigQuery EU/)).toBeTruthy();
    expect(screen.getByText(/GOOGLE_BIGQUERY/)).toBeTruthy();
    expect(screen.getByText(/3 marts and 2 relationships will be pushed/i)).toBeTruthy();
  });

  it("wires Push, Change project and Cancel", () => {
    const onConfirm = vi.fn(), onChangeProject = vi.fn(), onClose = vi.fn();
    render(<PushConfirmDialog {...base} onConfirm={onConfirm} onChangeProject={onChangeProject} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^push$/i }));
    fireEvent.click(screen.getByRole("button", { name: /change project/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onChangeProject).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
