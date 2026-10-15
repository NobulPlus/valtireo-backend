import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateDependent, useUpdateDependent } from '../features/profile/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'DependentForm'>;

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
];

export function DependentFormScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dependent = route.params?.dependent;
  const isEditing = Boolean(dependent);

  const [name, setName] = useState(dependent?.name ?? '');
  const [relationship, setRelationship] = useState(dependent?.relationship ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(dependent?.date_of_birth ?? '');
  const [gender, setGender] = useState(dependent?.gender ?? '');
  const [phone, setPhone] = useState(dependent?.phone ?? '');
  const [email, setEmail] = useState(dependent?.email ?? '');
  const [address, setAddress] = useState(dependent?.address ?? '');
  const [isBeneficiary, setIsBeneficiary] = useState(dependent?.is_beneficiary ?? false);

  const create = useCreateDependent();
  const update = useUpdateDependent(dependent?.id ?? 0);
  const isPending = create.isPending || update.isPending;

  async function handleSubmit() {
    if (!name.trim()) return Alert.alert('Name required', 'Enter this dependent’s name.');
    if (!relationship.trim()) return Alert.alert('Relationship required', 'Describe how this person relates to you.');

    const payload = {
      name: name.trim(),
      relationship: relationship.trim(),
      date_of_birth: dateOfBirth.trim() || null,
      gender: gender || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      is_beneficiary: isBeneficiary,
    };

    try {
      if (isEditing) await update.mutateAsync(payload);
      else await create.mutateAsync(payload);
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        Alert.alert('Could not save', Object.values(err.errors).flat().join('\n'));
      } else {
        Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Relationship</Text>
      <TextInput value={relationship} onChangeText={setRelationship} style={styles.input} placeholder="Child, spouse, parent…" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Date of birth (optional, YYYY-MM-DD)</Text>
      <TextInput value={dateOfBirth} onChangeText={setDateOfBirth} style={styles.input} placeholder="2015-06-01" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Gender (optional)</Text>
      <View style={styles.chipRow}>
        {GENDER_OPTIONS.map((option) => (
          <Pressable key={option.value} onPress={() => setGender(option.value)} style={[styles.chip, gender === option.value && styles.chipActive]}>
            <Text style={[styles.chipText, gender === option.value && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Address (optional)</Text>
      <TextInput value={address} onChangeText={setAddress} style={[styles.input, styles.inputMultiline]} multiline placeholderTextColor={colors.muted} />

      <Pressable style={styles.checkboxRow} onPress={() => setIsBeneficiary((current) => !current)}>
        <View style={[styles.checkbox, isBeneficiary && styles.checkboxChecked]}>{isBeneficiary ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
        <Text style={styles.body}>Beneficiary</Text>
      </Pressable>

      <Pressable style={[styles.button, isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={isPending}>
        {isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{isEditing ? 'Save changes' : 'Add dependent'}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  body: { fontSize: 14, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.pine, borderColor: colors.pine },
  checkboxMark: { color: colors.white, fontSize: 12, fontWeight: '700' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
