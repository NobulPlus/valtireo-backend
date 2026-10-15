import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useReportAssetFault } from '../features/assets/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AssetsStackParamList } from '../navigation/AssetsStack';

type Props = NativeStackScreenProps<AssetsStackParamList, 'ReportFault'>;

export function ReportFaultScreen({ route, navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { assetId, assetName } = route.params;
  const reportFault = useReportAssetFault(assetId);
  const [note, setNote] = useState('');

  async function handleSubmit() {
    if (!note.trim()) return Alert.alert('Describe the fault', 'Add a short note about what is wrong.');
    try {
      await reportFault.mutateAsync(note.trim());
      Alert.alert('Fault reported', 'This asset has been flagged for maintenance.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not report fault', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={typography.heading}>{assetName}</Text>
      <Text style={[styles.label, { marginTop: spacing.lg }]}>What&apos;s wrong?</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        style={[styles.input, styles.inputMultiline]}
        multiline
        placeholder="Describe the fault, e.g. keyboard unresponsive."
        placeholderTextColor={colors.muted}
      />
      <Pressable style={[styles.button, (reportFault.isPending || !note.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={reportFault.isPending || !note.trim()}>
        {reportFault.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Report fault</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
