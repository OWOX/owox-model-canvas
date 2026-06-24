/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project token (public). Set in Render; unset in dev/preview. */
  readonly VITE_POSTHOG_KEY?: string;
}
