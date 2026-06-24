import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { OwoxDataMartsHero } from "./OwoxDataMartsHero";
import { signupUrl } from "../lib/links";

export interface SignInModalProps {
  /** "connect" = just sign in; "push" = sign in then resume a push. */
  mode: "connect" | "push";
  /** Exchanges the API key for a session. Throws on failure. */
  connect: (key: string) => Promise<void>;
  /** Called after a successful connect (container loads storages / resumes push). */
  onConnected: () => void;
  onClose: () => void;
}

export function SignInModal({ mode, connect, onConnected, onClose }: SignInModalProps) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Product placement — collapsed by default so it stays low-key.
  const [aboutOpen, setAboutOpen] = useState(false);

  async function submit() {
    if (!key.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await connect(key.trim());
      onConnected();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-[520px] max-h-[88vh] overflow-y-auto rounded-2xl border border-[#d8dee8] bg-white p-7 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h1 className="text-lg font-semibold">{mode === "push" ? "Sign in to push" : "Connect to OWOX"}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          {mode === "push"
            ? "Pushing creates draft Data Marts in your OWOX project, so it needs your OWOX API key."
            : "Connect your OWOX API key to push your model into OWOX Data Marts."}
        </p>

        {/* Product placement: "What is OWOX Data Marts?" — collapsed by default,
            sits right under the title so it greets first-time users up top. */}
        <div className="mt-4 rounded-xl border border-[#e6e9f0] bg-[#f7f8fa]">
          <button
            onClick={() => setAboutOpen(o => !o)}
            aria-expanded={aboutOpen}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-semibold text-slate-700"
          >
            <ChevronRight size={15} className={`text-slate-400 transition-transform ${aboutOpen ? "rotate-90" : ""}`} />
            What is OWOX Data Marts?
          </button>
          {aboutOpen && (
            <div className="px-4 pb-4">
              <p className="text-[13px] leading-relaxed text-slate-600">
                The self-service analytics platform{" "}
                <a
                  href="https://owox.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#1e88e5] hover:underline"
                >
                  owox.com
                </a>{" "}
                behind this tool.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                Analysts govern the logic once, in one place. Business users self-serve trusted answers in the tools they
                already use — Sheets, Slack, Teams. No tickets. No hallucinations. Your data never leaves your warehouse.
              </p>

              <div className="mt-3">
                <OwoxDataMartsHero />
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                Sources stay in your warehouse. Analysts model the business once — customers, orders, revenue — in SQL
                they own. Business users and AI agents query the model, never the raw tables. Trusted answers land in the
                tools they already use.
              </p>
            </div>
          )}
        </div>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">API key</label>
        <input
          autoFocus
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="owox_key_…"
          className="mt-2 w-full rounded-lg border border-[#d8dee8] px-3 py-3 text-sm outline-none focus:border-[#1e88e5]"
        />
        {err && <p className="mt-2 text-sm text-red-500">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button
            disabled={busy || !key.trim()}
            onClick={submit}
            className="flex-1 rounded-lg bg-[#1e88e5] py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Connecting…" : mode === "push" ? "Connect & push" : "Connect"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-[#d8dee8] px-4 font-semibold text-slate-700">
            Cancel
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-[#e6e9f0] bg-[#f7f8fa] p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Where to get your key</div>
          <ol className="mt-2 list-decimal pl-5 text-[13px] leading-relaxed text-slate-600">
            <li>In OWOX, open the project menu (top-left) → <b>Project settings</b>.</li>
            <li>Go to <b>My API Keys</b>.</li>
            <li>Click <b>Create API Key</b> and copy the key (<code>owox_key_…</code>).</li>
          </ol>
          <img
            src="/owox-api-key-guide.png"
            alt="OWOX → Project settings → My API Keys → Create API Key"
            className="mt-3 w-full rounded-lg border border-[#e6e9f0]"
          />
        </div>

        {/* Conversion bridge: anonymous visitors without an OWOX account can't
            create a key. Give them a way forward instead of a dead end. */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-slate-500">
          <span>Don't have an OWOX account yet?</span>
          <a
            href={signupUrl("signin_modal")}
            target="_blank"
            rel="noopener"
            className="font-semibold text-[#1e88e5] hover:underline"
          >
            Start free →
          </a>
        </div>
      </div>
    </div>
  );
}
