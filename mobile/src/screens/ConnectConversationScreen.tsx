import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { ProductIconField } from '../components/ProductIconField';
import { formatMaxSize, isFileTooLarge, MAX_UPLOAD_BYTES, uploadFile } from '../lib/uploadFile';
import { uuid } from '../lib/uuid';
import { VoiceRecorder, MobileAttachment } from '../features/connect/ConnectAudio';
import {
  useConnectConversation, useConnectMessages, useConversationMembership, useMessageAction, useSendMessage, useStartCall,
} from '../features/connect/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { ConnectStackParamList } from '../navigation/ConnectStack';
import type { Message } from '../features/connect/types';

type Props = NativeStackScreenProps<ConnectStackParamList, 'ConnectConversation'>;

const REACTIONS: { key: string; icon: keyof typeof Ionicons.glyphMap; iconFilled: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'like', icon: 'thumbs-up-outline', iconFilled: 'thumbs-up', label: 'Like' },
  { key: 'heart', icon: 'heart-outline', iconFilled: 'heart', label: 'Love' },
  { key: 'celebrate', icon: 'sparkles-outline', iconFilled: 'sparkles', label: 'Celebrate' },
  { key: 'thanks', icon: 'hand-left-outline', iconFilled: 'hand-left', label: 'Thanks' },
  { key: 'laugh', icon: 'happy-outline', iconFilled: 'happy', label: 'Laugh' },
];

export function ConnectConversationScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const userId = session?.user.id;
  const cache = useQueryClient();

  const conversation = useConnectConversation(conversationId);
  const [before, setBefore] = useState<number | undefined>();
  const [reply, setReply] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<number[]>([]);
  const [error, setError] = useState('');

  const messages = useConnectMessages(conversationId, { before }, !!conversation.data);
  const membership = useConversationMembership(conversationId);
  const messageAction = useMessageAction(conversationId);
  const send = useSendMessage(conversationId);
  const startCall = useStartCall();

  const c = conversation.data;
  const newest = !before ? messages.data?.[0]?.id : undefined;
  useEffect(() => { if (newest) void membership.mutateAsync({ action: 'read', last_read_id: newest }).then(() => cache.invalidateQueries({ queryKey: ['connect', 'conversations'] })).catch(() => {}); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [conversationId, newest]);

  useLayoutEffect(() => {
    if (!c) return;
    navigation.setOptions({
      title: c.name,
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {c.kind === 'direct' ? (
            <Pressable
              accessibilityLabel="Call"
              style={{ padding: 6 }}
              onPress={() => startCall.mutate(conversationId, { onError: (e) => setError(e instanceof Error ? e.message : 'Could not start the call.') })}
            >
              <Ionicons name="call-outline" size={20} color={colors.pine} />
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Members" style={{ padding: 6 }} onPress={() => navigation.navigate('ConnectMembers', { conversationId })}>
            <Ionicons name="people-outline" size={20} color={colors.pine} />
          </Pressable>
        </View>
      ),
    });
    // Deliberately narrow: `c` is a fresh object reference every 5s poll even when
    // unchanged, and `colors`/`navigation`/`startCall` are themselves stable across
    // the screen's lifetime — depending on them would re-run this (and flicker the
    // header) on every refetch instead of only when the title/actions actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.name, c?.kind, conversationId]);

  if (conversation.isLoading) return <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />;
  if (!c) return <Text style={styles.error}>{conversation.error instanceof Error ? conversation.error.message : 'Could not load this conversation.'}</Text>;

  // Oldest-to-newest, same as the web client — a short conversation starts at
  // the top of the screen instead of clinging to the bottom the way an
  // `inverted` FlatList would anchor it.
  const ordered = [...(messages.data ?? [])].reverse();

  function toggleMention(id: number) {
    setMentions((current) => current.includes(id) ? current.filter((m) => m !== id) : [...current, id]);
  }

  async function attach() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf', 'text/*', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (isFileTooLarge(asset, MAX_UPLOAD_BYTES.connectAttachment)) {
      Alert.alert('File too large', `Attachments must be ${formatMaxSize(MAX_UPLOAD_BYTES.connectAttachment)} or smaller.`);
      return;
    }
    sendMessage({ file: uploadFile(asset) });
  }

  function sendMessage(extra: { file?: ReturnType<typeof uploadFile>; voiceNote?: boolean } = {}) {
    if (!body.trim() && !extra.file) return;
    send.mutate(
      { clientId: uuid(), body: body.trim() || undefined, replyToId: reply, mentions, voiceNote: extra.voiceNote, file: extra.file },
      {
        onSuccess: () => { setBody(''); setReply(null); setMentions([]); void cache.invalidateQueries({ queryKey: ['connect', 'conversations'] }); },
        onError: (e) => setError(e instanceof Error ? e.message : 'Message could not be sent.'),
      },
    );
  }

  return (
    <View style={styles.root}>
    <ProductIconField />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {c.archived ? <Text style={styles.archivedNotice}>This conversation is archived.</Text> : null}

      {messages.data?.length === 50 || before ? (
        <View style={styles.pagerRow}>
          {messages.data?.length === 50 ? <Pressable onPress={() => setBefore(ordered[0]?.id)}><Text style={styles.pagerLink}>Older messages</Text></Pressable> : null}
          {before ? <Pressable onPress={() => setBefore(undefined)}><Text style={styles.pagerLink}>Latest</Text></Pressable> : null}
        </View>
      ) : null}

      <FlatList
        data={ordered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.messages}
        ListEmptyComponent={<Text style={styles.emptyNote}>No messages here yet.</Text>}
        renderItem={({ item }: { item: Message }) => (
          <MessageRow
            message={item}
            isMine={item.sender.id === userId}
            canModerate={c.owner_id === userId || c.kind === 'direct'}
            onReply={() => setReply(item.id)}
            onReact={(reaction, enabled) => void messageAction.mutateAsync({ messageId: item.id, action: 'react', reaction, enabled })}
            onEdit={(text) => void messageAction.mutateAsync({ messageId: item.id, action: 'edit', body: text })}
            onDelete={() => Alert.alert('Remove this message?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void messageAction.mutateAsync({ messageId: item.id, action: 'delete' }) }])}
            onPin={() => void messageAction.mutateAsync({ messageId: item.id, action: 'pin', enabled: !item.pinned })}
            onReport={(reason) => void messageAction.mutateAsync({ messageId: item.id, action: 'report', reason })}
          />
        )}
      />

      {c.archived ? null : (
        <View style={styles.composer}>
          {reply ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>Replying to #{reply}</Text>
              <Pressable onPress={() => setReply(null)}><Ionicons name="close" size={14} color={colors.muted} /></Pressable>
            </View>
          ) : null}
          {/* Direct conversations have exactly one other member, who already sees
              every message — the backend silently drops mentions sent there
              (see ConnectChatController@send), so don't offer a picker that
              would look like it did something. */}
          {c.kind !== 'direct' && c.members.length > 1 ? (
            <View style={styles.mentionRow}>
              {c.members.filter((m) => m.id !== userId).map((m) => (
                <Pressable key={m.id} style={[styles.mentionChip, mentions.includes(m.id) && styles.mentionChipActive]} onPress={() => toggleMention(m.id)}>
                  <Text style={[styles.mentionChipLabel, mentions.includes(m.id) && styles.mentionChipLabelActive]}>@{m.name.split(' ')[0]}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write a message…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              maxLength={10000}
            />
            <Pressable accessibilityLabel="Attach a file" style={styles.iconButton} onPress={() => void attach()}><Ionicons name="attach" size={20} color={colors.pine} /></Pressable>
            <VoiceRecorder disabled={send.isPending} onReady={(file) => sendMessage({ file, voiceNote: true })} />
            <Pressable accessibilityLabel="Send" style={[styles.sendButton, (!body.trim() || send.isPending) && styles.sendButtonDisabled]} disabled={!body.trim() || send.isPending} onPress={() => sendMessage()}>
              {send.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="send" size={16} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
    </View>
  );
}

function MessageRow({ message, isMine, canModerate, onReply, onReact, onEdit, onDelete, onPin, onReport }: {
  message: Message; isMine: boolean; canModerate: boolean;
  onReply: () => void; onReact: (reaction: string, enabled: boolean) => void; onEdit: (body: string) => void; onDelete: () => void; onPin: () => void; onReport: (reason: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? '');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  // Six action icons rendered under every single message read as cluttered at
  // any real message volume — hidden until the message itself is tapped,
  // the mobile counterpart of web's hover-to-reveal toolbar (no hover on
  // touch, so a deliberate tap stands in for it).
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
      <Avatar name={message.sender.name} uri={message.sender.photo_url} size={32} fallbackColor={colors.chip} fallbackTextColor={colors.pine} />
      <Pressable style={[styles.messageBody, isMine && styles.messageBodyMine]} onPress={() => setRevealed((current) => !current)}>
        <View style={styles.messageHeader}>
          {/* Own messages skip the name label — the right-alignment and
              highlighted bubble already say "you", same as the web client. */}
          {isMine ? null : <Text style={styles.senderName}>{message.sender.name}</Text>}
          <Text style={styles.messageTime}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          {message.pinned ? <Ionicons name="pin" size={11} color={colors.pine} /> : null}
        </View>
        {message.reply_to_id ? <Text style={styles.replyNote}>Reply to message #{message.reply_to_id}</Text> : null}
        {editing ? (
          <View style={styles.inlineEditRow}>
            <TextInput value={draft} onChangeText={setDraft} style={styles.inlineEditInput} multiline autoFocus placeholderTextColor={colors.muted} />
            <Pressable accessibilityLabel="Save edit" style={styles.actionButton} onPress={() => { if (draft.trim()) { onEdit(draft.trim()); setEditing(false); } }}><Ionicons name="checkmark" size={16} color={colors.pine} /></Pressable>
            <Pressable accessibilityLabel="Cancel edit" style={styles.actionButton} onPress={() => { setEditing(false); setDraft(message.body ?? ''); }}><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
          </View>
        ) : (
          <Text style={styles.messageText}>{message.deleted ? 'Message removed' : message.body}</Text>
        )}
        {message.attachment ? <MobileAttachment attachment={message.attachment} /> : null}
        {reporting ? (
          <View style={styles.inlineEditRow}>
            <TextInput value={reason} onChangeText={setReason} placeholder="Why are you reporting this?" placeholderTextColor={colors.muted} style={styles.inlineEditInput} autoFocus />
            <Pressable accessibilityLabel="Submit report" style={styles.actionButton} onPress={() => { if (reason.trim()) { onReport(reason.trim()); setReporting(false); setReason(''); } }}><Ionicons name="checkmark" size={16} color={colors.pine} /></Pressable>
            <Pressable accessibilityLabel="Cancel report" style={styles.actionButton} onPress={() => setReporting(false)}><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
          </View>
        ) : null}
        {!message.deleted && !editing && revealed ? (
          <View style={styles.actionsRow}>
            <Pressable accessibilityLabel="Reply" style={styles.actionButton} onPress={onReply}><Ionicons name="arrow-undo-outline" size={15} color={colors.muted} /></Pressable>
            {REACTIONS.map((reactionOption) => {
              const r = message.reactions.find((item) => item.reaction === reactionOption.key);
              return (
                <Pressable key={reactionOption.key} accessibilityLabel={reactionOption.label} style={styles.actionButton} onPress={() => onReact(reactionOption.key, !r?.mine)}>
                  <Ionicons name={r?.mine ? reactionOption.iconFilled : reactionOption.icon} size={15} color={r?.mine ? colors.pine : colors.muted} />
                  {r ? <Text style={[styles.reactionCount, r.mine && { color: colors.pine }]}>{r.count}</Text> : null}
                </Pressable>
              );
            })}
            {isMine ? <>
              <Pressable accessibilityLabel="Edit message" style={styles.actionButton} onPress={() => setEditing(true)}><Ionicons name="pencil-outline" size={15} color={colors.muted} /></Pressable>
              <Pressable accessibilityLabel="Delete message" style={styles.actionButton} onPress={onDelete}><Ionicons name="trash-outline" size={15} color={colors.danger} /></Pressable>
            </> : null}
            {canModerate ? <Pressable accessibilityLabel={message.pinned ? 'Unpin message' : 'Pin message'} style={styles.actionButton} onPress={onPin}><Ionicons name={message.pinned ? 'pin' : 'pin-outline'} size={15} color={message.pinned ? colors.pine : colors.muted} /></Pressable> : null}
            <Pressable accessibilityLabel="Report message" style={styles.actionButton} onPress={() => setReporting(true)}><Ionicons name="flag-outline" size={15} color={colors.muted} /></Pressable>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, padding: spacing.md },
  archivedNotice: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: spacing.sm },
  messages: { padding: spacing.lg, gap: spacing.md },
  pagerRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  pagerLink: { textAlign: 'center', color: colors.pine, fontWeight: '600', fontSize: 13 },
  emptyNote: { textAlign: 'center', color: colors.muted, paddingVertical: spacing.xl },
  messageRow: { flexDirection: 'row', gap: spacing.sm },
  // Mirrors the web client: your own messages sit on the right (avatar
  // trailing instead of leading) in a highlighted bubble, so at a glance you
  // can tell who sent what without reading every name label.
  messageRowMine: { flexDirection: 'row-reverse' },
  // Shrink-wraps to its own content, capped at 78% of the row — both sides
  // of a conversation, same as web, instead of the incoming bubble stretching
  // to fill nearly the whole row regardless of how short the message is.
  messageBody: { flex: 0, maxWidth: '78%', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.line },
  messageBodyMine: { backgroundColor: colors.chip, borderColor: colors.chip },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  senderName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  messageTime: { fontSize: 11, color: colors.muted },
  replyNote: { fontSize: 11, color: colors.muted, marginTop: 2 },
  messageText: { fontSize: 14, color: colors.ink, marginTop: 2 },
  inlineEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  inlineEditInput: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: 13, color: colors.ink, backgroundColor: colors.paper },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.xs },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 6, borderRadius: radius.sm },
  reactionCount: { fontSize: 11, color: colors.muted },
  composer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, padding: spacing.sm },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: 4 },
  replyBannerText: { fontSize: 12, color: colors.muted },
  mentionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  mentionChip: { paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  mentionChipActive: { backgroundColor: colors.pine, borderColor: colors.pine },
  mentionChipLabel: { fontSize: 12, color: colors.muted },
  mentionChipLabelActive: { color: colors.white },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, paddingHorizontal: spacing.xs },
  input: { flex: 1, maxHeight: 100, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, fontSize: 14, color: colors.ink, backgroundColor: colors.paper },
  iconButton: { padding: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
