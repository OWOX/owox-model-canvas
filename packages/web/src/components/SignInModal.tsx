import { useState } from "react";

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

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">API key</label>
        <input
          autoFocus
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="pmk_…"
          className="mt-2 w-full rounded-lg border border-[#d8dee8] px-3 py-3 text-sm outline-none focus:border-indigo-500"
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
            <li>Click <b>Create API Key</b> and copy the key (<code>pmk_…</code>).</li>
          </ol>
          <img
            src="/owox-api-key-guide.png"
            alt="OWOX → Project settings → My API Keys → Create API Key"
            className="mt-3 w-full rounded-lg border border-[#e6e9f0]"
          />
        </div>
      </div>
    </div>
  );
}
