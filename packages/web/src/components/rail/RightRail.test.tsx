import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RightRail } from "./RightRail";

describe("RightRail", () => {
  it("renders all four entries and is visible regardless of sign-in", () => {
    render(<RightRail active={null} onOpen={() => {}} signedIn={false} />);
    ["Inspect", "My Models", "History", "Share"].forEach(l =>
      expect(screen.getByRole("button", { name: l })).toBeTruthy());
  });

  it("calls onOpen with the clicked panel id", () => {
    const onOpen = vi.fn();
    render(<RightRail active={null} onOpen={onOpen} signedIn={true} />);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(onOpen).toHaveBeenCalledWith("history");
  });

  it("marks the active entry with aria-current", () => {
    render(<RightRail active="models" onOpen={() => {}} signedIn={true} />);
    expect(screen.getByRole("button", { name: "My Models" }).getAttribute("aria-current")).toBe("true");
  });
});
