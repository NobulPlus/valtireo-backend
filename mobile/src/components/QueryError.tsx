import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../lib/ApiError';
import { spacing, useTheme } from '../theme';

export function QueryError({ retry, error, message }: { retry: () => unknown; error?: unknown; message?: string }) {
  const { colors } = useTheme();
  // Mirrors the web client's ErrorState: a 403 reads as a permission problem,
  // not a generic load failure, and the server's own message (when it sent
  // one) beats a one-size-fits-all string — this used to always show the same
  // generic text no matter what actually went wrong.
  const resolved = error instanceof ApiError && error.status === 403
    ? error.message || "You don't have permission to view this."
    : message ?? (error instanceof ApiError ? error.message : undefined) ?? 'Could not load this information. Please try again.';
  return <View accessibilityRole="alert" style={{ padding: spacing.lg }}>
    <Text style={{ color: colors.danger }}>{resolved}</Text>
    <Pressable accessibilityRole="button" onPress={() => { void retry(); }} style={{ paddingVertical: spacing.md }}>
      <Text style={{ color: colors.pine, fontWeight: '700' }}>Try again</Text>
    </Pressable>
  </View>;
}
