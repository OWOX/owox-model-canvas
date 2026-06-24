import { useEffect, useState } from "react";
import { Download, Upload, ChevronDown, Target } from "lucide-react";
import { ProjectIcon, StorageIcon, LibraryIcon } from "../lib/icons";

// First-visit onboarding hint pointing at the Library. Persisted so it only
// ever shows once per browser; dismissed as soon as the user hovers it.
const LIBRARY_HINT_KEY = "mc.libraryHint.v1";

export interface StorageOption { id: string; title: string; type: string; }

export interface TopBarProps {
  pendingCount?: number;
  storages?: StorageOption[];
  storageId?: string | null;
  onStorageChange?: (id: string) => void;
  onImport?: () => void;
  onImportFromOwox?: () => void;
  onExport?: () => void;
  onPush?: () => void;
  onLibrary?: () => void;
  signedIn: boolean;
  projectTitle?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onOpenGoal?: () => void;
  goalSet?: boolean;
  questionsEnabled?: boolean;
}

const LOGO = (
  <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" width={24} height={24}>
    <path d="M421.311 119.85C435.258 133.807 440.996 157.327 440.996 157.327C440.996 157.327 449.53 204.69 449.53 268.995C449.53 177.972 418.65 162.348 311.314 162.348H212.327C157.38 162.348 161.097 217.57 157.38 243.85L152.865 283.556C150.697 325.33 157.951 351.215 200.811 351.215C111.444 351.215 61.806 365.847 61.8062 239.866C61.8061 182.846 70.4043 157.327 70.4043 157.327C70.4043 157.327 76.1419 133.807 90.1183 119.85C104.095 105.877 124.809 104.475 124.809 104.475C124.809 104.475 167.579 98.0374 252.066 98.0374C336.554 98.0374 384.285 104.475 384.285 104.475C384.285 104.475 407.321 105.877 421.311 119.85Z" fill="url(#topbar-g0)"/>
    <path d="M449.515 271.888C449.52 273.026 449.523 274.174 449.523 275.333C449.523 329.946 441.393 351.201 441.393 351.201C441.393 351.201 435.03 376.952 424.167 388.075C406.929 405.725 388.495 406.71 388.495 406.71C388.495 406.71 348.836 413.061 263.502 413.061C181.632 413.061 127.111 406.749 127.111 406.749C127.111 406.749 104.091 405.337 90.1144 391.377C76.1379 377.394 70.4004 351.201 70.4004 351.201C70.4004 351.201 61.8062 297.401 61.8062 238.506C61.806 352.055 102.131 351.374 175.525 350.133C183.56 349.998 191.992 349.855 200.811 349.855H299.787C343.122 349.855 352.906 318.315 354.792 282.196L359.32 227.093C360.526 204.443 357.608 188.362 350.507 178.012C342.765 166.722 329.575 160.987 311.314 160.987C424.974 160.987 448.73 176.216 449.515 271.888Z" fill="url(#topbar-g1)"/>
    <defs>
      <linearGradient id="topbar-g0" x1="255.15" y1="98" x2="256.871" y2="367" gradientUnits="userSpaceOnUse">
        <stop stopColor="#05D2FF"/>
        <stop offset=".15" stopColor="#21A1F1"/>
        <stop offset=".4" stopColor="#1E88E5"/>
        <stop offset=".72" stopColor="#1E6EE5"/>
        <stop offset="1" stopColor="#182FFF"/>
      </linearGradient>
      <linearGradient id="topbar-g1" x1="85.6" y1="412.6" x2="394" y2="143.8" gradientUnits="userSpaceOnUse">
        <stop stopColor="#24D8FF"/>
        <stop offset=".15" stopColor="#21A1F1"/>
        <stop offset=".4" stopColor="#1E88E5"/>
        <stop offset=".75" stopColor="#1E7AE5"/>
        <stop offset="1" stopColor="#0046F9"/>
      </linearGradient>
    </defs>
  </svg>
);

export function TopBar({
  pendingCount = 0, storages = [], storageId, onStorageChange,
  onImport, onImportFromOwox, onExport, onPush, onLibrary,
  signedIn, projectTitle, onSignIn, onSignOut,
  onOpenGoal, goalSet = false, questionsEnabled = false,
}: TopBarProps) {
  // Push split-button menu (holds the signed-in "Import from OWOX project" action).
  const [menuOpen, setMenuOpen] = useState(false);
  // Show the Library hint on first ever visit; stays lit until hovered.
  const [showLibraryHint, setShowLibraryHint] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(LIBRARY_HINT_KEY)) setShowLibraryHint(true); } catch { /* private mode */ }
  }, []);
  const dismissLibraryHint = () => {
    setShowLibraryHint(false);
    try { localStorage.setItem(LIBRARY_HINT_KEY, "seen"); } catch { /* private mode */ }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-[9px] bg-white border-b border-[#d8dee8] flex-shrink-0 z-30">
      {/* Brand — logo links to owox.com */}
      <div className="flex items-center gap-[9px] font-[650] text-[15px] tracking-[-0.2px]">
        <a
          href="https://owox.com"
          target="_blank"
          rel="noreferrer"
          title="OWOX — owox.com"
          aria-label="OWOX — owox.com"
          className="flex items-center rounded-md transition-opacity hover:opacity-80"
        >
          {LOGO}
        </a>
        <span>Model Canvas</span>
      </div>

      {/* Business Goal — low-key icon-only entry point for Insight Questions.
          Hidden unless the server reports GEMINI_API_KEY is set (questionsEnabled),
          so the experimental feature is a pure env-only on/off switch. */}
      {questionsEnabled && (
        <button
          onClick={onOpenGoal}
          aria-label="Business Goal"
          title="Business Goal — see questions your model unlocks"
          className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center cursor-pointer transition-colors ${goalSet ? "text-[#1e88e5] bg-[#e6f1fb]" : "text-slate-400 hover:bg-[#f1f3f7] hover:text-slate-600"}`}
        >
          <Target size={17} />
        </button>
      )}

      {/* Project picker chip */}
      {signedIn && (
        <button className="flex items-center gap-[7px] text-[13px] text-slate-500 border border-[#d8dee8] rounded-lg px-[10px] py-[5px] bg-white cursor-pointer hover:bg-[#f1f3f7]">
          <ProjectIcon size={14} /> Project: <span className="text-slate-900 font-semibold">{projectTitle ?? "—"}</span> ▾
        </button>
      )}

      {/* Storage picker — one storage per model (joinable requires same storage) */}
      {signedIn && (
        <label className="flex items-center gap-[7px] text-[13px] text-slate-500 border border-[#d8dee8] rounded-lg px-[10px] py-[5px] bg-white" title="One storage per model — joinable relationships require all marts on the same storage">
          <StorageIcon size={14} /> Storage:
          <select
            value={storageId ?? ""}
            onChange={e => onStorageChange?.(e.target.value)}
            className="text-slate-900 font-semibold bg-white outline-none cursor-pointer"
          >
            {storages.length === 0 && <option value="">—</option>}
            {storages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
      )}

      <div className="flex-1" />

      {/* Template library */}
      <div className="relative">
        {/* Pulsing ring highlights the Library control on first visit */}
        {showLibraryHint && (
          <span className="absolute -inset-[3px] rounded-[10px] ring-2 ring-[#1e88e5]/60 animate-pulse pointer-events-none" />
        )}
        <button
          onClick={() => { dismissLibraryHint(); onLibrary?.(); }}
          title="Template library"
          className="text-[13px] font-[550] text-slate-900 border border-[#d8dee8] bg-white rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
        >
          <LibraryIcon size={15} /> Library
        </button>
        {showLibraryHint && (
          <div
            role="tooltip"
            onMouseEnter={dismissLibraryHint}
            className="absolute top-[calc(100%+11px)] right-0 z-40 w-[232px] rounded-lg bg-slate-900 text-white text-[12.5px] leading-[1.45] px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.28)] cursor-default"
          >
            <span className="absolute -top-[5px] right-[18px] w-[10px] h-[10px] bg-slate-900 rotate-45" />
            Roll out a basic model of your business from the library — or build it from scratch.
          </div>
        )}
      </div>

      {/* Import OKF */}
      <button
        onClick={onImport}
        className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
      >
        <Download size={15} /> Import OKF
      </button>

      {/* Export OKF */}
      <button
        onClick={onExport}
        className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
      >
        <Upload size={15} /> Export OKF
      </button>

      {/* Push to OWOX — split button: primary push + caret menu (signed-in only)
          holding the less-common "Import from OWOX project" action. */}
      <div className="relative flex items-center">
        <button
          onClick={onPush}
          className={`text-[13px] font-[550] bg-[#1e88e5] text-white border border-[#1e88e5] px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#1976d2] ${signedIn ? "rounded-l-lg border-r-0" : "rounded-lg"}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={15} height={15}>
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
          Push to OWOX{pendingCount > 0 && <span className="opacity-80">({pendingCount})</span>}
        </button>
        {signedIn && (
          <>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="More OWOX actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="text-white bg-[#1e88e5] border border-[#1e88e5] border-l border-l-[#4d97e8] rounded-r-lg px-[7px] py-[9px] cursor-pointer hover:bg-[#1976d2] flex items-center"
            >
              <ChevronDown size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="absolute top-[calc(100%+6px)] right-0 z-50 w-[230px] rounded-lg border border-[#d8dee8] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] py-1">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onImportFromOwox?.(); }}
                    className="w-full text-left text-[13px] text-slate-900 px-3 py-2 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7]"
                  >
                    <Download size={15} /> Import from OWOX project
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {signedIn ? (
        <button
          onClick={onSignOut}
          className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer hover:bg-[#f1f3f7]"
        >
          Sign out
        </button>
      ) : (
        <button
          onClick={onSignIn}
          className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer hover:bg-[#f1f3f7]"
        >
          Sign in
        </button>
      )}
    </div>
  );
}
