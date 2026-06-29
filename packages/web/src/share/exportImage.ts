import { toSvg } from "html-to-image";
import { getNodesBounds, type Node } from "@xyflow/react";

// Export the whole model (not just the visible viewport) as an SVG, with a minimal
// OWOX watermark in the bottom-right corner. Capturing the React Flow viewport
// element with an overridden transform renders every node at 1:1 regardless of
// the user's current pan/zoom.
//
// SVG (not PNG): React Flow renders nodes as HTML, so html-to-image wraps them in
// an SVG <foreignObject>. Rasterizing that to PNG taints the canvas in Chromium
// (a security rule) and toDataURL/toPng then hangs/throws. SVG sidesteps that and
// is the better format for a diagram anyway — vector, crisp at any size.

const PAD = 60; // px of breathing room around the model
const BG = "#f7f8fa"; // background (matches the app)

// OWOX logo paths (512 viewBox), scaled down inside the watermark.
const LOGO_P0 = "M421.311 119.85C435.258 133.807 440.996 157.327 440.996 157.327C440.996 157.327 449.53 204.69 449.53 268.995C449.53 177.972 418.65 162.348 311.314 162.348H212.327C157.38 162.348 161.097 217.57 157.38 243.85L152.865 283.556C150.697 325.33 157.951 351.215 200.811 351.215C111.444 351.215 61.806 365.847 61.8062 239.866C61.8061 182.846 70.4043 157.327 70.4043 157.327C70.4043 157.327 76.1419 133.807 90.1183 119.85C104.095 105.877 124.809 104.475 124.809 104.475C124.809 104.475 167.579 98.0374 252.066 98.0374C336.554 98.0374 384.285 104.475 384.285 104.475C384.285 104.475 407.321 105.877 421.311 119.85Z";
const LOGO_P1 = "M449.515 271.888C449.52 273.026 449.523 274.174 449.523 275.333C449.523 329.946 441.393 351.201 441.393 351.201C441.393 351.201 435.03 376.952 424.167 388.075C406.929 405.725 388.495 406.71 388.495 406.71C388.495 406.71 348.836 413.061 263.502 413.061C181.632 413.061 127.111 406.749 127.111 406.749C127.111 406.749 104.091 405.337 90.1144 391.377C76.1379 377.394 70.4004 351.201 70.4004 351.201C70.4004 351.201 61.8062 297.401 61.8062 238.506C61.806 352.055 102.131 351.374 175.525 350.133C183.56 349.998 191.992 349.855 200.811 349.855H299.787C343.122 349.855 352.906 318.315 354.792 282.196L359.32 227.093C360.526 204.443 357.608 188.362 350.507 178.012C342.765 166.722 329.575 160.987 311.314 160.987C424.974 160.987 448.73 176.216 449.515 271.888Z";

const WM_W = 168;
const WM_H = 26;
// Watermark as an SVG <g> the size WM_W×WM_H, ready to drop into a parent SVG.
function watermarkGroup(x: number, y: number): string {
  const logoScale = 20 / 512; // render the 512-unit logo at ~20px
  return (
    `<g transform="translate(${x},${y})" opacity="0.92">` +
    `<defs>` +
    `<linearGradient id="wmg0" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#05D2FF"/><stop offset=".4" stop-color="#1E88E5"/><stop offset="1" stop-color="#182FFF"/></linearGradient>` +
    `<linearGradient id="wmg1" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#24D8FF"/><stop offset=".4" stop-color="#1E88E5"/><stop offset="1" stop-color="#0046F9"/></linearGradient>` +
    `</defs>` +
    `<g transform="translate(2,3) scale(${logoScale})"><path d="${LOGO_P0}" fill="url(#wmg0)"/><path d="${LOGO_P1}" fill="url(#wmg1)"/></g>` +
    `<text x="28" y="18" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif" font-size="14" font-weight="600" fill="#475569">OWOX Data Marts</text>` +
    `</g>`
  );
}

function captureOptions(rfNodes: Node[]) {
  const bounds = getNodesBounds(rfNodes);
  const width = Math.ceil(bounds.width) + PAD * 2;
  const height = Math.ceil(bounds.height) + PAD * 2;
  // Translate so the model's top-left lands at (PAD, PAD); no scaling (1:1).
  const transform = `translate(${PAD - bounds.x}px, ${PAD - bounds.y}px) scale(1)`;
  return { width, height, style: { width: `${width}px`, height: `${height}px`, transform } };
}

/** Export the model as an SVG with the OWOX watermark embedded bottom-right. */
export async function exportCanvasSvg(rfNodes: Node[], filename = "model"): Promise<void> {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el || rfNodes.length === 0) return;
  const { width, height, style } = captureOptions(rfNodes);
  // Don't pass `backgroundColor` here: html-to-image paints it on the cloned
  // viewport <div>, which carries our translate() transform — so the fill gets
  // offset with the content and leaves part of the frame uncovered (the two-tone
  // background bug). Instead we inject a full-frame <rect> below, at (0,0).
  const dataUrl = await toSvg(el, { width, height, style, skipFonts: true });
  // toSvg returns a data: URI — decode, then inject a background rect right after
  // the opening <svg> tag (so it sits behind everything) and the watermark before </svg>.
  const raw = decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));
  const bgRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${BG}"/>`;
  const withBg = raw.replace(/(<svg[^>]*>)/, `$1${bgRect}`);
  const wm = watermarkGroup(width - WM_W - 14, height - WM_H - 14);
  const withWm = withBg.replace(/<\/svg>\s*$/, `${wm}</svg>`);

  const blob = new Blob([withWm], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
