import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';
import { BIOMETRIC_LABEL, getAvailableBiometricKind, type BiometricKind } from '../lib/biometrics';
import { classifyBiometricFailure } from '../lib/biometricErrorPresentation';
import { Button } from '../components/Button';
import { GeometricAccent } from '../components/GeometricAccent';
import { Input } from '../components/Input';
import { spacing, useTheme, useV2Colors, V2_FONTS, type V2Colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Design System v2 ("Warm & Human") Login — see docs/design-system/04-screen-specifications-login-home.md
 * (Revision 2). No gradient hero, no floating card: a single calm page background,
 * centered branding, pill-shaped fields/buttons, and three solid decorative accent
 * shapes (apricot-dominant in light mode, teal-dominant with one apricot "spark" dot
 * in dark mode, per the approved reference image).
 *
 * Pulled further off-canvas and toned down from the first pass — on a real device,
 * the previous sizes/offsets let the blobs' edges creep in behind the form fields
 * and the "or"/biometric row, reducing text/control contrast there. Pinned to the
 * four corners only, well clear of the centered content column.
 */
function DecorativeAccents({ scheme }: { scheme: 'light' | 'dark' }) {
  const v2 = useV2Colors();
  const largeBlobColor = scheme === 'dark' ? v2.primary : v2.accentApricot;
  const largeBlobOpacity = scheme === 'dark' ? 0.13 : 0.18;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GeometricAccent size={190} color={largeBlobColor} opacity={largeBlobOpacity} style={{ top: -95, left: -110 }} />
      <GeometricAccent size={210} color={largeBlobColor} opacity={largeBlobOpacity} style={{ bottom: -130, right: -115 }} />
      <GeometricAccent size={26} color={v2.accentApricot} opacity={0.8} style={{ bottom: 18, left: 18 }} />
    </View>
  );
}

export function LoginScreen({ navigation }: Props) {
  const { scheme } = useTheme();
  const v2 = useV2Colors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // A proportional top gap, clamped to a sensible range, so the layout reads as
  // "balanced" rather than cramped on compact phones or oddly empty-on-top on tall
  // ones — a fixed constant looked right only on the one size it was tuned against.
  const topGap = insets.top + clamp(windowHeight * 0.06, spacing.lg, spacing.xl * 1.5);
  const bottomGap = insets.bottom + clamp(windowHeight * 0.04, spacing.lg, spacing.xl);
  const styles = useMemo(() => makeStyles(v2, scheme), [v2, scheme]);
  const { login, biometricCredential, enableBiometricSignIn, loginWithSavedCredential } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deliberately separate from `error` — a password-form validation/API message
  // must never appear on the biometric view, or vice versa. See
  // classifyBiometricFailure() for why these two failure modes are distinct.
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [biometricKind, setBiometricKind] = useState<BiometricKind | null>(null);
  // null = no manual override yet, so the form shown follows biometricCredential as it loads.
  const [formOverride, setFormOverride] = useState<boolean | null>(null);
  const showPasswordForm = formOverride ?? !biometricCredential;

  function switchMode(toPasswordForm: boolean) {
    setFormOverride(toPasswordForm);
    setError(null);
    setBiometricError(null);
  }

  useEffect(() => {
    void getAvailableBiometricKind().then(setBiometricKind).catch(() => setBiometricKind(null));
  }, []);

  function offerToEnableBiometrics(forEmail: string, forPassword: string) {
    if (!biometricKind || biometricCredential) return;
    Alert.alert(
      `Use ${BIOMETRIC_LABEL[biometricKind]} to sign in?`,
      'Next time, you can skip typing your password on this device.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Enable', onPress: () => void enableBiometricSignIn(forEmail, forPassword).catch((err) => Alert.alert('Could not enable biometric sign-in', err instanceof Error ? err.message : 'Please use password sign-in.')) },
      ],
    );
  }

  async function handleSubmit() {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      offerToEnableBiometrics(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBiometricSignIn() {
    if (!biometricKind) return;
    setBiometricError(null);
    setIsBiometricSubmitting(true);
    try {
      // SecureStore itself authenticates before releasing the saved secret.
      await loginWithSavedCredential();
    } catch (err) {
      const outcome = classifyBiometricFailure(err, BIOMETRIC_LABEL[biometricKind]);
      if (outcome.fallBackToPasswordForm) {
        // A genuine account-level rejection (nothing saved, or the saved
        // password no longer works) — there's nothing left to retry
        // biometrically, so this is the one case that moves to the password form.
        setError(outcome.message);
        setFormOverride(true);
      } else {
        // A native prompt failure (wrong fingerprint, cancelled, or a lockout) —
        // not a password problem, so stay here and let the user simply retry;
        // "Use password instead" is still one tap away if they'd rather switch.
        setBiometricError(outcome.message);
      }
    } finally {
      setIsBiometricSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <DecorativeAccents scheme={scheme} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: topGap, paddingBottom: bottomGap }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBlock}>
            <Image source={require('../../assets/brand-mark.png')} style={styles.logo} accessibilityLabel="Valtireo logo" />
            <Text style={styles.wordmark}>Valtireo</Text>
            <Text style={styles.tagline}>People · Work · Progress</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your organization and keep things moving.</Text>

          <View style={styles.formArea}>
            {biometricCredential && !showPasswordForm ? (
              <View style={styles.formArea}>
                {/* Not "Signed in as" — authentication hasn't happened yet at this point, only identity recall. */}
                <Text style={styles.identityCaption}>Continue as {biometricCredential.name}</Text>
                <View style={styles.biometricIconWrap}>
                  <Ionicons name={biometricKind === 'face' ? 'scan-outline' : 'finger-print-outline'} size={30} color={v2.primary} />
                </View>
                <Button
                  variant="gradient"
                  label={`Sign in with ${biometricKind ? BIOMETRIC_LABEL[biometricKind] : 'biometrics'}`}
                  onPress={handleBiometricSignIn}
                  loading={isBiometricSubmitting}
                  disabled={!biometricKind}
                />
                {biometricError ? <Text style={styles.error}>{biometricError}</Text> : null}
                <Button variant="ghost" label="Use password instead" onPress={() => switchMode(true)} />
              </View>
            ) : (
              <View style={styles.formArea}>
                <Input
                  label="Email address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  leadingIcon="mail-outline"
                />
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  leadingIcon="lock-closed-outline"
                />

                <Pressable style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </Pressable>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Button variant="gradient" label="Sign in" onPress={handleSubmit} loading={isSubmitting} />

                {biometricCredential ? (
                  <>
                    <Text style={styles.orDivider}>or</Text>
                    <Button
                      variant="outlined"
                      label={`Sign in with ${biometricKind ? BIOMETRIC_LABEL[biometricKind] : 'biometrics'}`}
                      icon={biometricKind === 'face' ? 'scan-outline' : 'finger-print-outline'}
                      onPress={() => switchMode(false)}
                    />
                  </>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (v2: V2Colors, scheme: 'light' | 'dark') => StyleSheet.create({
  root: { flex: 1, backgroundColor: v2.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },

  brandBlock: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  logo: { width: 44, height: 44, borderRadius: 12 },
  wordmark: { fontFamily: V2_FONTS.manropeExtraBold, fontSize: 22, color: v2.ink, marginTop: spacing.xs },
  // Bumped from 12/interMedium — read as too faint/small on an actual device.
  tagline: { fontFamily: V2_FONTS.interSemiBold, fontSize: 13, color: v2.muted, letterSpacing: 0.2 },

  title: { fontFamily: V2_FONTS.manropeBold, fontSize: 22, lineHeight: 28, color: v2.ink, textAlign: 'center' },
  subtitle: { fontFamily: V2_FONTS.interRegular, fontSize: 15, lineHeight: 21, color: v2.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl, maxWidth: 300 },

  formArea: { width: '100%', maxWidth: 420, gap: spacing.md },

  forgotLink: { alignSelf: 'flex-end', marginTop: -spacing.xs },
  // primaryStrong is only contrast-safe as text on a LIGHT ground (2.07:1 on dark bg,
  // a fail) — dark mode needs primaryDark here instead. See docs/design-system/01 §1.
  forgotLinkText: { fontFamily: V2_FONTS.interSemiBold, fontSize: 13, color: scheme === 'dark' ? v2.primaryDark : v2.primaryStrong },
  error: { color: v2.danger, fontSize: 13, fontFamily: V2_FONTS.interRegular },

  orDivider: { textAlign: 'center', fontFamily: V2_FONTS.interRegular, fontSize: 13, color: v2.muted },

  // Bumped from 12/interRegular, same reasoning as tagline.
  identityCaption: { fontFamily: V2_FONTS.interMedium, fontSize: 14, color: v2.muted, textAlign: 'center' },
  biometricIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: v2.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
