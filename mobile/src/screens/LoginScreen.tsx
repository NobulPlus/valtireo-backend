import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';
import { BIOMETRIC_LABEL, getAvailableBiometricKind, type BiometricKind } from '../lib/biometrics';
import { Sparkle } from '../components/Sparkle';
import { HERO_ACCENT, HERO_GRADIENT, radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const SPARKLES: { left: `${number}%`; top: number; size: number; opacity: number; accent?: boolean }[] = [
  { left: '33%', top: 54, size: 11, opacity: 0.8 },
  { left: '76%', top: 38, size: 7, opacity: 0.45 },
  { left: '63%', top: 128, size: 13, opacity: 0.9, accent: true },
  { left: '87%', top: 168, size: 8, opacity: 0.55 },
  { left: '15%', top: 146, size: 6, opacity: 0.4 },
  { left: '48%', top: 206, size: 9, opacity: 0.55 },
  { left: '71%', top: 232, size: 7, opacity: 0.6, accent: true },
  { left: '27%', top: 258, size: 10, opacity: 0.65 },
];

function HeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={HERO_GRADIENT} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="grid" width={65} height={65} patternUnits="userSpaceOnUse">
            <Path d="M 65 0 L 0 0 0 65" stroke="rgba(255,255,255,0.07)" strokeWidth={1} fill="none" />
          </Pattern>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={HERO_ACCENT} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={HERO_ACCENT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
        <Circle cx="92%" cy="2%" r={140} fill="url(#glow)" />
      </Svg>
      {SPARKLES.map((sparkle, index) => (
        <Sparkle
          key={index}
          size={sparkle.size}
          color={sparkle.accent ? HERO_ACCENT : '#FFFFFF'}
          opacity={sparkle.opacity}
          style={{ left: sparkle.left, top: sparkle.top }}
        />
      ))}
    </View>
  );
}

export function LoginScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { login, biometricCredential, enableBiometricSignIn, loginWithSavedCredential } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricKind, setBiometricKind] = useState<BiometricKind | null>(null);
  // null = no manual override yet, so the form shown follows biometricCredential as it loads.
  const [formOverride, setFormOverride] = useState<boolean | null>(null);
  const showPasswordForm = formOverride ?? !biometricCredential;

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
    setError(null);
    setIsBiometricSubmitting(true);
    try {
      // SecureStore itself authenticates before releasing the saved secret.
      await loginWithSavedCredential();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setFormOverride(true);
    } finally {
      setIsBiometricSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <HeroBackdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.brand}>
              <Image source={require('../../assets/brand-mark.png')} style={styles.logo} accessibilityLabel="Valtireo logo" />
              <Text style={styles.brandName}>valtireo</Text>
            </View>
            <Text style={styles.heroTitle}>Welcome back</Text>
            <Text style={styles.heroSubtitle}>Sign in to your workspace to pick up where you left off.</Text>
          </View>

          <View style={styles.card}>
            {biometricCredential && !showPasswordForm ? (
              <>
                <Text style={[typography.caption, styles.identityCaption]}>Signed in as {biometricCredential.name}</Text>

                <View style={styles.biometricIconWrap}>
                  <Ionicons name={biometricKind === 'face' ? 'scan-outline' : 'finger-print-outline'} size={30} color={colors.pine} />
                </View>
                <Pressable
                  style={[styles.button, isBiometricSubmitting && styles.buttonDisabled]}
                  onPress={handleBiometricSignIn}
                  disabled={isBiometricSubmitting || !biometricKind}
                >
                  {isBiometricSubmitting ? <ActivityIndicator color="#0A2420" /> : <Text style={styles.buttonText}>Sign in with {biometricKind ? BIOMETRIC_LABEL[biometricKind] : 'biometrics'}</Text>}
                </Pressable>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable style={styles.secondaryButton} onPress={() => setFormOverride(true)}>
                  <Text style={styles.secondaryButtonText}>Use password instead</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={typography.title}>Sign in to your workspace</Text>
                <Text style={[typography.caption, styles.subtitle]}>Use the email and password your organization gave you.</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Email address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <Pressable style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </Pressable>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
                </Pressable>

                {biometricCredential ? (
                  <Pressable style={styles.secondaryButton} onPress={() => setFormOverride(false)}>
                    <Text style={styles.secondaryButtonText}>Back to {biometricKind ? BIOMETRIC_LABEL[biometricKind] : 'saved'} sign-in</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  root: { flex: 1, backgroundColor: HERO_GRADIENT[0] },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  hero: { paddingHorizontal: 30, paddingTop: 52, paddingBottom: 8, gap: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 34, height: 34, borderRadius: 9 },
  brandName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  heroTitle: { fontSize: 42, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 46 },
  heroSubtitle: { fontSize: 13.5, color: 'rgba(255,255,255,0.64)', maxWidth: 260 },

  card: {
    margin: 18,
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: 26,
    padding: 26,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 12,
  },

  subtitle: { marginTop: -spacing.xs },
  field: { gap: 6 },
  label: { ...typography.caption, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -spacing.xs },
  forgotLinkText: { color: colors.pine, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },

  primaryButton: { backgroundColor: colors.pine, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },

  identityCaption: { textAlign: 'center' },
  biometricIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: HERO_ACCENT,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: '#8FC73E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonText: { color: '#0A2420', fontWeight: '700', fontSize: 15 },

  secondaryButton: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryButtonText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
});
