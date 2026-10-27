import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient';
import { useConnectChannels, useConnectConversations } from '../features/connect/api';
import { Avatar } from '../components/Avatar';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { ConnectStackParamList } from '../navigation/ConnectStack';
import type { Conversation } from '../features/connect/types';

type Props = NativeStackScreenProps<ConnectStackParamList, 'ConnectList'>;

/** Today -> time, this week -> weekday, older -> short date. The compact chat-list convention, not a full timestamp. */
function listTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const daysAgo = Math.floor((now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo > 1 && daysAgo < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function ConnectListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<'messages' | 'channels'>('messages');
  const conversations = useConnectConversations();
  const channels = useConnectChannels();
  const list = tab === 'messages' ? conversations : channels;
  const cache = useQueryClient();
  const [joining, setJoining] = useState<string | null>(null);

  function openConversation(id: string) {
    navigation.navigate('ConnectConversation', { conversationId: id });
  }

  async function joinChannel(id: string) {
    setJoining(id);
    try {
      await api.patch(`/connect/conversations/${id}/membership`, { action: 'join' });
      await cache.invalidateQueries({ queryKey: ['connect'] });
      openConversation(id);
    } finally {
      setJoining(null);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'messages' && styles.tabActive]} onPress={() => setTab('messages')}>
          <Text style={[styles.tabLabel, tab === 'messages' && styles.tabLabelActive]}>Messages</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'channels' && styles.tabActive]} onPress={() => setTab('channels')}>
          <Text style={[styles.tabLabel, tab === 'channels' && styles.tabLabelActive]}>Channels</Text>
        </Pressable>
      </View>

      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={list.isRefetching}
        onRefresh={list.refetch}
        onEndReached={list.fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.pine} style={{ marginVertical: spacing.md }} /> : null}
        ListEmptyComponent={
          list.isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : (
            <Text style={styles.empty}>{tab === 'messages' ? 'Start a conversation with a colleague.' : 'No organization channels yet.'}</Text>
          )
        }
        renderItem={({ item }: { item: Conversation }) => (
          <Pressable
            style={styles.row}
            onPress={() => (tab === 'channels' && !item.joined ? void joinChannel(item.id) : openConversation(item.id))}
            disabled={joining === item.id}
          >
            <Avatar name={item.name} uri={null} size={40} fallbackColor={colors.chip} fallbackTextColor={colors.pine} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {item.kind}{item.archived ? ' · archived' : ''}{item.muted ? ' · muted' : ''}
              </Text>
            </View>
            {tab === 'channels' && !item.joined ? (
              joining === item.id ? <ActivityIndicator color={colors.pine} /> : <Text style={styles.joinLabel}>Join</Text>
            ) : (
              <View style={styles.trailing}>
                <Text style={styles.timestamp}>{listTimestamp(item.updated_at)}</Text>
                {item.unread_count > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View> : null}
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  tab: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  tabLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabLabelActive: { color: colors.white },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.line },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  joinLabel: { fontSize: 13, fontWeight: '700', color: colors.pine },
  trailing: { alignItems: 'flex-end', gap: 4 },
  timestamp: { fontSize: 11, color: colors.muted },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});

export function ConnectListHeaderButtons({ navigation }: { navigation: Props['navigation'] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Pressable onPress={() => navigation.navigate('ConnectCalls')} accessibilityLabel="Call history" style={{ padding: 6 }}>
        <Ionicons name="call-outline" size={20} color={colors.pine} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate('ConnectPreferences')} accessibilityLabel="Connect preferences" style={{ padding: 6 }}>
        <Ionicons name="settings-outline" size={20} color={colors.pine} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate('NewConversation')} accessibilityLabel="New conversation" style={{ padding: 6 }}>
        <Ionicons name="add" size={22} color={colors.pine} />
      </Pressable>
    </View>
  );
}
