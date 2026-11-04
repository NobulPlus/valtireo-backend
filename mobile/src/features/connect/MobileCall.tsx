import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { Avatar } from '../../components/Avatar';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../../theme';
import type { VoiceCall } from './types';

const NativeVoiceRoom = lazy(() => import('./NativeVoiceRoom'));
export const nativeCallsSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export function MobileCall({ call }: { call: VoiceCall }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const cache = useQueryClient();
  const [credentials, setCredentials] = useState<{ token: string; server_url: string } | null>(null);
  const [error, setError] = useState('');
  const action = useMutation({
    mutationFn: (action: string) => api.post(`/connect/calls/${call.id}/actions`, { action }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['connect'] }),
  });

  useEffect(() => {
    let alive = true;
    if (call.status === 'active' && nativeCallsSupported) {
      void api.post<{ credentials: { token: string; server_url: string } }>(`/connect/calls/${call.id}/actions`, { action: 'join' })
        .then((r) => { if (alive) setCredentials(r.credentials); })
        .catch((e) => { if (alive) setError(String(e)); });
    }
    return () => { alive = false; };
  }, [call.id, call.status]);

  const person = call.incoming ? call.caller : call.callee;
  const isIncomingRing = call.status === 'ringing' && call.incoming;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Avatar name={person.name} uri={person.photo_url} />
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
          <Text style={styles.subtitle}>
            {call.status === 'ringing' ? (call.incoming ? 'Incoming voice call' : 'Calling…') : call.status}
          </Text>
        </View>

        <View style={styles.actions}>
          {isIncomingRing ? (
            <>
              <Pressable
                onPress={() => action.mutate('accept')}
                disabled={!nativeCallsSupported || action.isPending}
                style={[styles.actionButton, styles.acceptButton, (!nativeCallsSupported || action.isPending) && styles.actionButtonDisabled]}
                accessibilityLabel="Accept call"
                accessibilityRole="button"
              >
                <Ionicons name="call" size={20} color={colors.white} />
              </Pressable>
              <Pressable
                onPress={() => action.mutate('decline')}
                disabled={action.isPending}
                style={[styles.actionButton, styles.declineButton, action.isPending && styles.actionButtonDisabled]}
                accessibilityLabel="Decline call"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={20} color={colors.white} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => action.mutate('end')}
              disabled={action.isPending}
              style={[styles.actionButton, styles.declineButton, action.isPending && styles.actionButtonDisabled]}
              accessibilityLabel="End call"
              accessibilityRole="button"
            >
              {action.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="call" size={20} color={colors.white} style={styles.endIcon} />}
            </Pressable>
          )}
        </View>
      </View>

      {!nativeCallsSupported ? (
        <Text style={styles.notice}>Live calls need a Valtireo development build. Expo Go supports messaging and voice notes.</Text>
      ) : null}

      {call.status === 'active' && credentials ? (
        <Suspense fallback={<ActivityIndicator size="small" color={colors.pine} style={{ marginTop: spacing.sm }} />}>
          <NativeVoiceRoom
            credentials={credentials}
            // LiveKit's own reconnect attempts are exhausted at this point — without
            // this, the call sat frozen showing "disconnected" with no way for either
            // party to know the call needs to be hung up and re-dialed. End it
            // server-side so both the record and the other party's UI reflect reality.
            onDisconnected={() => action.mutate('end')}
          />
        </Suspense>
      ) : null}

      {error || action.error ? <Text style={styles.error} accessibilityRole="alert">{error || action.error?.message}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.chip, borderRadius: radius.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identity: { flex: 1, minWidth: 0 },
  name: { ...typography.heading, color: colors.pine },
  subtitle: { ...typography.caption, color: colors.muted, textTransform: 'capitalize' },
  notice: { ...typography.caption, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.sm, flexShrink: 0 },
  actionButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  actionButtonDisabled: { opacity: 0.6 },
  acceptButton: { backgroundColor: colors.success },
  declineButton: { backgroundColor: colors.danger },
  endIcon: { transform: [{ rotate: '135deg' }] },
  error: { color: colors.danger, fontSize: 13 },
});
