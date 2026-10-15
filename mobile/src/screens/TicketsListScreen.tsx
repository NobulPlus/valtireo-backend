import { useMemo } from 'react';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isActiveTicket, isCancellableTicket, useCancelTicket, useMyTickets } from '../features/tickets/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { TicketsStackParamList } from '../navigation/TicketsStack';
import type { Ticket } from '../types/api';

type Props = NativeStackScreenProps<TicketsStackParamList, 'TicketsList'>;

function TicketRow({
  item,
  onPress,
  colors,
  typography,
  styles,
}: {
  item: Ticket;
  onPress: () => void;
  colors: ThemeColors;
  typography: Typography;
  styles: ReturnType<typeof makeStyles>;
}) {
  const statusColors: Record<string, string> = {
    submitted: colors.warning,
    changes_requested: colors.warning,
    approved: colors.pine,
    in_progress: colors.pine,
    on_hold: colors.warning,
    resolved: colors.success,
    closed: colors.muted,
    rejected: colors.danger,
    cancelled: colors.muted,
  };
  const cancel = useCancelTicket(item.id);

  async function handleCancel() {
    Alert.alert('Cancel this ticket?', item.subject, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel ticket',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancel.mutateAsync();
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={typography.heading}>{item.subject}</Text>
        <Text style={[styles.status, { color: statusColors[item.status] ?? colors.muted }]}>{item.status.replace('_', ' ')}</Text>
      </View>
      <Text style={typography.caption}>{item.category?.name ?? 'Uncategorized'} · {item.priority}</Text>
      {isCancellableTicket(item) ? (
        <Pressable onPress={handleCancel} disabled={cancel.isPending} style={{ marginTop: spacing.sm }}>
          <Text style={[styles.link, styles.linkDanger]}>{cancel.isPending ? 'Cancelling…' : 'Cancel'}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function TicketsListScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useMyTickets();

  const tickets = items;
  const sections = [
    { title: 'Open', data: tickets.filter(isActiveTicket) },
    { title: 'History', data: tickets.filter((ticket) => !isActiveTicket(ticket)) },
  ];

  return (
    <View style={styles.flex}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TicketRow item={item} onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id })} colors={colors} typography={typography} styles={styles} />
        )}
        renderSectionHeader={({ section }) => (section.data.length > 0 ? <Text style={styles.sectionHeader}>{section.title}</Text> : null)}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={isError ? <QueryError retry={refetch} /> : null}
        ListFooterComponent={<ListFooterLoader visible={isFetchingNextPage} />}
        ListEmptyComponent={
          isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No tickets yet.</Text>
        }
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('NewTicket')}>
        <Text style={styles.fabText}>+ New ticket</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  sectionHeader: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  linkDanger: { color: colors.danger },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  fabText: { color: colors.white, fontWeight: '700' },
});
