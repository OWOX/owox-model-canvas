import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mock the API surface so /api/me is anonymous and /api/auth/connect +
// /api/storages succeed once "connected". This avoids any real network call
// while exercising the real useAuth / Canvas wiring above it.
const apiMock = vi.fn(async (path: string, _opts?: RequestInit) => {
  if (path === "/api/me") throw new Error("401");
  if (path === "/api/auth/connect") return { projectTitle: "Demo project" };
  if (path === "/api/storages") return [{ id: "s1", name: "Storage 1", type: "GOOGLE_BIGQUERY" }];
  throw new Error(`unexpected path in test: ${path}`);
});
vi.mock("../../lib/api", () => ({ api: (path: string, opts?: RequestInit) => apiMock(path, opts) }));

// ── Mock the push entrypoint so we can assert it was (not) called without
// doing any real push work.
const pushModel = vi.fn(async () => ({
  created: 0, updated: 0, failed: 0, relationshipsCreated: 0, relationshipsFailed: 0, errors: [],
}));
vi.mock("../../sync/push", () => ({ pushModel: (...args: Parameters<typeof pushModel>) => pushModel(...args) }));

import { App } from "../../App";

describe("Canvas push gate (App-level wiring)", () => {
  beforeEach(() => {
    apiMock.mockClear();
    pushModel.mockClear();
    localStorage.clear();
  });

  it("opens the sign-in modal (push mode) instead of pushing when anonymous, then resumes the push after connecting", async () => {
    render(<App />);

    // Wait for the auth bootstrap (/api/me rejection) to settle and the canvas to mount.
    const pushButton = await screen.findByText(/Push to OWOX/);

    fireEvent.click(pushButton);

    // Anonymous push opens the SignInModal in push mode rather than pushing.
    await waitFor(() => expect(screen.getByText("Sign in to push")).toBeTruthy());
    expect(pushModel).not.toHaveBeenCalled();

    // Enter a key and submit — this calls connect() → POST /api/auth/connect.
    fireEvent.change(screen.getByPlaceholderText("pmk_…"), { target: { value: "pmk_test123" } });
    fireEvent.click(screen.getByText("Connect & push"));

    // A successful connect in push mode should resume the push automatically.
    await waitFor(() => expect(pushModel).toHaveBeenCalledTimes(1));

    // The modal should be dismissed after a successful connect.
    await waitFor(() => expect(screen.queryByText("Sign in to push")).toBeNull());
  });
});
