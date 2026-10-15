import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateEmergencyContact, useUpdateEmergencyContact } from '../features/profile/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'EmergencyContactForm'>;

export function EmergencyContactFormScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const contact = route.params?.contact;
  const isEditing = Boolean(contact);

  const [name, setName] = useState(contact?.name ?? '');
  const [relationship, setRelationship] = useState(contact?.relationship ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [alternatePhone, setAlternatePhone] = useState(contact?.alternate_phone ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [address, setAddress] = useState(contact?.address ?? '');
  const [isPrimary, setIsPrimary] = useState(contact?.is_primary ?? false);

  const create = useCreateEmergencyContact();
  const update = useUpdateEmergencyContact(contact?.id ?? 0);
  const isPending = create.isPending || update.isPending;

  async function handleSubmit() {
    if (!name.trim()) return Alert.alert('Name required', 'Enter this contact’s name.');
    if (!phone.trim()) return Alert.alert('Phone required', 'Enter a phone number for this contact.');

    const payload = {
      name: name.trim(),
      relationship: relationship.trim() || null,
      phone: phone.trim(),
      alternate_phone: alternatePhone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      is_primary: isPrimary,
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

      <Text style={styles.label}>Relationship (optional)</Text>
      <TextInput value={relationship} onChangeText={setRelationship} style={styles.input} placeholder="Spouse, parent, sibling…" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Phone</Text>
      <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Alternate phone (optional)</Text>
      <TextInput value={alternatePhone} onChangeText={setAlternatePhone} style={styles.input} keyboardType="phone-pad" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Address (optional)</Text>
      <TextInput value={address} onChangeText={setAddress} style={[styles.input, styles.inputMultiline]} multiline placeholderTextColor={colors.muted} />

      <Pressable style={styles.checkboxRow} onPress={() => setIsPrimary((current) => !current)}>
        <View style={[styles.checkbox, isPrimary && styles.checkboxChecked]}>{isPrimary ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
        <Text style={styles.body}>Primary contact</Text>
      </Pressable>

      <Pressable style={[styles.button, isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={isPending}>
        {isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{isEditing ? 'Save changes' : 'Add contact'}</Text>}
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.pine, borderColor: colors.pine },
  checkboxMark: { color: colors.white, fontSize: 12, fontWeight: '700' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
