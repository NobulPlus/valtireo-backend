import { ActivityIndicator, View } from 'react-native';
import { spacing, useTheme } from '../theme';

/** Shown at the end of an infinite-scroll list while the next batch is being fetched ahead of the user reaching the bottom. */
export function ListFooterLoader({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View style={{ paddingVertical: spacing.lg }}>
      <ActivityIndicator color={colors.pine} />
    </View>
  );
}
