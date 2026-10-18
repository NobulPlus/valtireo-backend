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
  /** Overrides the tile's share of the row (default: `'31%'`, i.e. three per row — unchanged for every existing caller). Home's Quick Access grid passes a narrower value to fit four per row without affecting More menu's own grid. */
  widthPercent?: `${number}%`;
}

/** A colored icon chip over a label — the Home dashboard's and More menu's shared navigation unit, so every module reads the same way wherever it appears. */
export function IconTile({ icon, label, bg, iconColor, onPress, widthPercent }: IconTileProps) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  return (
    <Pressable style={[styles.tile, widthPercent ? { width: widthPercent } : undefined]} onPress={onPress}>
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
  iconWrap: { width: 54, height: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, textAlign: 'center', fontWeight: '600', color: colors.ink },
});
