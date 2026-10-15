import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CTA_GRADIENT, radius, spacing, useTheme, useV2Colors, V2_FONTS } from '../theme';

type ButtonVariant = 'gradient' | 'outlined' | 'ghost';

interface ButtonProps {
  label: string;
  variant: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * See docs/design-system/03-component-specifications.md ("Button"). Only the three
 * variants Login needs are implemented (`gradient`, `outlined`, `ghost`) — `primary`/
 * `secondary`/`danger` are documented there for future screens and will be added when
 * one of those screens is actually built, not speculatively now.
 *
 * `gradient`'s text color is NOT a style choice: light mode needs white (the gradient's
 * dark `primaryStrong` end would fail contrast with dark text), dark mode needs
 * `inkOnAccent` (white fails 1.93:1 against the gradient's bright `primaryDark` end).
 * See docs/design-system/01-color-tokens.md §1.
 */
export function Button({ label, variant, onPress, disabled, loading, icon }: ButtonProps) {
  const { scheme } = useTheme();
  const v2 = useV2Colors();
  const isDisabled = disabled || loading;

  if (variant === 'gradient') {
    const gradientColors = scheme === 'dark' ? CTA_GRADIENT.dark : CTA_GRADIENT.light;
    const textColor = scheme === 'dark' ? v2.inkOnAccent : v2.surface;
    return (
      <Pressable onPress={onPress} disabled={isDisabled} accessibilityRole="button" accessibilityState={{ disabled: isDisabled }} style={{ opacity: isDisabled ? 0.6 : 1 }}>
        <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pill}>
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <View style={styles.row}>
              {icon ? <Ionicons name={icon} size={18} color={textColor} style={styles.icon} /> : null}
              <Text style={[styles.ctaLabel, { color: textColor }]}>{label}</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  const tint = scheme === 'dark' ? v2.primaryDark : v2.primaryStrong;

  if (variant === 'outlined') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        style={[styles.pill, styles.outlined, { borderColor: v2.border, opacity: isDisabled ? 0.6 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color={tint} />
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={18} color={tint} style={styles.icon} /> : null}
            <Text style={[styles.label, { color: tint }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} accessibilityRole="button" accessibilityState={{ disabled: isDisabled }} style={{ opacity: isDisabled ? 0.6 : 1, alignSelf: 'center' }}>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  outlined: { borderWidth: 1.5, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: spacing.sm },
  ctaLabel: { fontFamily: V2_FONTS.interBold, fontSize: 19, lineHeight: 24 },
  label: { fontFamily: V2_FONTS.interSemiBold, fontSize: 15 },
});
