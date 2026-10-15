import { uploadFile } from '../lib/uploadFile';
import { QueryError } from '../components/QueryError';
import { SearchableSelect } from '../components/SearchableSelect';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateLeaveRequest, useLeaveTypes, type RNFile } from '../features/leave/api';
import { useEmployeeDirectory } from '../features/directory/api';
import { useMyProfileOverview } from '../features/profile/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { LeaveStackParamList } from '../navigation/LeaveStack';

type Props = NativeStackScreenProps<LeaveStackParamList, 'NewLeaveRequest'>;

export function NewLeaveRequestScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: leaveTypes, isLoading: loadingTypes, isError: typesError, refetch: retryTypes } = useLeaveTypes();
  const { data: profileOverview } = useMyProfileOverview();
  const createRequest = useCreateLeaveRequest();

  // Mirrors the web app: a leave type restricted to a gender is hidden from
  // everyone else rather than shown and then rejected on submit. The backend
  // (LeaveRequestService) still enforces this independently either way.
  const myGender = (profileOverview?.profile?.gender ?? '').toLowerCase().trim();
  const selectableLeaveTypes = (leaveTypes?.data ?? []).filter(
    (type) => !type.restricted_to_gender || type.restricted_to_gender.toLowerCase() === myGender,
  );

  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<RNFile | null>(null);
  const [handoverScope, setHandoverScope] = useState<'department' | 'all'>('department');
  const [handoverEmployeeId, setHandoverEmployeeId] = useState<number | null>(null);
  const [handoverSearch, setHandoverSearch] = useState('');
  const [handoverLabel, setHandoverLabel] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverDocument, setHandoverDocument] = useState<RNFile | null>(null);

  const directoryQuery = useEmployeeDirectory({ department_id: handoverScope === 'all' ? 'all' : undefined, search: handoverSearch });
  const handoverOptions = directoryQuery.items.map((employee) => ({
    value: String(employee.id),
    label: employee.full_name,
    sublabel: employee.department?.name,
  }));

  async function pickEvidence() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setEvidence(uploadFile(asset));
    }
  }

  async function pickHandoverDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) setHandoverDocument(uploadFile(result.assets[0]));
  }

  async function handleSubmit() {
    if (!leaveTypeId) return Alert.alert('Pick a leave type', 'Choose which kind of leave you’re requesting.');
    if (!startsOn || !endsOn) return Alert.alert('Missing dates', 'Enter both a start and end date (YYYY-MM-DD).');

    try {
      await createRequest.mutateAsync({
        leave_type_id: leaveTypeId,
        starts_on: startsOn,
        ends_on: endsOn,
        reason: reason || undefined,
        evidence,
        handover_to_employee_id: handoverEmployeeId,
        handover_note: handoverNote || undefined,
        handover_document: handoverDocument,
      });
      Alert.alert('Request submitted', 'Your leave request has been sent for approval.');
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        Alert.alert('Could not submit', Object.values(err.errors).flat().join('\n'));
      } else {
        Alert.alert('Could not submit', err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    }
  }

  if (typesError) return <QueryError retry={retryTypes} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Leave type</Text>
      {loadingTypes ? (
        <ActivityIndicator color={colors.pine} />
      ) : (
        <View style={styles.chipRow}>
          {selectableLeaveTypes.map((type) => (
            <Pressable
              key={type.id}
              onPress={() => setLeaveTypeId(type.id)}
              style={[styles.chip, leaveTypeId === type.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, leaveTypeId === type.id && styles.chipTextActive]}>{type.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
      <TextInput value={startsOn} onChangeText={setStartsOn} style={styles.input} placeholder="2026-11-01" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
      <TextInput value={endsOn} onChangeText={setEndsOn} style={styles.input} placeholder="2026-11-05" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Reason (optional)</Text>
      <TextInput value={reason} onChangeText={setReason} style={[styles.input, styles.inputMultiline]} multiline placeholderTextColor={colors.muted} />

      <Pressable style={styles.secondaryButton} onPress={pickEvidence}>
        <Text style={styles.secondaryButtonText}>{evidence ? `Attached: ${evidence.name}` : 'Attach evidence (optional)'}</Text>
      </Pressable>

      <Text style={[styles.label, { marginTop: spacing.xl }]}>Handover to (optional)</Text>
      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setHandoverScope('department')}
          style={[styles.scopeChip, handoverScope === 'department' && styles.chipActive]}
        >
          <Text style={[styles.chipText, handoverScope === 'department' && styles.chipTextActive]}>My department</Text>
        </Pressable>
        <Pressable onPress={() => setHandoverScope('all')} style={[styles.scopeChip, handoverScope === 'all' && styles.chipActive]}>
          <Text style={[styles.chipText, handoverScope === 'all' && styles.chipTextActive]}>Everyone</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <SearchableSelect
          label="Handover to"
          placeholder="No one"
          clearLabel="No one"
          value={handoverEmployeeId ? String(handoverEmployeeId) : null}
          options={handoverOptions}
          selectedLabel={handoverLabel}
          onSearch={setHandoverSearch}
          onEndReached={directoryQuery.fetchMore}
          isFetchingMore={directoryQuery.isFetchingNextPage}
          loading={directoryQuery.isLoading}
          error={directoryQuery.isError}
          onRetry={() => void directoryQuery.refetch()}
          onChange={(value) => { setHandoverEmployeeId(value ? Number(value) : null); setHandoverLabel(handoverOptions.find((item) => item.value === value)?.label ?? ''); }}
        />
      </View>

      {handoverEmployeeId ? (
        <>
          <Text style={styles.label}>Handover note (optional)</Text>
          <TextInput
            value={handoverNote}
            onChangeText={setHandoverNote}
            style={[styles.input, styles.inputMultiline]}
            multiline
            placeholder="What should they know while covering for you?"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.secondaryButton} onPress={pickHandoverDocument}>
            <Text style={styles.secondaryButtonText}>{handoverDocument ? `Attached: ${handoverDocument.name}` : 'Attach a handover document (optional)'}</Text>
          </Pressable>
        </>
      ) : null}

      <Pressable style={[styles.button, createRequest.isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={createRequest.isPending}>
        {createRequest.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Submit request</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  scopeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  secondaryButton: { marginTop: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
