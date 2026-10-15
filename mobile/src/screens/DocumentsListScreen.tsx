import { uploadFile } from '../lib/uploadFile';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAcknowledgeDocument, useMyProfileOverview, useSubmitSignedCopy } from '../features/profile/api';
import * as DocumentPicker from 'expo-document-picker';
import { downloadAndShare } from '../features/leave/api';
import { useMemo, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { DocumentsStackParamList } from '../navigation/DocumentsStack';
import type { EmployeeDocument } from '../types/api';

type Props = NativeStackScreenProps<DocumentsStackParamList, 'DocumentsList'>;

function DocumentRow({ item, colors, typography, styles }: { item: EmployeeDocument; colors: ThemeColors; typography: Typography; styles: ReturnType<typeof makeStyles> }) {
  const statusColors: Record<string, string> = { approved: colors.success, pending: colors.warning, submitted: colors.warning, rejected: colors.danger, expired: colors.danger };
  const acknowledge = useAcknowledgeDocument();
  const signedCopy = useSubmitSignedCopy();
  const [opening, setOpening] = useState(false);
  const needsAcknowledgement = item.document_type?.signature_method === 'acknowledge' && item.status === 'approved' && !item.acknowledged_at;
  const needsSignature = item.document_type?.signature_method === 'signed_copy' && ['awaiting_signature', 'rejected', 'changes_requested'].includes(item.status);

  async function openDocument() {
    setOpening(true);
    try { await downloadAndShare(`/documents/${item.id}/download`, item.file_name ?? `document-${item.id}.pdf`); }
    catch { Alert.alert('Could not open document', 'Please try again.'); }
    finally { setOpening(false); }
  }

  async function uploadSignedCopy() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) { Alert.alert('File too large', 'Choose a file smaller than 10 MB.'); return; }
      await signedCopy.mutateAsync({ documentId: item.id, file: uploadFile(asset) });
      Alert.alert('Signed copy submitted', 'Your document has been sent for review.');
    } catch (error) { Alert.alert('Could not submit signed copy', error instanceof ApiError ? error.message : 'Please try again.'); }
  }

  async function handleAcknowledge() {
    try {
      await acknowledge.mutateAsync(item.id);
    } catch (err) {
      Alert.alert('Could not acknowledge', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={typography.heading}>{item.title}</Text>
        <Text style={[styles.status, { color: statusColors[item.status] ?? colors.muted }]}>{item.status}</Text>
      </View>
      {item.document_type ? <Text style={typography.caption}>{item.document_type.name}</Text> : null}
      {item.expires_at ? <Text style={typography.caption}>Expires {item.expires_at}</Text> : null}
      <Pressable accessibilityRole="button" onPress={openDocument} disabled={opening} style={{ paddingVertical: spacing.sm }}><Text style={styles.link}>{opening ? 'Opening…' : 'Open / save document'}</Text></Pressable>
      {needsSignature ? <Pressable accessibilityRole="button" onPress={uploadSignedCopy} disabled={signedCopy.isPending} style={{ paddingVertical: spacing.sm }}><Text style={styles.link}>{signedCopy.isPending ? 'Uploading…' : 'Upload signed copy'}</Text></Pressable> : null}
      {needsAcknowledgement ? (
        <Pressable onPress={handleAcknowledge} disabled={acknowledge.isPending} style={{ marginTop: spacing.sm }}>
          <Text style={styles.link}>{acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DocumentsListScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading, isError, refetch, isRefetching } = useMyProfileOverview();

  return (
    <View style={styles.flex}>
      <FlatList
        data={data?.documents ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <DocumentRow item={item} colors={colors} typography={typography} styles={styles} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={isError ? <QueryError retry={refetch} /> : null}
      ListEmptyComponent={
          isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No documents yet.</Text>
        }
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('UploadDocument')}>
        <Text style={styles.fabText}>+ Upload document</Text>
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
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  fabText: { color: colors.white, fontWeight: '700' },
});
