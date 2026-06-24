// Outbound links to OWOX. The signup URL is the conversion bridge for anonymous
// users who don't have an OWOX account yet (the canvas works without one — only
// Push needs a key). Each call site passes a placement so marketing can attribute
// which surface drove the signup via utm_content.

const SIGNUP_BASE = "https://www.owox.com/app-signup";

/** OWOX free-signup URL with campaign UTMs. `placement` identifies the surface
 *  the user clicked from (e.g. "signin_modal", "topbar"). */
export function signupUrl(placement: string): string {
  const params = new URLSearchParams({
    utm_source: "model-canvas",
    utm_medium: "app",
    utm_campaign: "model_canvas_leadgen",
    utm_content: placement,
  });
  return `${SIGNUP_BASE}?${params.toString()}`;
}

// Guide for importing an existing model (OKF bundle / OWOX project) into the
// canvas — the same AI-instructions page linked from the Import OKF dialog.
export const IMPORT_GUIDE_URL = "/ai-instructions.html";
