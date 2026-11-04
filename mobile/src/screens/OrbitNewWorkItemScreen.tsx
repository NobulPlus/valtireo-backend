import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingScreen } from '../components/KeyboardAvoidingScreen';
import { ProductIconField } from '../components/ProductIconField';
import { useCreateOrbitWorkItem } from '../features/orbit/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { OrbitStackParamList } from '../navigation/OrbitStack';

type Props = NativeStackScreenProps<OrbitStackParamList, 'OrbitNewWorkItem'>;

const TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'story', label: 'Story' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function OrbitNewWorkItemScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const createItem = useCreateOrbitWorkItem(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');

  async function handleSubmit() {
    if (!title.trim()) return;
    try {
      await createItem.mutateAsync({ type, title: title.trim(), priority, description: description.trim() || undefined });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not create item', err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <KeyboardAvoidingScreen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ProductIconField />

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {TYPES.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setType(option.value)}
            style={[styles.chip, type === option.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, type === option.value && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="What needs to be done?"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoFocus
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setPriority(option.value)}
            style={[styles.chip, priority === option.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, priority === option.value && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details…"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.inputMultiline]}
        multiline
      />

      <Pressable
        style={[styles.button, (!title.trim() || createItem.isPending) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!title.trim() || createItem.isPending}
      >
        <Text style={styles.buttonText}>{createItem.isPending ? 'Creating…' : 'Create item'}</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingScreen>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { ...typography.caption, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.pine },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.white },
  input: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, color: colors.ink },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  button: { marginTop: spacing.xl, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
