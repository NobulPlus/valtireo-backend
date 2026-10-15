import { uploadFile } from '../lib/uploadFile';
import { QueryError } from '../components/QueryError';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  isCancellableTicket,
  openTicketAttachment,
  openTicketCommentAttachment,
  useAddTicketComment,
  useCancelTicket,
  useResubmitTicket,
  useTicket,
} from '../features/tickets/api';
import type { RNFile } from '../features/leave/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { TicketsStackParamList } from '../navigation/TicketsStack';

type Props = NativeStackScreenProps<TicketsStackParamList, 'TicketDetail'>;

export function TicketDetailScreen({ route, navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const { ticketId } = route.params;
  const { data: ticket, isLoading, isError, refetch } = useTicket(ticketId);
  const cancel = useCancelTicket(ticketId);
  const resubmit = useResubmitTicket(ticketId);
  const addComment = useAddTicketComment(ticketId);

  /** null = "not edited yet" — falls back to the ticket's current values until the employee types. */
  const [resubmitSubject, setResubmitSubject] = useState<string | null>(null);
  const [resubmitDescription, setResubmitDescription] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentAttachment, setCommentAttachment] = useState<RNFile | null>(null);
  const [opening, setOpening] = useState(false);

  const resubmitSubjectValue = resubmitSubject ?? ticket?.subject ?? '';
  const resubmitDescriptionValue = resubmitDescription ?? ticket?.description ?? '';

  async function handleCancel() {
    Alert.alert('Cancel this ticket?', ticket?.subject ?? '', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel ticket',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancel.mutateAsync();
            navigation.goBack();
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  async function handleResubmit() {
    if (!resubmitSubjectValue.trim() || !resubmitDescriptionValue.trim()) return;
    try {
      await resubmit.mutateAsync({ subject: resubmitSubjectValue.trim(), description: resubmitDescriptionValue.trim() });
      Alert.alert('Ticket resubmitted', 'Your ticket has been sent back for review.');
    } catch (err) {
      Alert.alert('Could not resubmit', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  async function pickCommentAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) setCommentAttachment(uploadFile(result.assets[0]));
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync({ comment: commentText.trim(), attachment: commentAttachment });
      setCommentText('');
      setCommentAttachment(null);
    } catch (err) {
      Alert.alert('Could not add comment', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleOpenAttachment() {
    if (!ticket) return;
    setOpening(true);
    try {
      await openTicketAttachment(ticket);
    } catch {
      Alert.alert('Could not open attachment', 'Please try again.');
    } finally {
      setOpening(false);
    }
  }

  if (isError) return <QueryError retry={refetch} />;
  if (isLoading || !ticket) return <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.badgeRow}>
        <Text style={[styles.status, { color: statusColors[ticket.status] ?? colors.muted }]}>{ticket.status.replace('_', ' ')}</Text>
        <Text style={typography.caption}>{ticket.priority} priority</Text>
        {ticket.category ? <Text style={typography.caption}>· {ticket.category.name}</Text> : null}
        {ticket.department ? <Text style={typography.caption}>· {ticket.department.name}</Text> : null}
        {ticket.assigned_to ? <Text style={typography.caption}>· Assigned to {ticket.assigned_to.name}</Text> : null}
      </View>

      <Text style={typography.title}>{ticket.subject}</Text>
      <Text style={[typography.body, { marginTop: spacing.sm }]}>{ticket.description}</Text>

      {ticket.attachment_download_url ? (
        <Pressable onPress={handleOpenAttachment} disabled={opening} style={{ marginTop: spacing.md }}>
          <Text style={styles.link}>{opening ? 'Opening…' : `Open attachment: ${ticket.attachment_file_name ?? 'file'}`}</Text>
        </Pressable>
      ) : null}

      {isCancellableTicket(ticket) ? (
        <Pressable onPress={handleCancel} disabled={cancel.isPending} style={{ marginTop: spacing.md }}>
          <Text style={[styles.link, styles.linkDanger]}>{cancel.isPending ? 'Cancelling…' : 'Cancel ticket'}</Text>
        </Pressable>
      ) : null}

      {ticket.status === 'changes_requested' ? (
        <View style={styles.resubmitBox}>
          <Text style={styles.label}>Changes were requested — update and resubmit.</Text>
          <TextInput value={resubmitSubjectValue} onChangeText={setResubmitSubject} style={styles.input} placeholderTextColor={colors.muted} />
          <TextInput
            value={resubmitDescriptionValue}
            onChangeText={setResubmitDescription}
            style={[styles.input, styles.inputMultiline, { marginTop: spacing.sm }]}
            multiline
            placeholderTextColor={colors.muted}
          />
          <Pressable
            style={[styles.button, (resubmit.isPending || !resubmitSubjectValue.trim() || !resubmitDescriptionValue.trim()) && styles.buttonDisabled]}
            onPress={handleResubmit}
            disabled={resubmit.isPending || !resubmitSubjectValue.trim() || !resubmitDescriptionValue.trim()}
          >
            {resubmit.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Resubmit</Text>}
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.label, { marginTop: spacing.xl }]}>Comments</Text>
      {(ticket.comments ?? []).length === 0 ? (
        <Text style={typography.caption}>No comments yet.</Text>
      ) : (
        (ticket.comments ?? []).map((comment) => (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.commentAuthor}>{comment.user?.name ?? 'System'}</Text>
              <Text style={typography.caption}>{new Date(comment.created_at).toLocaleString()}</Text>
            </View>
            <Text style={typography.body}>{comment.comment}</Text>
            {comment.attachment_download_url ? (
              <Pressable
                onPress={() => void openTicketCommentAttachment(ticket.id, comment).catch(() => Alert.alert('Could not open attachment', 'Please try again.'))}
                style={{ marginTop: spacing.xs }}
              >
                <Text style={styles.link}>{comment.attachment_file_name ?? 'View attachment'}</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <TextInput
        value={commentText}
        onChangeText={setCommentText}
        style={[styles.input, styles.inputMultiline, { marginTop: spacing.md }]}
        multiline
        placeholder="Add a comment…"
        placeholderTextColor={colors.muted}
      />
      <Pressable onPress={pickCommentAttachment} style={{ marginTop: spacing.sm }}>
        <Text style={styles.link}>{commentAttachment ? `Attached: ${commentAttachment.name}` : 'Attach a file (optional)'}</Text>
      </Pressable>
      <Pressable
        style={[styles.button, (addComment.isPending || !commentText.trim()) && styles.buttonDisabled]}
        onPress={handleAddComment}
        disabled={addComment.isPending || !commentText.trim()}
      >
        {addComment.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Add comment</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  linkDanger: { color: colors.danger },
  resubmitBox: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.paper },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  commentCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: colors.ink },
});
