import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useConnectPreferences, useSaveConnectPreferences } from '../features/connect/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { ConnectStackParamList } from '../navigation/ConnectStack';

type Props = NativeStackScreenProps<ConnectStackParamList, 'ConnectPreferences'>;

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'away', label: 'Away' },
  { value: 'busy', label: 'Busy' },
  { value: 'offline', label: 'Offline' },
] as const;

export function ConnectPreferencesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasPermission } = useAuth();
  const query = useConnectPreferences();
  const save = useSaveConnectPreferences();

  if (query.isLoading || !query.data) return <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Availability</Text>
      <View style={styles.pillRow}>
        {AVAILABILITY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.pill, query.data.availability === option.value && styles.pillActive]}
            onPress={() => save.mutate({ availability: option.value })}
          >
            <Text style={[styles.pillLabel, query.data.availability === option.value && styles.pillLabelActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Activity notifications</Text>
        <Switch value={query.data.notifications} onValueChange={(value) => save.mutate({ notifications: value })} trackColor={{ true: colors.pine }} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Allow incoming voice calls</Text>
        <Switch value={query.data.allow_calls} onValueChange={(value) => save.mutate({ allow_calls: value })} trackColor={{ true: colors.pine }} />
      </View>

      {hasPermission('organizations.administer') ? (
        <Pressable style={styles.reportsLink} onPress={() => navigation.navigate('ConnectReports')}>
          <Text style={styles.reportsLinkLabel}>Reported messages</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  pillActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  pillLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  pillLabelActive: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  switchLabel: { fontSize: 14, color: colors.ink },
  reportsLink: { marginTop: spacing.lg, paddingVertical: spacing.sm },
  reportsLinkLabel: { color: colors.pine, fontWeight: '700', fontSize: 14 },
});
