import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRequestAttendanceCorrection } from '../features/attendance/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AttendanceStackParamList } from '../navigation/AttendanceStack';
import { correctionTimestamp } from '../lib/calendarDate';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'RequestCorrection'>;

export function RequestCorrectionScreen({ route, navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { record } = route.params;
  const requestCorrection = useRequestAttendanceCorrection();
  const { session } = useAuth();
  const timezone = session?.workspace?.localization.timezone ?? 'Africa/Lagos';

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [checkOutNextDay, setCheckOutNextDay] = useState(false);
  const [reason, setReason] = useState('');

  // The record stores full timestamps; the form only asks for a time, so combine it with the record's own
  // date — except check-out, which can land on the following calendar day for an overnight shift.
  function toTimestamp(time: string, nextDay = false): string | undefined {
    return correctionTimestamp(record.attendance_date, time, nextDay);
  }

  async function handleSubmit() {
    if (!reason.trim()) return Alert.alert('Reason required', 'Explain why this record needs correcting.');
    if (!checkIn && !checkOut) return Alert.alert('Time required', 'Enter at least one corrected time.');
    if (checkIn && !toTimestamp(checkIn)) return Alert.alert('Invalid check-in time', 'Use HH:MM, e.g. 09:00.');
    if (checkOut && !toTimestamp(checkOut, checkOutNextDay)) return Alert.alert('Invalid check-out time', 'Use HH:MM, e.g. 17:30.');
    try {
      await requestCorrection.mutateAsync({
        attendance_record_id: record.id,
        timezone,
        requested_check_in_at: toTimestamp(checkIn),
        requested_check_out_at: toTimestamp(checkOut, checkOutNextDay),
        reason,
      });
      Alert.alert('Request sent', 'Your correction request has been submitted for review.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not submit', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={typography.heading}>{record.attendance_date}</Text>
      <Text style={typography.caption}>Enter times in {timezone}.</Text>
      <Text style={[typography.caption, { marginBottom: spacing.lg }]}>
        Current: {record.check_in_at ? new Date(record.check_in_at).toLocaleTimeString() : '—'} → {record.check_out_at ? new Date(record.check_out_at).toLocaleTimeString() : '—'}
      </Text>

      <Text style={styles.label}>Correct check-in (HH:MM, 24h)</Text>
      <TextInput value={checkIn} onChangeText={setCheckIn} style={styles.input} placeholder="09:00" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Correct check-out (HH:MM, 24h)</Text>
      <TextInput value={checkOut} onChangeText={setCheckOut} style={styles.input} placeholder="17:30" placeholderTextColor={colors.muted} />

      <Pressable style={styles.checkboxRow} onPress={() => setCheckOutNextDay((current) => !current)}>
        <View style={[styles.checkbox, checkOutNextDay && styles.checkboxChecked]}>
          {checkOutNextDay ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={typography.body}>Check-out is the next day (overnight shift)</Text>
      </Pressable>

      <Text style={styles.label}>Reason</Text>
      <TextInput value={reason} onChangeText={setReason} style={[styles.input, styles.inputMultiline]} multiline placeholderTextColor={colors.muted} />

      <Pressable style={[styles.button, requestCorrection.isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={requestCorrection.isPending}>
        {requestCorrection.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Submit correction</Text>}
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.pine, borderColor: colors.pine },
  checkboxMark: { color: colors.white, fontSize: 12, fontWeight: '700' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
