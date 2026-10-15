import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForgotPassword, useResetPassword } from '../features/auth/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const forgotPassword = useForgotPassword();
  const resetPassword = useResetPassword();

  async function handleRequestCode() {
    if (!email.trim()) return Alert.alert('Enter your email', 'We need your email address to send a reset code.');
    try {
      const response = await forgotPassword.mutateAsync(email.trim());
      setStep('reset');
      Alert.alert('Check your email', response.message);
    } catch (err) {
      Alert.alert('Could not send code', err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function handleResetPassword() {
    if (!code.trim() || !password || !passwordConfirmation) {
      return Alert.alert('Missing details', 'Enter the code from your email and your new password.');
    }
    try {
      await resetPassword.mutateAsync({ email: email.trim(), code: code.trim(), password, password_confirmation: passwordConfirmation });
      Alert.alert('Password reset', 'Your password has been changed. Please sign in.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        Alert.alert('Could not reset password', Object.values(err.errors).flat().join('\n'));
      } else {
        Alert.alert('Could not reset password', err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to sign in">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>

        <Text style={typography.title}>{step === 'email' ? 'Reset your password' : 'Enter your code'}</Text>
        <Text style={[typography.caption, styles.subtitle]}>
          {step === 'email'
            ? "Enter the email you sign in with and we'll send you a reset code."
            : `We sent a 6-digit code to ${email.trim()}. Enter it below with your new password.`}
        </Text>

        {step === 'email' ? (
          <>
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
                autoFocus
              />
            </View>
            <Pressable style={[styles.button, forgotPassword.isPending && styles.buttonDisabled]} onPress={handleRequestCode} disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send reset code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>6-digit code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={colors.muted}
                autoFocus
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
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
            <View style={styles.field}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
              />
            </View>
            <Pressable style={[styles.button, resetPassword.isPending && styles.buttonDisabled]} onPress={handleResetPassword} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Reset password</Text>}
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleRequestCode} disabled={forgotPassword.isPending}>
              <Text style={styles.secondaryButtonText}>Resend code</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  back: { position: 'absolute', top: spacing.xl, left: spacing.lg, padding: spacing.xs },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { fontSize: 12, color: colors.muted, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryButtonText: { color: colors.pine, fontWeight: '600', fontSize: 13 },
});
