import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

const storages = [{ id: "s1", title: "BigQuery", type: "BIGQUERY" }];

describe("TopBar", () => {
  it("shows Sign in and no storage picker when anonymous", () => {
    render(<TopBar signedIn={false} storages={storages} />);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.queryByText("Sign out")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull(); // storage <select> hidden
  });

  it("shows Sign out and the storage picker when signed in", () => {
    render(<TopBar signedIn projectTitle="Demo" storages={storages} storageId="s1" />);
    expect(screen.getByText("Sign out")).toBeTruthy();
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("hides the Push caret menu (and its Import option) when anonymous", () => {
    render(<TopBar signedIn={false} onImportFromOwox={() => {}} />);
    expect(screen.queryByLabelText(/More OWOX actions/i)).toBeNull(); // no caret
    expect(screen.queryByText(/Import from OWOX project/i)).toBeNull();
  });

  it("reveals 'Import from OWOX project' in the Push caret menu when signed in", () => {
    render(<TopBar signedIn={true} onImportFromOwox={() => {}} />);
    // hidden until the caret menu is opened
    expect(screen.queryByText(/Import from OWOX project/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/More OWOX actions/i));
    expect(screen.getByText(/Import from OWOX project/i)).toBeTruthy();
  });

  it("invokes onImportFromOwox from the caret menu", () => {
    const fn = vi.fn();
    render(<TopBar signedIn={true} onImportFromOwox={fn} />);
    fireEvent.click(screen.getByLabelText(/More OWOX actions/i));
    fireEvent.click(screen.getByText(/Import from OWOX project/i));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("renders a Business Goal button and fires onOpenGoal", () => {
    const onOpenGoal = vi.fn();
    render(<TopBar signedIn={false} onOpenGoal={onOpenGoal} questionsEnabled />);
    fireEvent.click(screen.getByRole("button", { name: /business goal/i }));
    expect(onOpenGoal).toHaveBeenCalled();
  });

  it("shows the Business Goal button even when the AI key is not configured", () => {
    render(<TopBar signedIn={false} onOpenGoal={() => {}} questionsEnabled={false} />);
    expect(screen.getByRole("button", { name: /business goal/i })).toBeTruthy();
  });
});
