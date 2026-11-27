/** The app intentionally offers Google as its only sign-in provider. */
export const GOOGLE_PROVIDER = {
  id: "google",
  label: "Google",
} as const;

export type GoogleProviderId = typeof GOOGLE_PROVIDER.id;
