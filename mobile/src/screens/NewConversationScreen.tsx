import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchableSelect } from '../components/SearchableSelect';
import { Avatar } from '../components/Avatar';
import { useDepartmentOptions } from '../features/directory/api';
import { useConnectPeople, useCreateConversation } from '../features/connect/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { ConnectStackParamList } from '../navigation/ConnectStack';

type Props = NativeStackScreenProps<ConnectStackParamList, 'NewConversation'>;
type Kind = 'direct' | 'group' | 'channel';

/**
 * Defaults to a plain staff list — the common case (message one colleague) is one
 * tap, no "what kind of conversation" question first. Switching to Group/Channel
 * turns the same list into a multi-select (checkmarks instead of instant-open) and
 * reveals the name field, so starting a group is still just "pick people, then
 * confirm" rather than a separate flow.
 */
export function NewConversationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [kind, setKind] = useState<Kind>('direct');
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'organization'>('private');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);

  const departments = useDepartmentOptions();
  const people = useConnectPeople(search, departmentId ? Number(departmentId) : null);
  const create = useCreateConversation();

  function openOrCreate(ids: number[], conversationName?: string) {
    create.mutate(
      { kind, member_ids: ids, name: conversationName, visibility: kind === 'channel' ? visibility : undefined },
      { onSuccess: ({ data }) => navigation.replace('ConnectConversation', { conversationId: data.id }) },
    );
  }

  function tapPerson(id: number) {
    if (kind === 'direct') { openOrCreate([id]); return; }
    setMemberIds((current) => current.includes(id) ? current.filter((m) => m !== id) : [...current, id]);
  }

  const canCreateGroup = memberIds.length >= 1 && name.trim() !== '' && !create.isPending;

  return (
    <View style={styles.flex}>
      <View style={styles.kindRow}>
        {(['direct', 'group', 'channel'] as const).map((option) => (
          <Pressable key={option} style={[styles.kindPill, kind === option && styles.kindPillActive]} onPress={() => { setKind(option); setMemberIds([]); }}>
            <Ionicons name={option === 'direct' ? 'chatbubble-outline' : option === 'group' ? 'people-outline' : 'megaphone-outline'} size={14} color={kind === option ? colors.white : colors.muted} />
            <Text style={[styles.kindLabel, kind === option && styles.kindLabelActive]}>{option === 'direct' ? 'Message' : option === 'group' ? 'Group' : 'Channel'}</Text>
          </Pressable>
        ))}
      </View>

      {kind !== 'direct' ? (
        <View style={styles.groupFields}>
          <TextInput value={name} onChangeText={setName} placeholder={kind === 'group' ? 'Group name' : 'Channel name'} placeholderTextColor={colors.muted} style={styles.input} maxLength={120} />
          {kind === 'channel' ? (
            <View style={styles.kindRow}>
              <Pressable style={[styles.visibilityPill, visibility === 'private' && styles.kindPillActive]} onPress={() => setVisibility('private')}>
                <Text style={[styles.kindLabel, visibility === 'private' && styles.kindLabelActive]}>Private</Text>
              </Pressable>
              <Pressable style={[styles.visibilityPill, visibility === 'organization' && styles.kindPillActive]} onPress={() => setVisibility('organization')}>
                <Text style={[styles.kindLabel, visibility === 'organization' && styles.kindLabelActive]}>Discoverable</Text>
              </Pressable>
            </View>
          ) : null}
          {memberIds.length > 0 ? <Text style={styles.selectedCount}>{memberIds.length} selected</Text> : null}
        </View>
      ) : null}

      <View style={styles.filters}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search colleagues…" placeholderTextColor={colors.muted} style={[styles.input, styles.searchInput]} />
        <View style={styles.deptPicker}>
          <SearchableSelect
            label="Department"
            placeholder="All departments"
            allowClear
            clearLabel="All departments"
            value={departmentId}
            onChange={setDepartmentId}
            options={(departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
          />
        </View>
      </View>

      {create.isError ? <Text style={styles.error}>{create.error instanceof Error ? create.error.message : 'Could not create the conversation.'}</Text> : null}

      <FlatList
        data={people.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onEndReached={people.fetchMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={people.isFetchingNextPage ? <ActivityIndicator color={colors.pine} style={{ marginVertical: spacing.md }} /> : null}
        ListEmptyComponent={people.isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={styles.empty}>No colleagues found.</Text>}
        renderItem={({ item }) => {
          const checked = memberIds.includes(item.id);
          return (
            <Pressable style={styles.row} onPress={() => tapPerson(item.id)} disabled={create.isPending}>
              <Avatar name={item.name} uri={item.photo_url} size={36} fallbackColor={colors.chip} fallbackTextColor={colors.pine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{item.name}</Text>
                {item.department ? <Text style={styles.rowSublabel}>{item.department}</Text> : null}
              </View>
              {kind === 'direct' ? (
                create.isPending ? <ActivityIndicator color={colors.pine} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              ) : checked ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.pine} />
              ) : (
                <Ionicons name="ellipse-outline" size={22} color={colors.line} />
              )}
            </Pressable>
          );
        }}
      />

      {kind !== 'direct' ? (
        <Pressable style={[styles.submit, !canCreateGroup && styles.submitDisabled]} disabled={!canCreateGroup} onPress={() => openOrCreate(memberIds, name.trim())}>
          <Text style={styles.submitLabel}>{create.isPending ? 'Creating…' : `Create ${kind}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  visibilityPill: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  kindPillActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  kindLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  kindLabelActive: { color: colors.white },
  groupFields: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  selectedCount: { fontSize: 12, color: colors.muted },
  filters: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  searchInput: { flex: 1 },
  deptPicker: { width: 140 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  error: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.line },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rowSublabel: { fontSize: 12, color: colors.muted, marginTop: 1 },
  submit: { margin: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitLabel: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
