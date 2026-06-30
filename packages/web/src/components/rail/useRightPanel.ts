import { useState, useCallback } from "react";

export type RightPanelId = "inspect" | "models" | "history" | "share" | "enable" | "account";

export function useRightPanel() {
  const [active, setActive] = useState<RightPanelId | null>(null);
  const open = useCallback((id: RightPanelId) => setActive(id), []);
  const close = useCallback(() => setActive(null), []);
  return { active, open, close };
}
