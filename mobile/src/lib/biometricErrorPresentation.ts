import { ApiError } from './apiClient';

export interface BiometricAttemptOutcome {
  /** True only when there is genuinely nothing to retry biometrically — no saved
   * credential exists, or the saved password was rejected by the server. False
   * for a native biometric-prompt failure (wrong fingerprint, cancellation, a
   * temporary lockout), where retrying the SAME prompt may still succeed. */
  fallBackToPasswordForm: boolean;
  /** Scoped to whichever view the outcome is shown on — never a password-form
   * message bleeding onto the biometric view or vice versa. */
  message: string;
}

/**
 * `loginWithSavedCredential()` (AuthContext) throws from exactly two kinds of
 * places: an `ApiError` when there's a real account-level reason biometric
 * sign-in can't proceed (nothing saved on this device, or the saved password no
 * longer matches the server) — retrying the identical fingerprint/Face ID prompt
 * cannot fix either of those, so falling back to the password form is correct.
 * Anything else reaches here from the native biometric prompt itself (a wrong
 * fingerprint, the user cancelling, or a temporary lockout) — none of those are
 * password problems, so the caller should stay on the biometric screen and let
 * the person simply try again, with the password form still one tap away via
 * the always-visible "Use password instead" action.
 */
export function classifyBiometricFailure(err: unknown, label: string): BiometricAttemptOutcome {
  if (err instanceof ApiError) {
    return { fallBackToPasswordForm: true, message: err.message };
  }
  return { fallBackToPasswordForm: false, message: `${label} not recognized. Try again, or use your password.` };
}
