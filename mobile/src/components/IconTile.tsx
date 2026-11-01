import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadow, spacing, useTheme, type ThemeColors, type Typography } from '../theme';

interface IconTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  bg: string;
  iconColor: string;
  onPress: () => void;
  /**
   * Overrides the tile's share of the row (default: `'31%'`, i.e. three per row —
   * unchanged for every existing caller). Home's Quick Access row passes a measured
   * pixel width instead of a percentage: percentage widths don't resolve reliably
   * inside a horizontal list's content container (it sizes itself to its children
   * rather than the viewport), which is what made the four tiles crowd together.
   */
  widthPercent?: `${number}%` | number;
  /** Home's Quick Access grid uses this to enter drag-to-reorder mode — omitted everywhere else, so every other caller's behavior is unchanged. */
  onLongPress?: () => void;
  /** Dims the tile while it's the one being dragged, so the row still reads clearly mid-reorder. */
  dragging?: boolean;
}

/** A colored icon chip over a label — the Home dashboard's and More menu's shared navigation unit, so every module reads the same way wherever it appears. */
export function IconTile({ icon, label, bg, iconColor, onPress, widthPercent, onLongPress, dragging }: IconTileProps) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  return (
    <Pressable
      style={[styles.tile, widthPercent ? { width: widthPercent } : undefined, dragging && styles.dragging]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View style={[styles.iconWrap, shadow.tile, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  tile: { width: '31%', alignItems: 'center', gap: spacing.xs },
  dragging: { opacity: 0.5 },
  iconWrap: { width: 54, height: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, textAlign: 'center', fontWeight: '600', color: colors.ink, width: '100%' },
});
