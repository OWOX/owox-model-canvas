import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignInModal } from "./SignInModal";

describe("SignInModal", () => {
  it("connects with the entered key, then signals success", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const onConnected = vi.fn();
    render(<SignInModal mode="push" connect={connect} onConnected={onConnected} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("pmk_…"), { target: { value: "pmk_abc" } });
    fireEvent.click(screen.getByText("Connect & push"));

    await waitFor(() => expect(connect).toHaveBeenCalledWith("pmk_abc"));
    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
  });

  it("shows the error and does not signal success when connect fails", async () => {
    const connect = vi.fn().mockRejectedValue(new Error("Invalid key"));
    const onConnected = vi.fn();
    render(<SignInModal mode="push" connect={connect} onConnected={onConnected} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("pmk_…"), { target: { value: "bad" } });
    fireEvent.click(screen.getByText("Connect & push"));

    await waitFor(() => expect(screen.getByText("Invalid key")).toBeTruthy());
    expect(onConnected).not.toHaveBeenCalled();
  });
});
