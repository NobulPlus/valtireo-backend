import { uploadFile } from '../lib/uploadFile';
import { QueryError } from '../components/QueryError';
import { SearchableSelect } from '../components/SearchableSelect';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateTicket, useDepartmentOptions, useTicketCategories, useTicketResolvers } from '../features/tickets/api';
import type { RNFile } from '../features/leave/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { TicketsStackParamList } from '../navigation/TicketsStack';

type Props = NativeStackScreenProps<TicketsStackParamList, 'NewTicket'>;

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

export function NewTicketScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: categories, isLoading: loadingCategories, isError: categoriesError, refetch: retryCategories } = useTicketCategories();
  const { data: departments } = useDepartmentOptions();
  const { data: resolvers } = useTicketResolvers();
  const createTicket = useCreateTicket();

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<RNFile | null>(null);

  const visibleResolvers = (resolvers ?? []).filter((resolver) => !departmentId || resolver.department?.id === departmentId);
  const departmentOptions = (departments ?? []).map((department) => ({ value: String(department.id), label: department.name }));
  const resolverOptions = visibleResolvers.map((resolver) => ({ value: String(resolver.id), label: resolver.name, sublabel: resolver.department?.name }));

  async function pickAttachment() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) setAttachment(uploadFile(result.assets[0]));
  }

  async function handleSubmit() {
    if (!categoryId) return Alert.alert('Pick a category', 'Choose what this request is about.');
    if (!subject.trim() || !description.trim()) return Alert.alert('Missing details', 'Enter a subject and description.');

    try {
      await createTicket.mutateAsync({
        ticket_category_id: categoryId,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        department_id: departmentId ?? undefined,
        assigned_to_user_id: assigneeId ?? undefined,
        attachment,
      });
      Alert.alert('Ticket submitted', 'Your request has been submitted for review.');
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        Alert.alert('Could not submit', Object.values(err.errors).flat().join('\n'));
      } else {
        Alert.alert('Could not submit', err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    }
  }

  if (categoriesError) return <QueryError retry={retryCategories} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Category</Text>
      {loadingCategories ? (
        <ActivityIndicator color={colors.pine} />
      ) : (
        <View style={styles.chipRow}>
          {(categories?.data ?? []).map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[styles.chip, categoryId === category.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, categoryId === category.id && styles.chipTextActive]}>{category.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Subject</Text>
      <TextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="Brief summary" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.inputMultiline]}
        multiline
        placeholder="Describe what you need help with."
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        {PRIORITY_OPTIONS.map((option) => (
          <Pressable key={option} onPress={() => setPriority(option)} style={[styles.chip, priority === option && styles.chipActive]}>
            <Text style={[styles.chipText, priority === option && styles.chipTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Send to a department (optional)</Text>
      <SearchableSelect
        label="Department"
        placeholder="No preference"
        value={departmentId ? String(departmentId) : null}
        options={departmentOptions}
        onChange={(value) => {
          const nextDepartmentId = value ? Number(value) : null;
          setDepartmentId(nextDepartmentId);
          setAssigneeId((current) => {
            const resolver = (resolvers ?? []).find((item) => item.id === current);
            return resolver?.department?.id === nextDepartmentId ? current : null;
          });
        }}
      />

      {resolverOptions.length > 0 ? (
        <>
          <Text style={styles.label}>Send to a specific person (optional)</Text>
          <SearchableSelect
            label="Assignee"
            placeholder="No preference"
            value={assigneeId ? String(assigneeId) : null}
            options={resolverOptions}
            onChange={(value) => setAssigneeId(value ? Number(value) : null)}
          />
        </>
      ) : null}

      <Pressable style={styles.secondaryButton} onPress={pickAttachment}>
        <Text style={styles.secondaryButtonText}>{attachment ? `Attached: ${attachment.name}` : 'Attach a photo or document (optional)'}</Text>
      </Pressable>

      <Pressable style={[styles.button, createTicket.isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={createTicket.isPending}>
        {createTicket.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Submit ticket</Text>}
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
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipText: { fontSize: 13, color: colors.ink, textTransform: 'capitalize' },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  secondaryButton: { marginTop: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.pine, fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
