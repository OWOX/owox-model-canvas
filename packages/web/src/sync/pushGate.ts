import type { Me } from "../lib/auth";

/** Push requires an authenticated session; anonymous users must sign in first. */
export function pushIntent(me: Me | null): "sign-in" | "push" {
  return me ? "push" : "sign-in";
}
