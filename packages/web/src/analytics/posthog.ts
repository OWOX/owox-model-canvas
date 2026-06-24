import posthog from "posthog-js";

// Analytics is wired to the SAME PostHog project as owox.com (token below comes
// from env). Config mirrors the owox.com product zone 1:1 so a user's session
// stitches across owox.com → model.owox.com:
//   - same project token + cross_subdomain_cookie on `.owox.com` keeps one
//     distinct_id/session as the user moves between the marketing/app and here;
//   - person_profiles: "identified_only" matches owox.com so anon canvas users
//     merge into their product identity once owox.com calls identify();
//   - traffic goes through the managed reverse proxy mrph.owox.com (asset_host
//     is null upstream, so the recorder bundle loads from there too — see CSP
//     in server/src/app.ts).
// Inputs are masked in session replay so the OWOX API key typed into the
// Sign-in modal never lands in a recording; canvas text stays visible (the
// user opted to see the canvas in playbacks).
const KEY = import.meta.env.VITE_POSTHOG_KEY;

export function initAnalytics() {
  // No key in dev / preview deploys → stay silent instead of polluting the
  // shared production project. Tests (jsdom, no env) skip for the same reason.
  if (!KEY) return;
  posthog.init(KEY, {
    api_host: "https://mrph.owox.com",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    autocapture: true,
    persistence: "localStorage+cookie",
    cross_subdomain_cookie: true,
    secure_cookie: true,
    person_profiles: "identified_only",
    ip: false,
    disable_web_experiments: true,
    session_recording: { maskAllInputs: true, strictMinimumDuration: true },
  });
}

export { posthog };
