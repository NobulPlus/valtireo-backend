import { uploadFile } from '../lib/uploadFile';
import { QueryError } from '../components/QueryError';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMyDocumentTypes, useSubmitMyDocument } from '../features/profile/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { DocumentsStackParamList } from '../navigation/DocumentsStack';
import type { RNFile } from '../features/leave/api';

type Props = NativeStackScreenProps<DocumentsStackParamList, 'UploadDocument'>;

export function UploadDocumentScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: documentTypes, isLoading: loadingTypes, isError: typesError, refetch: retryTypes } = useMyDocumentTypes();
  const submitDocument = useSubmitMyDocument();

  const [documentTypeId, setDocumentTypeId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<RNFile | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile(uploadFile(asset));
      if (!title) setTitle(asset.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleSubmit() {
    if (!documentTypeId) return Alert.alert('Pick a document type', 'Choose which kind of document this is.');
    if (!file) return Alert.alert('Choose a file', 'Pick a photo or PDF to upload.');
    if (!title.trim()) return Alert.alert('Title required', 'Give this document a short title.');

    try {
      await submitDocument.mutateAsync({ document_type_id: documentTypeId, title, file, expires_at: expiresAt || undefined });
      Alert.alert('Uploaded', 'Your document was submitted for review.');
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        Alert.alert('Could not upload', Object.values(err.errors).flat().join('\n'));
      } else {
        Alert.alert('Could not upload', err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    }
  }

  if (typesError) return <QueryError retry={retryTypes} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Document type</Text>
      {loadingTypes ? (
        <ActivityIndicator color={colors.pine} />
      ) : (
        <View style={styles.chipRow}>
          {(documentTypes?.data ?? []).map((type) => (
            <Pressable key={type.id} onPress={() => setDocumentTypeId(type.id)} style={[styles.chip, documentTypeId === type.id && styles.chipActive]}>
              <Text style={[styles.chipText, documentTypeId === type.id && styles.chipTextActive]}>{type.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Expiry date (optional, YYYY-MM-DD)</Text>
      <TextInput value={expiresAt} onChangeText={setExpiresAt} style={styles.input} placeholder="2027-01-01" placeholderTextColor={colors.muted} />

      <Pressable style={styles.secondaryButton} onPress={pickFile}>
        <Text style={styles.secondaryButtonText}>{file ? `Selected: ${file.name}` : 'Choose file (photo or PDF)'}</Text>
      </Pressable>

      <Pressable style={[styles.button, submitDocument.isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitDocument.isPending}>
        {submitDocument.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Upload</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  secondaryButton: { marginTop: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
