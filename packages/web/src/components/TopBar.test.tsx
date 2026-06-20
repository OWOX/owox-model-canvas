import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
