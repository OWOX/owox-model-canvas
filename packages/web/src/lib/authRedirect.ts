// Set true right before an intentional OAuth redirect (Google/GitHub) so the
// canvas's "unsaved work" beforeunload guard doesn't prompt the user with
// "Leave site?" as they're deliberately leaving for the provider and back.
let redirecting = false;
export const setAuthRedirecting = (v: boolean) => { redirecting = v; };
export const isAuthRedirecting = () => redirecting;
