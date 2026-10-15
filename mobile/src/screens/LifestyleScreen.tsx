import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import {
  useAppreciations,
  useDeleteAppreciation,
  useLifestylePreferences,
  useMilestones,
  useReportAppreciation,
  type AppreciationScope,
} from '../features/lifestyle/api';
import { useMyDashboard } from '../features/dashboard/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { LifestyleStackParamList } from '../navigation/LifestyleStack';
import type { Appreciation, Milestone } from '../types/api';

type Props = NativeStackScreenProps<LifestyleStackParamList, 'LifestyleHome'>;

const SCOPE_OPTIONS: { value: AppreciationScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'sent', label: 'Sent' },
  { value: 'shared', label: 'Shared' },
];

function MilestoneRow({ milestone, colors, styles }: { milestone: Milestone; colors: ThemeColors; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.milestoneRow}>
      <Ionicons name={milestone.type === 'birthday' ? 'gift-outline' : 'ribbon-outline'} size={18} color={colors.pine} />
      <View style={{ flex: 1 }}>
        <Text style={styles.milestoneName}>{milestone.employee.name}</Text>
        <Text style={styles.caption}>
          {milestone.type === 'birthday' ? 'Birthday' : `${milestone.years_of_service} year(s) with us`} · {milestone.date}
        </Text>
      </View>
    </View>
  );
}

function AppreciationCard({
  appreciation,
  myEmployeeId,
  colors,
  styles,
  onReport,
}: {
  appreciation: Appreciation;
  myEmployeeId: number | undefined;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onReport: (id: number) => void;
}) {
  const deleteAppreciation = useDeleteAppreciation();
  const isMine = myEmployeeId !== undefined && (appreciation.sender.id === myEmployeeId || appreciation.recipient.id === myEmployeeId);

  function handleDelete() {
    Alert.alert('Remove this message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAppreciation.mutateAsync(appreciation.id);
          } catch (err) {
            Alert.alert('Could not remove', err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.caption}>
          {appreciation.sender.name} → {appreciation.recipient.name}
        </Text>
        {isMine ? (
          <Pressable onPress={handleDelete} disabled={deleteAppreciation.isPending} accessibilityLabel="Remove message" style={styles.iconButton}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        ) : null}
        {appreciation.sender.id !== myEmployeeId ? (
          <Pressable onPress={() => onReport(appreciation.id)} accessibilityLabel="Report message" style={styles.iconButton}>
            <Ionicons name="flag-outline" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.body}>{appreciation.message}</Text>
      <View style={styles.cardFooter}>
        {appreciation.visibility === 'shared' ? (
          <View style={styles.sharedBadge}>
            <Text style={styles.sharedBadgeText}>Shared</Text>
          </View>
        ) : null}
        <Text style={styles.caption}>{new Date(appreciation.created_at).toLocaleDateString()}</Text>
      </View>
    </View>
  );
}

export function LifestyleScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [scope, setScope] = useState<AppreciationScope>('all');
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');

  const preferencesQuery = useLifestylePreferences();
  const preferencesData = preferencesQuery.data;
  const milestonesQuery = useMilestones(30, preferencesData?.features.milestones_enabled === true);
  const appreciationsQuery = useAppreciations(scope, preferencesData?.features.appreciation_enabled === true);
  const { data: dashboard } = useMyDashboard();
  const myEmployeeId = dashboard?.employee?.id;
  const reportAppreciation = useReportAppreciation();

  const milestonesEnabled = preferencesData?.features.milestones_enabled ?? false;
  const appreciationEnabled = preferencesData?.features.appreciation_enabled ?? false;
  const appreciations = appreciationsQuery.items;

  function changeScope(next: AppreciationScope) {
    setScope(next);
  }

  async function submitReport() {
    if (!reportingId || !reportReason.trim()) return;
    try {
      await reportAppreciation.mutateAsync({ id: reportingId, reason: reportReason.trim() });
      setReportingId(null);
      setReportReason('');
      Alert.alert('Reported', 'Thanks — a moderator will review this.');
    } catch (err) {
      Alert.alert('Could not report', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <View style={styles.flex}>
      <FlatList
        refreshing={preferencesQuery.isRefetching || milestonesQuery.isRefetching || appreciationsQuery.isRefetching}
        onRefresh={() => {
          void preferencesQuery.refetch();
          if (milestonesEnabled) void milestonesQuery.refetch();
          if (appreciationEnabled) void appreciationsQuery.refetch();
        }}
        data={appreciationEnabled ? appreciations : []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AppreciationCard appreciation={item} myEmployeeId={myEmployeeId} colors={colors} styles={styles} onReport={setReportingId} />
        )}
        onEndReached={appreciationEnabled ? appreciationsQuery.fetchMore : undefined}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            {preferencesQuery.isError ? <QueryError retry={preferencesQuery.refetch} /> : null}
            {preferencesQuery.isLoading ? <ActivityIndicator color={colors.pine} /> : null}
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>Milestones</Text>
              <Pressable onPress={() => navigation.navigate('LifestylePreferences')} accessibilityLabel="Lifestyle preferences" style={styles.iconButton}>
                <Ionicons name="settings-outline" size={20} color={colors.pine} />
              </Pressable>
            </View>
            {!milestonesEnabled ? (
              <Text style={[styles.caption, { marginBottom: spacing.lg }]}>Milestones aren&apos;t turned on for your organization yet.</Text>
            ) : milestonesQuery.isLoading ? (
              <ActivityIndicator color={colors.pine} />
            ) : milestonesQuery.isError ? <QueryError retry={milestonesQuery.refetch} /> : (milestonesQuery.data ?? []).length === 0 ? (
              <Text style={[styles.caption, { marginBottom: spacing.lg }]}>Nothing coming up in the next 30 days.</Text>
            ) : (
              <View style={styles.milestonesCard}>
                {(milestonesQuery.data ?? []).map((milestone, index) => (
                  <MilestoneRow key={`${milestone.employee.id}-${milestone.type}-${index}`} milestone={milestone} colors={colors} styles={styles} />
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Appreciation</Text>
            {!appreciationEnabled ? (
              <Text style={styles.caption}>Appreciation isn&apos;t turned on for your organization yet.</Text>
            ) : (
              <View style={styles.chipRow}>
                {SCOPE_OPTIONS.map((option) => (
                  <Pressable key={option.value} onPress={() => changeScope(option.value)} style={[styles.chip, scope === option.value && styles.chipActive]}>
                    <Text style={[styles.chipText, scope === option.value && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        }
        ListFooterComponent={appreciationEnabled ? <ListFooterLoader visible={appreciationsQuery.isFetchingNextPage} /> : null}
        ListEmptyComponent={
          !appreciationEnabled ? null : appreciationsQuery.isError ? (
            <QueryError retry={appreciationsQuery.refetch} />
          ) : appreciationsQuery.isLoading ? (
            <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />
          ) : (
            <Text style={[styles.caption, styles.empty]}>Nothing here yet.</Text>
          )
        }
      />
      {appreciationEnabled ? (
        <Pressable style={styles.fab} onPress={() => navigation.navigate('SendAppreciation')}>
          <Text style={styles.fabText}>+ Send appreciation</Text>
        </Pressable>
      ) : null}

      <Modal visible={reportingId !== null} animationType="slide" transparent onRequestClose={() => setReportingId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReportingId(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sectionTitle}>Report this message</Text>
          <Text style={styles.caption}>Reporting shares this message, including private messages, with your organization moderator. Tell them why you are reporting it.</Text>
          <TextInput
            value={reportReason}
            onChangeText={setReportReason}
            style={[styles.input, styles.inputMultiline]}
            multiline
            maxLength={500}
            placeholder="Reason"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <Pressable style={[styles.button, (!reportReason.trim() || reportAppreciation.isPending) && styles.buttonDisabled]} onPress={submitReport} disabled={!reportReason.trim() || reportAppreciation.isPending}>
            {reportAppreciation.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Submit report</Text>}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setReportingId(null)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: spacing.sm, marginTop: spacing.md },
  iconButton: { padding: spacing.xs },
  caption: { fontSize: 12, color: colors.muted },
  body: { fontSize: 14, color: colors.ink, marginTop: spacing.xs },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  milestonesCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.lg },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  milestoneName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipText: { fontSize: 12, color: colors.ink },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sharedBadge: { backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  sharedBadgeText: { fontSize: 10, fontWeight: '700', color: colors.pineDark, textTransform: 'uppercase' },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  fabText: { color: colors.white, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white, marginTop: spacing.md },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  cancelButtonText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
});
