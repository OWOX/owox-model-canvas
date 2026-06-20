import { Download, Upload } from "lucide-react";
import { ProjectIcon, StorageIcon, LibraryIcon } from "../lib/icons";

export interface StorageOption { id: string; title: string; type: string; }

export interface TopBarProps {
  pendingCount?: number;
  storages?: StorageOption[];
  storageId?: string | null;
  onStorageChange?: (id: string) => void;
  onImport?: () => void;
  onExport?: () => void;
  onPush?: () => void;
  onLibrary?: () => void;
  signedIn: boolean;
  projectTitle?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
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
  onImport, onExport, onPush, onLibrary,
  signedIn, projectTitle, onSignIn, onSignOut,
}: TopBarProps) {

  return (
    <div className="flex items-center gap-3 px-4 py-[9px] bg-white border-b border-[#d8dee8] flex-shrink-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-[9px] font-[650] text-[15px] tracking-[-0.2px]">
        {LOGO}
        <span>Model Canvas</span>
      </div>

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
      <button
        onClick={onLibrary}
        title="Template library"
        className="text-slate-600 border border-[#d8dee8] bg-white rounded-lg p-[7px] cursor-pointer flex items-center hover:bg-[#f1f3f7]"
      >
        <LibraryIcon size={16} />
      </button>

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

      {/* Push to OWOX */}
      <button
        onClick={onPush}
        className="text-[13px] font-[550] bg-[#4f46e5] text-white border border-[#4f46e5] rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#4338ca]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={15} height={15}>
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
        Push to OWOX{pendingCount > 0 && <span className="opacity-80">({pendingCount})</span>}
      </button>

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
