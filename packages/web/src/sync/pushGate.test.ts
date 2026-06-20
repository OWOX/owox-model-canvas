import { describe, it, expect } from "vitest";
import { pushIntent } from "./pushGate";

describe("pushIntent", () => {
  it("requires sign-in when anonymous", () => {
    expect(pushIntent(null)).toBe("sign-in");
  });

  it("pushes when signed in", () => {
    expect(pushIntent({ projectTitle: "Demo" })).toBe("push");
  });
});
