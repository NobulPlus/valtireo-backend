import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingScreen } from '../components/KeyboardAvoidingScreen';
import { QueryError } from '../components/QueryError';
import {
  useCreateOrbitComment,
  useMoveOrbitWorkItem,
  useOrbitComments,
  useOrbitStatuses,
  useOrbitWorkItem,
} from '../features/orbit/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { OrbitStackParamList } from '../navigation/OrbitStack';

type Props = NativeStackScreenProps<OrbitStackParamList, 'OrbitWorkItemDetail'>;

export function OrbitWorkItemDetailScreen({ route }: Props) {
  const { itemKey } = route.params;
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { data, isLoading, isError, error, refetch } = useOrbitWorkItem(itemKey);
  const { data: commentsData, refetch: refetchComments } = useOrbitComments(itemKey);
  const { data: statusesData } = useOrbitStatuses(data?.work_item.project_id);
  const createComment = useCreateOrbitComment(itemKey);
  const moveItem = useMoveOrbitWorkItem(itemKey);
  const [body, setBody] = useState('');

  const item = data?.work_item;
  const comments = commentsData?.data ?? [];
  const statuses = statusesData?.data ?? [];

  if (isLoading) return <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />;
  if (isError || !item) return <QueryError retry={refetch} error={error} />;

  function changeStatus() {
    if (!item) return;
    Alert.alert(
      'Move to…',
      undefined,
      statuses.map((status) => ({
        text: status.name,
        onPress: () => moveItem.mutate({ status_id: status.id, position: '1024', version: item.version }),
      })).concat([{ text: 'Cancel', style: 'cancel', onPress: () => undefined }] as never),
    );
  }

  async function handleComment() {
    if (!body.trim()) return;
    try {
      await createComment.mutateAsync(body);
      setBody('');
      void refetchComments();
    } catch (err) {
      Alert.alert('Could not post comment', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <KeyboardAvoidingScreen>
    <FlatList
      data={comments}
      keyExtractor={(comment) => String(comment.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <Text style={typography.heading}>
            <Text style={styles.key}>{item.key} </Text>
            {item.title}
          </Text>
          {item.description ? <Text style={[typography.body, styles.description]}>{item.description}</Text> : null}

          <Pressable style={styles.statusPill} onPress={changeStatus}>
            <Text style={styles.statusPillText}>{item.status?.name ?? 'Status'} · Change</Text>
          </Pressable>

          <Text style={[typography.caption, styles.sectionLabel]}>Comments</Text>
        </View>
      }
      renderItem={({ item: comment }) => (
        <View style={styles.comment}>
          <Text style={styles.commentAuthor}>{comment.author?.name}</Text>
          <Text style={typography.body}>{comment.body}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={[typography.caption, styles.empty]}>No comments yet.</Text>}
      ListFooterComponent={
        <View style={styles.commentForm}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Add a comment…"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.commentInput}
          />
          <Pressable style={styles.sendButton} onPress={handleComment} disabled={createComment.isPending || !body.trim()}>
            <Text style={styles.sendButtonText}>{createComment.isPending ? 'Posting…' : 'Post comment'}</Text>
          </Pressable>
        </View>
      }
    />
    </KeyboardAvoidingScreen>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2, backgroundColor: colors.paper },
  key: { color: colors.muted, fontWeight: '700' },
  description: { marginTop: spacing.sm },
  statusPill: { marginTop: spacing.md, alignSelf: 'flex-start', backgroundColor: colors.chip, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusPillText: { fontSize: 13, fontWeight: '700', color: colors.pine },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  comment: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.line },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs },
  empty: { marginBottom: spacing.md },
  commentForm: { marginTop: spacing.md, gap: spacing.sm },
  commentInput: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, minHeight: 72, color: colors.ink, textAlignVertical: 'top' },
  sendButton: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  sendButtonText: { color: colors.white, fontWeight: '700' },
});
