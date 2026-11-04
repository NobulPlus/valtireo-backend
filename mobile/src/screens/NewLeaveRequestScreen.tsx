import { formatMaxSize, isFileTooLarge, MAX_UPLOAD_BYTES, uploadFile } from '../lib/uploadFile';
import { KeyboardAvoidingScreen } from '../components/KeyboardAvoidingScreen';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import { SearchableSelect } from '../components/SearchableSelect';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Calendar, type DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateLeaveRequest, useLeaveTypes, type RNFile } from '../features/leave/api';
import { useEmployeeDirectory } from '../features/directory/api';
import { useMyProfileOverview } from '../features/profile/api';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';
import { todayInZone } from '../lib/calendarDate';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { LeaveStackParamList } from '../navigation/LeaveStack';

type Props = NativeStackScreenProps<LeaveStackParamList, 'NewLeaveRequest'>;

/**
 * Fills every day from `start` to `end` (inclusive) with "period" marking so
 * react-native-calendars draws one continuous highlighted range rather than
 * two isolated dots — built with UTC-anchored date math (see lib/calendarDate.ts)
 * so the range never drifts a day under the device's local timezone.
 */
function buildRangeMarking(start: string, end: string, colors: ThemeColors): Record<string, object> {
  const marked: Record<string, object> = {};
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    const dateString = cursor.toISOString().slice(0, 10);
    marked[dateString] = {
      color: colors.pine,
      textColor: colors.white,
      startingDay: dateString === start,
      endingDay: dateString === end,
    };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return marked;
}

/** "Nov 1, 2026" — matches formatMaxSize/other screens' house style of short, locale-formatted dates over raw ISO strings. */
function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function NewLeaveRequestScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: leaveTypes, isLoading: loadingTypes, isError: typesError, error: typesErrorDetail, refetch: retryTypes } = useLeaveTypes();
  const { data: profileOverview } = useMyProfileOverview();
  const { session } = useAuth();
  const createRequest = useCreateLeaveRequest();
  const timezone = session?.workspace?.localization.timezone ?? 'Africa/Lagos';
  const minDate = useMemo(() => todayInZone(timezone), [timezone]);

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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

  // Two-tap range selection: the first tap sets the start (clearing any prior end), a tap
  // before that start moves the start there instead, and otherwise the tap sets the end —
  // mirroring how react-native-calendars' own period-marking examples expect callers to
  // track range state, since the library itself only reports single day taps.
  function handleDayPress(day: DateData) {
    const picked = day.dateString;
    if (!startsOn || endsOn) {
      setStartsOn(picked);
      setEndsOn('');
      return;
    }
    if (picked < startsOn) {
      setStartsOn(picked);
      setEndsOn('');
      return;
    }
    setEndsOn(picked);
  }

  async function pickEvidence() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (isFileTooLarge(asset, MAX_UPLOAD_BYTES.leaveEvidence)) {
        Alert.alert('File too large', `Evidence must be ${formatMaxSize(MAX_UPLOAD_BYTES.leaveEvidence)} or smaller.`);
        return;
      }
      setEvidence(uploadFile(asset));
    }
  }

  async function pickHandoverDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (isFileTooLarge(asset, MAX_UPLOAD_BYTES.leaveHandoverDocument)) {
        Alert.alert('File too large', `The handover document must be ${formatMaxSize(MAX_UPLOAD_BYTES.leaveHandoverDocument)} or smaller.`);
        return;
      }
      setHandoverDocument(uploadFile(asset));
    }
  }

  async function handleSubmit() {
    if (!leaveTypeId) return Alert.alert('Pick a leave type', 'Choose which kind of leave you’re requesting.');
    if (!startsOn || !endsOn) return Alert.alert('Missing dates', 'Pick a start and end date for your leave.');

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

  if (typesError) return <QueryError retry={retryTypes} error={typesErrorDetail} />;

  return (
    <View style={styles.root}>
    <ProductIconField />
    <KeyboardAvoidingScreen>
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

      <Text style={styles.label}>Dates</Text>
      <Pressable style={styles.dateTrigger} onPress={() => setDatePickerOpen(true)} accessibilityRole="button" accessibilityLabel="Dates">
        <Text style={startsOn ? styles.dateTriggerValue : styles.dateTriggerPlaceholder} numberOfLines={1}>
          {startsOn ? `${formatDisplayDate(startsOn)}${endsOn && endsOn !== startsOn ? ` – ${formatDisplayDate(endsOn)}` : ''}` : 'Select dates'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={datePickerOpen} animationType="slide" transparent onRequestClose={() => setDatePickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDatePickerOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Leave dates</Text>
          <Text style={styles.sheetSubtitle}>
            {startsOn && endsOn ? `${formatDisplayDate(startsOn)} – ${formatDisplayDate(endsOn)}` : startsOn ? `${formatDisplayDate(startsOn)} – tap an end date` : 'Tap a start date'}
          </Text>
          <Calendar
            minDate={minDate}
            markingType="period"
            markedDates={startsOn ? buildRangeMarking(startsOn, endsOn || startsOn, colors) : {}}
            onDayPress={handleDayPress}
            theme={{
              calendarBackground: colors.white,
              textSectionTitleColor: colors.muted,
              dayTextColor: colors.ink,
              todayTextColor: colors.pine,
              monthTextColor: colors.ink,
              arrowColor: colors.pine,
              textDisabledColor: colors.line,
            }}
            style={styles.calendar}
          />
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetSecondaryAction} onPress={() => { setStartsOn(''); setEndsOn(''); }}>
              <Text style={styles.sheetSecondaryActionText}>Clear</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetPrimaryAction, !startsOn && styles.sheetPrimaryActionDisabled]}
              onPress={() => { if (!endsOn) setEndsOn(startsOn); setDatePickerOpen(false); }}
              disabled={!startsOn}
            >
              <Text style={styles.sheetPrimaryActionText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
    </KeyboardAvoidingScreen>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.white,
  },
  dateTriggerValue: { fontSize: 14, color: colors.ink, flex: 1, marginRight: spacing.sm },
  dateTriggerPlaceholder: { fontSize: 14, color: colors.muted, flex: 1, marginRight: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs },
  sheetSubtitle: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  calendar: { borderRadius: radius.sm, marginBottom: spacing.md },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetSecondaryAction: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  sheetSecondaryActionText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  sheetPrimaryAction: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  sheetPrimaryActionDisabled: { opacity: 0.5 },
  sheetPrimaryActionText: { color: colors.white, fontWeight: '700', fontSize: 14 },
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
