import { useState } from "react";
import { Save, Clock, Layers } from "lucide-react";

// SVGs reused from AccountDialog.tsx
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.52.56.83 1.28.83 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const PERKS = [
  {
    icon: <Save size={16} />,
    title: "Saves",
    desc: "Keep your work — open it from any device",
  },
  {
    icon: <Clock size={16} />,
    title: "Version history",
    desc: "See changes over time and restore any version",
  },
  {
    icon: <Layers size={16} />,
    title: "Multiple models",
    desc: "Keep several models and switch between them",
  },
];

export function EnablePanel({
  onGoogle,
  onGitHub,
  onEmail,
}: {
  onGoogle(): void;
  onGitHub(): void;
  onEmail(email: string): void;
}) {
  const [email, setEmail] = useState("");

  return (
    <div className="flex flex-col gap-5">
      {/* Intro copy — concise, friendly, honest about the email opt-in. */}
      <p className="text-[13px] leading-relaxed text-slate-600">
        Unlock extra capabilities with a free account. It&apos;s free — we just
        need to verify you&apos;re a real person. And, honestly, we&apos;ll
        occasionally email you about data-modeling topics (unsubscribe anytime —
        no hard feelings).
      </p>

      {/* Perk rows — descriptive only, NOT interactive */}
      <div className="flex flex-col gap-2" aria-label="Included features">
        {PERKS.map(p => (
          <div
            key={p.title}
            className="flex items-center gap-3 rounded-lg border border-[#d8dee8] px-3 py-2.5"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#e6f1fb] text-[#1e88e5]">
              {p.icon}
            </div>
            <div>
              <div className="text-[13px] font-medium text-slate-900">{p.title}</div>
              <div className="text-[12px] text-slate-500">{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* OAuth buttons */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onGoogle}
          className="flex items-center justify-center gap-2.5 rounded-lg border border-[#d8dee8] bg-white px-4 py-2.5 text-[14px] font-[550] text-slate-900 hover:bg-[#f1f3f7] cursor-pointer"
        >
          <GoogleMark /> Continue with Google
        </button>
        <button
          onClick={onGitHub}
          className="flex items-center justify-center gap-2.5 rounded-lg border border-[#d8dee8] bg-white px-4 py-2.5 text-[14px] font-[550] text-slate-900 hover:bg-[#f1f3f7] cursor-pointer"
        >
          <GitHubMark /> Continue with GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 text-[12px] text-slate-400">
        <span className="h-px flex-1 bg-[#e6e9f0]" />
        or
        <span className="h-px flex-1 bg-[#e6e9f0]" />
      </div>

      {/* Magic-link email */}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && email.trim()) onEmail(email.trim());
          }}
          placeholder="you@company.com"
          className="flex-1 rounded-lg border border-[#d8dee8] px-3 py-2.5 text-[14px] outline-none focus:border-[#1e88e5]"
        />
        <button
          onClick={() => { if (email.trim()) onEmail(email.trim()); }}
          className="rounded-lg bg-[#1e88e5] px-4 py-2.5 text-[14px] font-[550] text-white hover:bg-[#1976d2] cursor-pointer"
        >
          Send link
        </button>
      </div>

      {/* Legal note — 12 px muted, links open new tab */}
      <p className="text-[12px] leading-relaxed text-slate-400">
        By continuing you agree to our{" "}
        <a
          href="https://www.owox.com/policies/terms-of-service"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-600"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="https://www.owox.com/policies/privacy"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-slate-600"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
