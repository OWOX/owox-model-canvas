import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryPanel } from "./HistoryPanel";

it("lists versions and restores", () => {
  const onRestore = vi.fn();
  render(<HistoryPanel versions={[{id:"v2",created_at:"2026-06-29T21:54:00Z"}]} onCompare={()=>{}} onRestore={onRestore} signedIn />);
  expect(screen.getByText(/Version history/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /restore/i }));
  expect(onRestore).toHaveBeenCalledWith("v2");
});

describe("HistoryPanel", () => {
  it("shows the perk description header", () => {
    render(<HistoryPanel versions={[]} onCompare={() => {}} onRestore={() => {}} signedIn />);
    expect(screen.getByText("Version history")).toBeTruthy();
    expect(screen.getByText("Snapshot every save; compare and restore")).toBeTruthy();
  });

  it("shows empty state when no versions", () => {
    render(<HistoryPanel versions={[]} onCompare={() => {}} onRestore={() => {}} signedIn />);
    expect(screen.getByText(/no versions yet/i)).toBeTruthy();
  });

  it("calls onCompare with the version id", () => {
    const onCompare = vi.fn();
    render(
      <HistoryPanel
        versions={[{ id: "v1", created_at: "2026-06-01T10:00:00Z" }]}
        onCompare={onCompare}
        onRestore={() => {}}
        signedIn
      />
    );
    // The version row's Compare button (inside the list)
    const compareBtns = screen.getAllByRole("button", { name: /compare/i });
    // Last compare button is in the version row
    fireEvent.click(compareBtns[compareBtns.length - 1]);
    expect(onCompare).toHaveBeenCalledWith("v1");
  });

  it("renders multiple versions with correct labels", () => {
    const versions = [
      { id: "v3", created_at: "2026-06-29T12:00:00Z" },
      { id: "v2", created_at: "2026-06-28T12:00:00Z" },
      { id: "v1", created_at: "2026-06-27T12:00:00Z" },
    ];
    render(<HistoryPanel versions={versions} onCompare={() => {}} onRestore={() => {}} signedIn />);
    expect(screen.getByText("Latest")).toBeTruthy();
    expect(screen.getByText("Version 2")).toBeTruthy();
    expect(screen.getByText("Version 1")).toBeTruthy();
  });

  it("shows Current row and a Compare button when versions exist", () => {
    render(
      <HistoryPanel
        versions={[{ id: "v1", created_at: "2026-06-01T10:00:00Z" }]}
        onCompare={() => {}}
        onRestore={() => {}}
        signedIn
      />
    );
    expect(screen.getByText("Current")).toBeTruthy();
    // At least one Compare button exists (could be in Current row + version row)
    expect(screen.getAllByRole("button", { name: /compare/i }).length).toBeGreaterThan(0);
  });

  it("does not show Compare in Current row when versions list is empty", () => {
    render(<HistoryPanel versions={[]} onCompare={() => {}} onRestore={() => {}} signedIn />);
    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /compare/i })).toBeNull();
  });
});
