import { useEffect, useRef } from "react";

// "Living Semantic Layer" hero — adapted from the Claude Design source
// (Living Semantic Layer Hero.dc.html). The diagram is authored at a fixed
// 1500×1480 canvas; we scale it to fit whatever width the modal gives us and
// replay the knowledge-graph edge "draw-in" once on mount.
const DIAGRAM_HTML = `
<div data-diagram style="position:relative;width:1500px;height:1480px;flex-shrink:0;transform-origin:center center;transform:scale(0.25);">

  <!-- TOP TIER : STORAGES & SOURCES (subdued) -->
  <div style="position:absolute;left:0;right:0;top:14px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;letter-spacing:0.26em;color:#7E818A;">STORAGES &amp; SOURCES</div>
  <div style="position:absolute;left:0;right:0;top:236px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:0.05em;color:#54575E;">your warehouse — data never moves</div>

  <div style="opacity:0.72;">
    <div style="position:absolute;left:332px;top:108px;height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#0F1012;border:1px solid #2A2C31;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#C9CCD2;white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.4" fill="none" stroke="#4285F4" stroke-width="2.2"></circle><path d="M15.6 15.6 L20 20" stroke="#4285F4" stroke-width="2.6" stroke-linecap="round"></path><circle cx="11" cy="11" r="2.3" fill="#4285F4"></circle></svg>bigquery</div>
    <div style="position:absolute;left:560px;top:74px;height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#0F1012;border:1px solid #2A2C31;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#C9CCD2;white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24" stroke="#29B5E8" stroke-width="1.7" stroke-linecap="round" fill="none"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"></path><path d="M12 6l-2.2-2.2M12 6l2.2-2.2M12 18l-2.2 2.2M12 18l2.2 2.2"></path></svg>snowflake</div>
    <div style="position:absolute;left:790px;top:70px;height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#0F1012;border:1px solid #2A2C31;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#C9CCD2;white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24" fill="#FF3621"><path d="M12 3 21 8 12 13 3 8z" opacity=".9"></path><path d="M3 12 12 17 21 12 21 14 12 19 3 14z"></path></svg>databricks</div>
    <div style="position:absolute;left:1018px;top:108px;height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#0F1012;border:1px solid #2A2C31;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#C9CCD2;white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24"><rect x="6" y="3" width="5" height="18" rx="2.5" fill="#FBBC04" transform="rotate(20 8.5 12)"></rect><rect x="13" y="3" width="5" height="18" rx="2.5" fill="#4285F4" transform="rotate(20 15.5 12)"></rect></svg>google-ads</div>
    <div style="position:absolute;left:470px;top:172px;height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#0F1012;border:1px solid #2A2C31;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#C9CCD2;white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24"><path d="M14 5.5c-.2-.5-.6-.6-.9-.6 0 0-.2-.6-1-.6-.9 0-1.4.9-1.6 1.6l-2.7.8c-.5.1-.5.2-.6.6L5 19l9 1.6 3-1.9-2.4-13c-.1-.2-.3-.2-.6-.2z" fill="#95BF47"></path><path d="M12.2 9.2s-.7-.4-1.4-.4c-1 0-1.1.6-1.1.8 0 .9 2.3 1.2 2.3 3.2 0 1.6-1 2.6-2.4 2.6-1.6 0-2.5-1-2.5-1l.4-1.4s.9.7 1.7.7c.5 0 .7-.4.7-.7 0-1.1-1.9-1.2-1.9-3 0-1.5 1.1-3 3.4-3 .9 0 1.3.3 1.3.3z" fill="#fff"></path></svg>shopify</div>
    <div style="position:absolute;left:858px;top:172px;height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#0F1012;border:1px solid #2A2C31;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.55);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#C9CCD2;white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24"><rect x="4" y="11" width="4" height="9" rx="2" fill="#F9AB00"></rect><rect x="11" y="6" width="4" height="14" rx="2" fill="#E37400"></rect><circle cx="19" cy="9" r="2.3" fill="#F9AB00"></circle></svg>ga4</div>
  </div>

  <!-- SVG LINE LAYER -->
  <svg viewBox="0 0 1500 1480" style="position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;overflow:visible;">
    <g style="opacity:0.5;">
      <path d="M392 154 L735 470" fill="none" stroke="#6B6E76" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round" style="animation:dashFlow 1.5s linear infinite;"></path>
      <path d="M620 120 L745 470" fill="none" stroke="#6B6E76" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round" style="animation:dashFlow 1.5s linear infinite;"></path>
      <path d="M845 116 L755 470" fill="none" stroke="#6B6E76" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round" style="animation:dashFlow 1.5s linear infinite;"></path>
      <path d="M1085 154 L765 470" fill="none" stroke="#6B6E76" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round" style="animation:dashFlow 1.5s linear infinite;"></path>
      <path d="M540 218 L740 470" fill="none" stroke="#6B6E76" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round" style="animation:dashFlow 1.5s linear infinite;"></path>
      <path d="M928 218 L760 470" fill="none" stroke="#6B6E76" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round" style="animation:dashFlow 1.5s linear infinite;"></path>
    </g>
    <g data-edges>
      <path data-edge d="M548 566 L760 590" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M760 590 L876 700" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M760 590 L985 568" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M420 654 L630 698" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M630 698 L700 782" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M700 782 L876 700" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M462 758 L700 782" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M548 566 L548 848" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
      <path data-edge d="M548 848 L800 868" fill="none" stroke="#7FA6D8" stroke-width="1.6" stroke-linecap="round"></path>
    </g>
    <g style="opacity:0.7;">
      <path d="M745 905 L430 1118" fill="none" stroke="#3B8DE3" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round" style="animation:dashFlow 1.3s linear infinite;"></path>
      <path d="M750 905 L750 1118" fill="none" stroke="#3B8DE3" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round" style="animation:dashFlow 1.3s linear infinite;"></path>
      <path d="M755 905 L1070 1118" fill="none" stroke="#3B8DE3" stroke-width="1.5" stroke-dasharray="3 7" stroke-linecap="round" style="animation:dashFlow 1.3s linear infinite;"></path>
    </g>
    <line x1="250" y1="1000" x2="1250" y2="1000" stroke="#2FB6A0" stroke-width="1.6" stroke-dasharray="8 8" style="animation:gatePulse 2s ease-in-out infinite;"></line>
  </svg>

  <!-- MIDDLE TIER : DATA MARTS — MODEL (focus) -->
  <div style="position:absolute;left:330px;top:880px;width:840px;height:60px;z-index:1;background:radial-gradient(50% 50% at 50% 0,rgba(0,0,0,0.65),transparent 72%);filter:blur(10px);"></div>
  <div style="position:absolute;left:300px;top:452px;width:900px;height:430px;z-index:2;clip-path:polygon(120px 0,780px 0,900px 430px,0 430px);background:linear-gradient(165deg,#191A1F 0%,#0E0F12 100%);box-shadow:inset 0 1.5px 0 #2F3137;"></div>
  <div style="position:absolute;left:300px;top:879px;width:900px;height:16px;z-index:2;background:#0A0B0D;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);"></div>
  <div style="position:absolute;left:430px;top:540px;width:640px;height:330px;z-index:2;background:radial-gradient(50% 50% at 50% 50%,rgba(59,141,227,0.16),transparent 70%);pointer-events:none;"></div>

  <div style="position:absolute;left:300px;top:408px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:17px;letter-spacing:0.2em;color:#A9ACB3;z-index:6;">DATA MARTS — MODEL</div>

  <div style="position:absolute;left:1004px;top:486px;z-index:6;display:flex;align-items:center;gap:7px;padding:7px 13px;background:rgba(47,182,160,0.09);border:1px solid rgba(47,182,160,0.55);border-radius:9px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#6FE0CC;box-shadow:0 0 18px rgba(47,182,160,0.18);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2FB6A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"></path></svg>analyst-owned SQL</div>

  <div style="position:absolute;left:0;right:0;top:910px;text-align:center;z-index:6;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;letter-spacing:0.04em;color:#797C84;">a light model — not an 18-month ontology project</div>

  <div style="position:absolute;inset:0;z-index:5;">
    <div style="position:absolute;left:548px;top:566px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20"></path><circle cx="11" cy="8" r="3.5"></circle><path d="M18 14.2a3 3 0 0 0 0-5.4"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Customers</span></div>
    <div style="position:absolute;left:760px;top:590px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.3"></circle><circle cx="17" cy="20" r="1.3"></circle><path d="M3 4h2l2 12h11l2-8H6"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Orders</span></div>
    <div style="position:absolute;left:985px;top:568px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"></path><path d="M3 8l9 5 9-5M12 13v8"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Products</span></div>
    <div style="position:absolute;left:420px;top:654px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2l11 5V6L3 11z"></path><path d="M14 8a3 3 0 0 1 0 8"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Campaigns</span></div>
    <div style="position:absolute;left:630px;top:698px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="2"></rect><circle cx="12" cy="12" r="2.2"></circle></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Ad Spend</span></div>
    <div style="position:absolute;left:876px;top:700px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:10px 17px;background:linear-gradient(160deg,#13314E,#102234);border:1.5px solid #3B8DE3;border-radius:11px;box-shadow:0 0 22px rgba(59,141,227,0.4),0 4px 12px rgba(0,0,0,0.5);white-space:nowrap;"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9BCBFB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"></path><path d="M17 8h4v4"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15.5px;color:#EAF2FD;">Revenue</span></div>
    <div style="position:absolute;left:462px;top:758px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Sessions</span></div>
    <div style="position:absolute;left:700px;top:782px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="6" r="2"></circle><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="8" r="2"></circle><path d="M7 8v8M17 10v1a4 4 0 0 1-4 4H7"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Attribution</span></div>
    <div style="position:absolute;left:548px;top:848px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l3 3-3 3"></path><path d="M4 11V9a3 3 0 0 1 3-3h13"></path><path d="M7 21l-3-3 3-3"></path><path d="M20 13v2a3 3 0 0 1-3 3H4"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">LTV</span></div>
    <div style="position:absolute;left:800px;top:868px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;background:#1C1D21;border:1px solid #3A3C43;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.55);white-space:nowrap;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7CB8F2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5z"></path><path d="M3 13l9 5 9-5"></path></svg><span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;color:#E4E6EA;">Cohorts</span></div>
  </div>

  <div style="position:absolute;left:0;right:0;top:982px;display:flex;justify-content:center;z-index:7;"><span style="display:inline-flex;align-items:center;gap:9px;padding:8px 17px;background:#0B0C0E;border:1px solid rgba(47,182,160,0.6);border-radius:22px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:0.04em;color:#8FE6D6;box-shadow:0 0 20px rgba(47,182,160,0.22);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2FB6A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>AI queries marts — never raw tables</span></div>

  <!-- BOTTOM TIER : DELIVERY (subdued) -->
  <div style="opacity:0.82;">
    <div style="position:absolute;left:354px;top:1130px;width:152px;height:90px;background:#16171B;border:1px solid #2E3036;border-radius:9px;box-shadow:0 12px 26px rgba(0,0,0,0.55);overflow:hidden;display:flex;align-items:center;justify-content:center;"><svg width="124" height="70" viewBox="0 0 128 74" fill="none"><rect x="6" y="10" width="54" height="52" rx="3" stroke="#cfd2d8" stroke-width="1.2"></rect><rect x="14" y="40" width="7" height="16" fill="#3B8DE3"></rect><rect x="25" y="32" width="7" height="24" fill="#3B8DE3"></rect><rect x="36" y="46" width="7" height="10" fill="#3B8DE3"></rect><rect x="68" y="10" width="54" height="52" rx="3" stroke="#cfd2d8" stroke-width="1.2"></rect><polyline points="76,52 86,40 96,46 106,30 116,38" stroke="#3B8DE3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></polyline></svg></div>
    <div style="position:absolute;left:300px;top:1238px;width:260px;text-align:center;font-size:19px;font-weight:600;color:#E6E8EC;">Self-Service Reports</div>
    <div style="position:absolute;left:290px;top:1272px;width:280px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:0.03em;color:#6B6E76;">Sheets · Looker Studio · Email</div>
    <div style="position:absolute;left:674px;top:1130px;width:152px;height:90px;background:#16171B;border:1px solid #2E3036;border-radius:9px;box-shadow:0 12px 26px rgba(0,0,0,0.55);overflow:hidden;display:flex;align-items:center;justify-content:center;"><svg width="124" height="70" viewBox="0 0 128 74" fill="none"><rect x="12" y="14" width="70" height="20" rx="7" stroke="#cfd2d8" stroke-width="1.2"></rect><line x1="22" y1="22" x2="60" y2="22" stroke="#9A9DA4" stroke-width="1.4" stroke-linecap="round"></line><line x1="22" y1="27" x2="48" y2="27" stroke="#9A9DA4" stroke-width="1.4" stroke-linecap="round"></line><rect x="46" y="42" width="70" height="20" rx="7" fill="rgba(59,141,227,0.12)" stroke="#3B8DE3" stroke-width="1.2"></rect><line x1="56" y1="50" x2="96" y2="50" stroke="#7CB5EF" stroke-width="1.4" stroke-linecap="round"></line><line x1="56" y1="55" x2="80" y2="55" stroke="#7CB5EF" stroke-width="1.4" stroke-linecap="round"></line></svg></div>
    <div style="position:absolute;left:620px;top:1238px;width:260px;text-align:center;font-size:19px;font-weight:600;color:#E6E8EC;">Conversational AI</div>
    <div style="position:absolute;left:610px;top:1272px;width:280px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:0.03em;color:#6B6E76;">MCP · AI assistant · Slack · Teams</div>
    <div style="position:absolute;left:994px;top:1130px;width:152px;height:90px;background:#16171B;border:1px solid #2E3036;border-radius:9px;box-shadow:0 12px 26px rgba(0,0,0,0.55);overflow:hidden;display:flex;align-items:center;justify-content:center;"><svg width="124" height="70" viewBox="0 0 128 74" fill="none"><rect x="34" y="8" width="60" height="58" rx="4" stroke="#cfd2d8" stroke-width="1.2"></rect><line x1="44" y1="20" x2="84" y2="20" stroke="#9A9DA4" stroke-width="1.4" stroke-linecap="round"></line><line x1="44" y1="28" x2="84" y2="28" stroke="#9A9DA4" stroke-width="1.4" stroke-linecap="round"></line><line x1="44" y1="36" x2="72" y2="36" stroke="#9A9DA4" stroke-width="1.4" stroke-linecap="round"></line><circle cx="90" cy="58" r="13" fill="#0B0C0E" stroke="#2FB6A0" stroke-width="1.4"></circle><path d="M84 58l4 4 8-8" stroke="#2FB6A0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path></svg></div>
    <div style="position:absolute;left:940px;top:1238px;width:260px;text-align:center;font-size:19px;font-weight:600;color:#E6E8EC;">Hallucination-Free Insights</div>
    <div style="position:absolute;left:930px;top:1272px;width:280px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:0.03em;color:#6B6E76;">AI narrative reports, governed by marts</div>
    <div style="position:absolute;left:0;right:0;top:1326px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;letter-spacing:0.26em;color:#7E818A;">DELIVERY</div>
  </div>

</div>`;

export function OwoxDataMartsHero() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const dia = root.querySelector<HTMLElement>("[data-diagram]");
    if (!dia) return;

    // Replay the knowledge-graph edge draw-in once on mount.
    root.querySelectorAll<SVGPathElement>("[data-edge]").forEach((p, i) => {
      const len = (p as SVGGeometryElement).getTotalLength();
      p.style.setProperty("--len", String(len));
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.style.animation = "owoxDrawIn .9s ease forwards";
      p.style.animationDelay = `${0.15 + i * 0.08}s`;
    });

    const fit = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (!w || !h) return;
      const s = Math.min((w - 16) / 1500, (h - 16) / 1480);
      dia.style.transform = `scale(${s})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-xl border border-[#1d1f24]"
      style={{ aspectRatio: "1500 / 1480", background: "#0A0A0B" }}
    >
      <style>{`
        @keyframes dashFlow { to { stroke-dashoffset: -32; } }
        @keyframes gatePulse { 0%,100% { opacity:.4; } 50% { opacity:.95; } }
        @keyframes owoxDrawIn { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
      `}</style>
      {/* faint crosshair grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='62'%20height='62'%3E%3Cpath%20d='M31%2025v12M25%2031h12'%20stroke='%23ffffff'%20stroke-opacity='0.06'%20stroke-width='1'/%3E%3C/svg%3E\")",
          backgroundSize: "62px 62px",
        }}
      />
      {/* centre glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(60% 42% at 50% 50%,rgba(59,141,227,0.10),transparent 70%)",
        }}
      />
      {/* scaled diagram — trusted, hand-authored markup from our own design source */}
      <div
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        dangerouslySetInnerHTML={{ __html: DIAGRAM_HTML }}
      />
    </div>
  );
}
