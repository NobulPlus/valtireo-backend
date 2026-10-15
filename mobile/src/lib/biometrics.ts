import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricKind = 'face' | 'fingerprint' | 'generic';

export async function getAvailableBiometricKind(): Promise<BiometricKind | null> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return null;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) return null;

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  return types.length > 0 ? 'generic' : null;
}

export const BIOMETRIC_LABEL: Record<BiometricKind, string> = {
  face: 'Face ID',
  fingerprint: 'Fingerprint',
  generic: 'biometrics',
};
