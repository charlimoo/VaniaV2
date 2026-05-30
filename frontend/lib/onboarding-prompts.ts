export const SIGNUP_PROFILE_PROMPT_KEY = "vania.prompt.signupProfile";
export const LOGIN_PWA_PROMPT_KEY = "vania.prompt.loginPwa";
export const PWA_DISMISSED_KEY = "vania.pwaInstall.dismissedAt";
export const PROFILE_PROMPT_SHOWN_KEY = "vania.profilePrompt.shownAt";
export const PROFILE_PROMPT_SESSION_KEY = "vania.profilePrompt.shownInSession";

export const markSignupProfilePromptPending = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PROFILE_PROMPT_SESSION_KEY);
  sessionStorage.setItem(SIGNUP_PROFILE_PROMPT_KEY, "1");
};

export const markLoginPwaPromptPending = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PROFILE_PROMPT_SESSION_KEY);
  sessionStorage.setItem(LOGIN_PWA_PROMPT_KEY, "1");
};
