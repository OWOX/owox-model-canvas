// The model's display name — shown (and edited) in the top bar, used as the
// default when saving to an account. Persisted so a refresh keeps it, mirroring
// how the model itself and the business goal are persisted.
const KEY = "mc.modelName.v1";

export const DEFAULT_MODEL_NAME = "My first OKF with OWOX";

/** Default name for a model started from a template, e.g. "My SaaS / Subscription OKF with OWOX". */
export function templateModelName(templateName: string): string {
  return `My ${templateName} OKF with OWOX`;
}

export function loadModelName(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_MODEL_NAME;
  } catch {
    return DEFAULT_MODEL_NAME;
  }
}

export function persistModelName(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Ignore quota / private-mode failures — persistence is best-effort.
  }
}
