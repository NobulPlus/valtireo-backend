import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

/** Shown instead of Login when a stored token exists but startup could not reach the server — the token is still valid, this is a network problem, not a signed-out state. */
export function ReconnectScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { reconnectError, refresh, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.pine} />
      <Text style={[typography.title, { marginTop: spacing.lg, textAlign: 'center' }]}>Can&apos;t reach Valtireo</Text>
      <Text style={[typography.caption, styles.message]}>{reconnectError ?? 'Check your connection and try again.'}</Text>
      <Pressable style={[styles.button, retrying && styles.buttonDisabled]} onPress={handleRetry} disabled={retrying}>
        {retrying ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Reconnect</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
        <Text style={styles.secondaryButtonText}>Sign in with a different account</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  message: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center', minWidth: 200 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: { marginTop: spacing.lg, paddingVertical: spacing.sm },
  secondaryButtonText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
});
