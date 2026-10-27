import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVisibleMoreMenuItems } from '../lib/moreMenuItems';
import { radius, spacing, useV2Colors, v2ModuleColors, V2_FONTS } from '../theme';
import type { MoreStackParamList } from '../navigation/MoreStack';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>;

/**
 * Design System v2 — matches Home's own row-card pattern (icon chip + label +
 * chevron, same radius/border/spacing) instead of the plain icon-tile grid this
 * screen used before, which was also still on the pre-v2 palette/typography
 * entirely. Mocked up and confirmed on the design canvas before this change.
 *
 * Hides the native header (see MoreStack's comment on this screen), so unlike
 * every other screen in this stack it has to account for the status bar itself.
 */
export function MoreMenuScreen({ navigation }: Props) {
  const v2 = useV2Colors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(v2), [v2]);
  const items = useVisibleMoreMenuItems();

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>Everything else, in one place.</Text>
      <View style={styles.list}>
        {items.map((item) => {
          const tileColors = v2ModuleColors[item.moduleColorKey];
          return (
            <Pressable
              key={item.key}
              style={styles.row}
              onPress={() => navigation.navigate(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.iconWrap, { backgroundColor: tileColors.bg }]}>
                <Ionicons name={item.icon} size={19} color={tileColors.icon} />
              </View>
              <Text style={styles.label}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={v2.muted} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const makeStyles = (v2: ReturnType<typeof useV2Colors>) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: v2.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontFamily: V2_FONTS.interBold, fontSize: 30, color: v2.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: V2_FONTS.interRegular, fontSize: 13, color: v2.muted, marginTop: 2, marginBottom: spacing.lg },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: v2.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: v2.border },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md - 1, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: V2_FONTS.interSemiBold, fontSize: 14.5, color: v2.ink },
});
