import { useMemo } from 'react';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCancelLeaveRequest, useMyLeaveRequests, openLeaveEvidence, openLeaveHandoverDocument } from '../features/leave/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { LeaveStackParamList } from '../navigation/LeaveStack';
import type { LeaveRequest } from '../types/api';

type Props = NativeStackScreenProps<LeaveStackParamList, 'LeaveList'>;

function LeaveRow({ item, colors, typography, styles }: { item: LeaveRequest; colors: ThemeColors; typography: Typography; styles: ReturnType<typeof makeStyles> }) {
  const statusColors: Record<string, string> = { pending: colors.warning, approved: colors.success, rejected: colors.danger, cancelled: colors.muted };
  const cancel = useCancelLeaveRequest(item.id);
  const canCancel = item.status === 'pending';

  async function handleCancel() {
    Alert.alert('Cancel this request?', `${item.leave_type?.name ?? 'Leave'} · ${item.starts_on} – ${item.ends_on}`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancel.mutateAsync(undefined);
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={typography.heading}>{item.leave_type?.name ?? 'Leave'}</Text>
        <Text style={[styles.status, { color: statusColors[item.status] ?? colors.muted }]}>{item.status}</Text>
      </View>
      <Text style={typography.body}>{item.starts_on} → {item.ends_on} · {item.total_days} day(s)</Text>
      {item.reason ? <Text style={typography.caption}>{item.reason}</Text> : null}
      {item.handover_to ? <Text style={typography.caption}>Handover: {item.handover_to.full_name}</Text> : null}
      <View style={styles.cardActions}>
        {item.evidence_download_url ? (
          <Pressable onPress={() => void openLeaveEvidence(item).catch(() => Alert.alert('Could not open evidence', 'Please try again.'))}>
            <Text style={styles.link}>View evidence</Text>
          </Pressable>
        ) : null}
        {item.handover_download_url ? (
          <Pressable onPress={() => void openLeaveHandoverDocument(item).catch(() => Alert.alert('Could not open handover document', 'Please try again.'))}>
            <Text style={styles.link}>View handover</Text>
          </Pressable>
        ) : null}
        {canCancel ? (
          <Pressable onPress={handleCancel} disabled={cancel.isPending}>
            <Text style={[styles.link, styles.linkDanger]}>{cancel.isPending ? 'Cancelling…' : 'Cancel'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function LeaveListScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useMyLeaveRequests();

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <LeaveRow item={item} colors={colors} typography={typography} styles={styles} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={isError ? <QueryError retry={refetch} /> : null}
      ListFooterComponent={<ListFooterLoader visible={isFetchingNextPage} />}
      ListEmptyComponent={
          isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No leave requests yet.</Text>
        }
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('NewLeaveRequest')}>
        <Text style={styles.fabText}>+ Request leave</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  linkDanger: { color: colors.danger },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  fabText: { color: colors.white, fontWeight: '700' },
});
