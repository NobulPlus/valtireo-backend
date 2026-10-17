import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationList } from '../features/notifications/api';
import { goIntoMoreTab, type HomeAreaNavigation } from '../lib/navigation';
import { resolveNotificationDestination, type NotificationDestination } from '../lib/notificationNavigation';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { MainTabParamList } from '../navigation/MainTabs';
import type { NotificationEntry } from '../types/api';

type Props = CompositeScreenProps<NativeStackScreenProps<HomeStackParamList, 'Notifications'>, BottomTabScreenProps<MainTabParamList>>;

/** The imperative half of resolveNotificationDestination's result — the decision itself is pure and unit-tested; this just calls the matching navigate(). An `unsupported` destination does nothing beyond the mark-read that already happened, by design (fail gracefully, never a broken navigate()). */
function navigateForNotification(destination: NotificationDestination, navigation: HomeAreaNavigation) {
  switch (destination.kind) {
    case 'profile':
      navigation.navigate('Profile');
      return;
    case 'leaveTab':
      navigation.navigate('LeaveTab');
      return;
    case 'ticketsTab':
      navigation.navigate('TicketsTab');
      return;
    case 'ticketDetail':
      navigation.navigate('TicketsTab', { screen: 'TicketDetail', params: { ticketId: destination.ticketId } });
      return;
    case 'moreScreen':
      goIntoMoreTab(navigation, destination.screen);
      return;
    case 'unsupported':
      return;
  }
}

function NotificationRow({
  item,
  colors,
  typography,
  styles,
  onOpen,
}: {
  item: NotificationEntry;
  colors: ThemeColors;
  typography: Typography;
  styles: ReturnType<typeof makeStyles>;
  onOpen: (item: NotificationEntry) => void;
}) {
  // A single neutral chip background (rather than a per-severity tint) reads cleanly against both the light and dark card surface.
  const severityMap: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    info: { color: colors.pine, icon: 'information-circle' },
    success: { color: colors.success, icon: 'checkmark-circle' },
    warning: { color: colors.warning, icon: 'warning' },
    danger: { color: colors.danger, icon: 'alert-circle' },
  };
  const isUnread = !item.read_at;
  const severity = severityMap[item.severity] ?? severityMap.info;

  return (
    <Pressable
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={() => onOpen(item)}
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

export function NotificationsScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { moduleByKey } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useNotificationList({ status: filter === 'unread' ? 'unread' : '' });
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  const notificationAccess = {
    leave: moduleByKey('leave')?.can_access === true,
    serviceDesk: moduleByKey('service_desk')?.can_access === true,
    employeeSelfService: moduleByKey('employee_self_service')?.can_access === true,
  };

  function openNotification(item: NotificationEntry) {
    // Preserve existing read behavior exactly: mark read first (fire-and-forget,
    // same as before), then navigate — a single tap does both, never twice, and
    // an unsupported destination still marks the item read without navigating
    // anywhere, matching "handle unsupported notification types gracefully."
    if (!item.read_at) markRead.mutate(item.id);
    const destination = resolveNotificationDestination(item, notificationAccess);
    navigateForNotification(destination, navigation);
  }

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
        renderItem={({ item }) => <NotificationRow item={item} colors={colors} typography={typography} styles={styles} onOpen={openNotification} />}
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
