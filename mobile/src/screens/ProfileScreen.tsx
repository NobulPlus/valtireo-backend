import { uploadFile } from '../lib/uploadFile';
import { QueryError } from '../components/QueryError';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMyProfileOverview, useUpdateMyProfile } from '../features/profile/api';
import type { EmployeeProfileOverview } from '../types/api';
import type { RNFile } from '../features/leave/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profile'>;

/** Mirrors the web app's biodata tab exactly, since LeaveType.restricted_to_gender compares against this value. */
const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
];

export function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading, isError, refetch } = useMyProfileOverview();
  if (isLoading) return <ActivityIndicator style={styles.flex} color={colors.pine} />;
  if (isError || !data) return <QueryError retry={refetch} />;
  return <ProfileForm key={data.employee?.id ?? 'me'} data={data} navigation={navigation} />;
}

function ProfileForm({ data, navigation }: { data: EmployeeProfileOverview; navigation: Props['navigation'] }) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const updateProfile = useUpdateMyProfile();

  const [dateOfBirth, setDateOfBirth] = useState(data.profile?.date_of_birth ?? '');
  const [gender, setGender] = useState(data.profile?.gender ?? '');
  const [personalEmail, setPersonalEmail] = useState(data.profile?.personal_email ?? '');
  const [address, setAddress] = useState(data.profile?.residential_address ?? '');
  const [nextOfKinName, setNextOfKinName] = useState(data.profile?.next_of_kin_name ?? '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(data.profile?.next_of_kin_phone ?? '');
  const [photo, setPhoto] = useState<RNFile | null>(null);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto(uploadFile(asset));
    }
  }

  async function handleSave() {
    try {
      await updateProfile.mutateAsync({
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        personal_email: personalEmail || null,
        residential_address: address || null,
        next_of_kin_name: nextOfKinName || null,
        next_of_kin_phone: nextOfKinPhone || null,
        passport_photo: photo,
      });
      setPhoto(null);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const employee = data?.employee;
  const photoUrl = photo?.uri ?? data?.profile?.passport_photo_url ?? undefined;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Pressable onPress={pickPhoto} style={styles.photoWrap}>
        <Avatar uri={photoUrl} name={employee?.full_name ?? 'Your'} size={84} />
        <Text style={styles.changePhoto}>Change photo</Text>
        {photo ? <Text style={typography.caption}>Photo selected. Tap Save changes to upload it.</Text> : null}
      </Pressable>

      <View style={styles.readonlyCard}>
        <Field label="Full name" value={employee?.full_name ?? '—'} typography={typography} />
        <Field label="Employee number" value={employee?.employee_number ?? '—'} typography={typography} />
        <Field label="Work email" value={employee?.work_email ?? '—'} typography={typography} />
        <Field label="Department" value={employee?.department?.name ?? '—'} typography={typography} />
      </View>

      <Text style={styles.sectionTitle}>Editable details</Text>
      <LabeledInput label="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} colors={colors} styles={styles} />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.chipRow}>
        {GENDER_OPTIONS.map((option) => (
          <Pressable key={option.value} onPress={() => setGender(option.value)} style={[styles.chip, gender === option.value && styles.chipActive]}>
            <Text style={[styles.chipText, gender === option.value && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[typography.caption, { marginBottom: spacing.md }]}>Used to show you the right leave types (e.g. maternity/paternity).</Text>

      <LabeledInput label="Personal email" value={personalEmail} onChangeText={setPersonalEmail} keyboardType="email-address" colors={colors} styles={styles} />
      <LabeledInput label="Residential address" value={address} onChangeText={setAddress} multiline colors={colors} styles={styles} />
      <LabeledInput label="Next of kin name" value={nextOfKinName} onChangeText={setNextOfKinName} colors={colors} styles={styles} />
      <LabeledInput label="Next of kin phone" value={nextOfKinPhone} onChangeText={setNextOfKinPhone} keyboardType="phone-pad" colors={colors} styles={styles} />

      <Pressable style={[styles.button, updateProfile.isPending && styles.buttonDisabled]} onPress={handleSave} disabled={updateProfile.isPending}>
        {updateProfile.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save changes</Text>}
      </Pressable>

      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>People</Text>
      <Pressable style={styles.navRow} onPress={() => navigation.navigate('EmergencyContacts')}>
        <Text style={styles.body}>Emergency contacts</Text>
        <Text style={typography.caption}>{data.emergency_contacts.length} ›</Text>
      </Pressable>
      <Pressable style={styles.navRow} onPress={() => navigation.navigate('Dependents')}>
        <Text style={styles.body}>Dependents</Text>
        <Text style={typography.caption}>{data.dependents.length} ›</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, value, typography }: { label: string; value: string; typography: Typography }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'email-address' | 'phone-pad';
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={props.styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        multiline={props.multiline}
        keyboardType={props.keyboardType}
        style={[props.styles.input, props.multiline && props.styles.inputMultiline]}
        placeholderTextColor={props.colors.muted}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  photoWrap: { alignItems: 'center', marginBottom: spacing.lg },
  photo: { width: 84, height: 84, borderRadius: 42 },
  photoPlaceholder: { backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { color: colors.white, fontSize: 28, fontWeight: '700' },
  changePhoto: { fontSize: 12, color: colors.pine, marginTop: spacing.xs, fontWeight: '600' },
  readonlyCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: spacing.sm },
  label: { fontSize: 12, color: colors.muted, marginBottom: spacing.xs, fontWeight: '600' },
  body: { fontSize: 14, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
