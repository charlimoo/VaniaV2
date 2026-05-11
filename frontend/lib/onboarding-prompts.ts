export const SIGNUP_PROFILE_PROMPT_KEY = "vania.prompt.signupProfile";
export const LOGIN_PWA_PROMPT_KEY = "vania.prompt.loginPwa";
export const PWA_DISMISSED_KEY = "vania.pwaInstall.dismissedAt";

export const markSignupProfilePromptPending = () => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SIGNUP_PROFILE_PROMPT_KEY, "1");
};

export const markLoginPwaPromptPending = () => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LOGIN_PWA_PROMPT_KEY, "1");
};
