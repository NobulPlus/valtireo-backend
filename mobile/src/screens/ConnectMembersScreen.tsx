import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { ProductIconField } from '../components/ProductIconField';
import { useConnectConversation, useConnectPeople, useConversationMembership } from '../features/connect/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { ConnectStackParamList } from '../navigation/ConnectStack';

type Props = NativeStackScreenProps<ConnectStackParamList, 'ConnectMembers'>;

export function ConnectMembersScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const userId = session?.user.id;
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  const conversation = useConnectConversation(conversationId);
  const c = conversation.data;
  const isOwner = c?.owner_id === userId;
  const people = useConnectPeople(search);
  const membership = useConversationMembership(conversationId);

  if (!c) return <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />;

  const addable = people.items.filter((p) => !c.members.some((m) => m.id === p.id));
  // Adding someone to a direct conversation is how it becomes a group (see
  // ConnectChatController@membership) — either participant can do that,
  // there being no real "owner" of a 1:1; every other management action
  // (rename, archive, remove, transfer) stays owner-only once it's a group.
  const canManageGroup = isOwner && c.kind !== 'direct';
  const canAddMembers = c.kind === 'direct' || canManageGroup;

  return (
    <View style={styles.flex}>
      <ProductIconField />
      <Text style={styles.notice}>New members can read existing history. Removed members lose conversation and attachment access.</Text>
      <FlatList
        data={c.members}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.sectionLabel}>Members</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar name={item.name} uri={item.photo_url} size={34} fallbackColor={colors.chip} fallbackTextColor={colors.pine} />
            <Text style={styles.rowLabel}>{item.name} · {item.active ? item.availability : 'inactive'}</Text>
            {isOwner && item.id !== userId && c.kind !== 'direct' ? (
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Pressable accessibilityLabel={`Make ${item.name} owner`} style={styles.iconButton} onPress={() => void membership.mutateAsync({ action: 'transfer', user_id: item.id })}><Ionicons name="ribbon-outline" size={18} color={colors.pine} /></Pressable>
                <Pressable accessibilityLabel={`Remove ${item.name}`} style={styles.iconButton} onPress={() => void membership.mutateAsync({ action: 'remove', user_id: item.id })}><Ionicons name="person-remove-outline" size={18} color={colors.danger} /></Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListFooterComponent={canAddMembers ? (
          <View style={styles.footer}>
            {canManageGroup && renaming ? (
              <View style={styles.renameRow}>
                <TextInput value={name} onChangeText={setName} placeholder={c.name} placeholderTextColor={colors.muted} style={styles.renameInput} autoFocus />
                <Pressable accessibilityLabel="Save name" style={styles.iconButton} onPress={() => { if (name.trim()) { void membership.mutateAsync({ action: 'rename', name: name.trim() }); setRenaming(false); } }}><Ionicons name="checkmark" size={18} color={colors.pine} /></Pressable>
                <Pressable accessibilityLabel="Cancel rename" style={styles.iconButton} onPress={() => setRenaming(false)}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
              </View>
            ) : null}

            {c.kind === 'direct' ? <Text style={styles.sectionNote}>Adding someone turns this into a group, visible to everyone in it.</Text> : null}
            <Text style={styles.sectionLabel}>Add a member</Text>
            <TextInput value={search} onChangeText={setSearch} placeholder="Find a colleague" placeholderTextColor={colors.muted} style={styles.renameInput} />
            {addable.map((p) => (
              <Pressable key={p.id} style={styles.row} onPress={() => void membership.mutateAsync({ action: 'add', user_id: p.id })}>
                <Avatar name={p.name} uri={p.photo_url} size={30} fallbackColor={colors.chip} fallbackTextColor={colors.pine} />
                <Text style={styles.rowLabel}>{p.name}</Text>
                <Ionicons name="add-circle-outline" size={20} color={colors.pine} />
              </Pressable>
            ))}
            {people.isFetchingNextPage ? <ActivityIndicator color={colors.pine} /> : null}

            {canManageGroup ? (
              <View style={styles.actionsRow}>
                <Pressable accessibilityLabel="Rename conversation" style={styles.iconButton} onPress={() => { setName(c.name); setRenaming(true); }}><Ionicons name="pencil-outline" size={20} color={colors.pine} /></Pressable>
                <Pressable accessibilityLabel={c.archived ? 'Reopen conversation' : 'Archive conversation'} style={styles.iconButton} onPress={() => void membership.mutateAsync({ action: 'archive', enabled: !c.archived })}><Ionicons name={c.archived ? 'folder-open-outline' : 'archive-outline'} size={20} color={colors.pine} /></Pressable>
              </View>
            ) : null}
          </View>
        ) : c.kind !== 'direct' ? (
          <Pressable
            style={styles.leaveRow}
            onPress={() => Alert.alert('Leave this conversation?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => void membership.mutateAsync({ action: 'leave' }, { onSuccess: () => navigation.navigate('ConnectList') }) }])}
          >
            <Ionicons name="exit-outline" size={18} color={colors.danger} />
            <Text style={styles.leaveLabel}>Leave conversation</Text>
          </Pressable>
        ) : null}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  notice: { fontSize: 12, color: colors.muted, padding: spacing.lg, paddingBottom: 0 },
  list: { padding: spacing.lg, gap: spacing.sm },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.xs },
  sectionNote: { fontSize: 12, color: colors.muted, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs + 2 },
  rowLabel: { flex: 1, fontSize: 14, color: colors.ink },
  iconButton: { padding: 6 },
  footer: { marginTop: spacing.sm },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  renameInput: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  leaveLabel: { color: colors.danger, fontWeight: '600', fontSize: 14 },
});
