import { Pressable, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';

export function QueryError({ retry, message = 'Could not load this information. Please try again.' }: { retry: () => unknown; message?: string }) {
  const { colors } = useTheme();
  return <View accessibilityRole="alert" style={{ padding: spacing.lg }}>
    <Text style={{ color: colors.danger }}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={() => { void retry(); }} style={{ paddingVertical: spacing.md }}>
      <Text style={{ color: colors.pine, fontWeight: '700' }}>Try again</Text>
    </Pressable>
  </View>;
}
