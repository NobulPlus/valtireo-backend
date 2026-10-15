import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationList } from '../features/notifications/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { NotificationEntry } from '../types/api';

function NotificationRow({ item, colors, typography, styles }: { item: NotificationEntry; colors: ThemeColors; typography: Typography; styles: ReturnType<typeof makeStyles> }) {
  // A single neutral chip background (rather than a per-severity tint) reads cleanly against both the light and dark card surface.
  const severityMap: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    info: { color: colors.pine, icon: 'information-circle' },
    success: { color: colors.success, icon: 'checkmark-circle' },
    warning: { color: colors.warning, icon: 'warning' },
    danger: { color: colors.danger, icon: 'alert-circle' },
  };
  const markRead = useMarkNotificationRead();
  const isUnread = !item.read_at;
  const severity = severityMap[item.severity] ?? severityMap.info;

  return (
    <Pressable
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => isUnread && markRead.mutate(item.id)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <Ionicons name={severity.icon} size={16} color={severity.color} />
        </View>
        <Text style={[typography.heading, { flex: 1 }]}>{item.title ?? 'Notification'}</Text>
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
      {item.message ? <Text style={typography.body}>{item.message}</Text> : null}
      <Text style={typography.caption}>{new Date(item.created_at).toLocaleString()}</Text>
    </Pressable>
  );
}

export function NotificationsScreen() {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useNotificationList({ status: filter === 'unread' ? 'unread' : '' });
  const markAllRead = useMarkAllNotificationsRead();

  function changeFilter(next: 'all' | 'unread') {
    setFilter(next);
  }

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          <Pressable onPress={() => changeFilter('all')} style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
          </Pressable>
          <Pressable onPress={() => changeFilter('unread')} style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>Unread</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          <Text style={styles.markAllLink}>Mark all read</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <NotificationRow item={item} colors={colors} typography={typography} styles={styles} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={isError ? <QueryError retry={refetch} /> : null}
        ListFooterComponent={<ListFooterLoader visible={isFetchingNextPage} />}
      ListEmptyComponent={
          isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>You are all caught up.</Text>
        }
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  filterChipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  filterText: { fontSize: 12, color: colors.ink },
  filterTextActive: { color: colors.pineDark, fontWeight: '700' },
  markAllLink: { color: colors.pine, fontWeight: '600', fontSize: 12 },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardUnread: { borderColor: colors.pine },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  iconWrap: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.line },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.limeDeep },
});
