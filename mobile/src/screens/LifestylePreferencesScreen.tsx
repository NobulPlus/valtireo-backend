import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLifestylePreferences, useUpdateLifestylePreferences } from '../features/lifestyle/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { LifestylePreferences } from '../types/api';
import { QueryError } from '../components/QueryError';

const ROWS: { key: keyof LifestylePreferences; title: string; description: string }[] = [
  { key: 'appreciation_notifications', title: 'Appreciation alerts', description: 'Show an in-app alert when a colleague thanks me. No email or push notification is sent.' },
  { key: 'share_birthday', title: 'Share my birthday', description: 'Active colleagues in your organization can see the day and month. Your birth year is never shown.' },
  { key: 'share_anniversary', title: 'Share my work anniversary', description: 'Shows your years of service, not your exact start date.' },
  { key: 'receive_appreciation', title: 'Allow colleagues to send me appreciation', description: 'Turning this off also stops anyone from sending you a thank-you message.' },
  { key: 'allow_shared_appreciation', title: 'Allow appreciation to be shared with colleagues', description: 'Turning this off makes existing shared messages private. Re-enabling will not republish them. Reported messages can be reviewed by your organization moderator.' },
];

export function LifestylePreferencesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading, isError, refetch } = useLifestylePreferences();
  const update = useUpdateLifestylePreferences();

  if (isError) return <QueryError retry={refetch} />;
  if (isLoading || !data) return <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {update.isError ? <Text accessibilityRole="alert" style={styles.description}>Could not save your preference. Please try again.</Text> : null}
      {ROWS.map((row) => {
        const value = data.preferences[row.key];
        return (
          <Pressable key={row.key} style={styles.row} accessibilityRole="switch" accessibilityLabel={row.title} accessibilityState={{ checked: value, disabled: update.isPending }} onPress={() => update.mutate({ [row.key]: !value })} disabled={update.isPending}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={styles.title}>{row.title}</Text>
              <Text style={styles.description}>{row.description}</Text>
            </View>
            <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs / 2 },
  description: { fontSize: 12, color: colors.muted },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.line, padding: 2, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: colors.pine },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  switchThumbOn: { transform: [{ translateX: 18 }] },
});
