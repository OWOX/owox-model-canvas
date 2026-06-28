import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "./supabase";
import { setAuthRedirecting } from "./authRedirect";

// The Supabase account = the user's identity, used to SAVE models. This is a
// separate concern from `lib/auth.tsx` (the OWOX API-key "connect" flow used for
// Push) — a user can be signed into their account without connecting OWOX, and
// vice-versa. Anonymous-first: nothing here gates create/edit/export/share.

interface AccountCtx {
  enabled: boolean;
  ready: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountCtx>(null!);
export const useAccount = () => useContext(Ctx);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // When Supabase isn't configured the feature is simply off — treat as "ready"
  // immediately so nothing waits on it.
  const [ready, setReady] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // OAuth redirects the page to the provider and back to `redirectTo`; supabase-js
  // then picks the session out of the URL (detectSessionInUrl) on return.
  const oauth = (provider: "google" | "github") => async () => {
    if (!supabase) return;
    // We're about to leave the page for the provider — suppress the unsaved-work
    // "Leave site?" prompt for this intentional navigation.
    setAuthRedirecting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) { setAuthRedirecting(false); throw error; }
  };

  const signInWithEmail = async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{
        enabled: supabaseEnabled,
        ready,
        user,
        signInWithGoogle: oauth("google"),
        signInWithGitHub: oauth("github"),
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
