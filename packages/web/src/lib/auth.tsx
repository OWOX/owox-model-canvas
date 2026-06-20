import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
export interface Me { projectTitle?: string; fullName?: string; }
interface AuthCtx { me: Me | null; ready: boolean; connect: (key: string) => Promise<void>; signOut: () => Promise<void>; }
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);
const KEY = "owox_api_key";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  async function doConnect(key: string) { const m = await api<Me>("/api/auth/connect", { method: "POST", body: JSON.stringify({ apiKey: key }) }); localStorage.setItem(KEY, key); setMe(m); }
  async function bootstrap() {
    try { setMe(await api<Me>("/api/me")); }
    catch { const k = localStorage.getItem(KEY); if (k) { try { await doConnect(k); return; } catch { localStorage.removeItem(KEY); } } setMe(null); }
    finally { setReady(true); }
  }
  useEffect(() => { void bootstrap(); }, []);
  const connect = async (key: string) => { await doConnect(key); setReady(true); };
  const signOut = async () => { await api("/api/auth/signout", { method: "POST" }).catch(() => {}); localStorage.removeItem(KEY); setMe(null); };
  return <Ctx.Provider value={{ me, ready, connect, signOut }}>{children}</Ctx.Provider>;
}
