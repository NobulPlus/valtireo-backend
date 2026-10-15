import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchableSelect } from '../components/SearchableSelect';
import { useAppreciationRecipients, useSendAppreciation } from '../features/lifestyle/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { LifestyleStackParamList } from '../navigation/LifestyleStack';

type Props = NativeStackScreenProps<LifestyleStackParamList, 'SendAppreciation'>;

export function SendAppreciationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('');
  const [recipientCanShare, setRecipientCanShare] = useState(false);
  const recipientsQuery = useAppreciationRecipients(search);
  const sendAppreciation = useSendAppreciation();

  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');

  const recipients = recipientsQuery.items;
  const recipientOptions = recipients.map((recipient) => ({ value: String(recipient.id), label: recipient.name }));
  const canShare = recipientCanShare;

  async function handleSubmit() {
    if (!recipientId) return Alert.alert('Pick someone', 'Choose who this is for.');
    if (!message.trim()) return Alert.alert('Write a message', 'Say what you want to thank them for.');

    try {
      await sendAppreciation.mutateAsync({ recipient_employee_id: recipientId, message: message.trim(), visibility: canShare ? visibility : 'private' });
      Alert.alert('Sent', 'Your appreciation has been sent.');
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        Alert.alert('Could not send', Object.values(err.errors).flat().join('\n'));
      } else {
        Alert.alert('Could not send', err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
    <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      <Text style={styles.label}>Who is this for?</Text>
      <SearchableSelect
        label="Colleague"
        placeholder="Choose a colleague"
        value={recipientId ? String(recipientId) : null}
        options={recipientOptions}
        allowClear={false}
        selectedLabel={recipientLabel}
        onSearch={setSearch}
        onEndReached={recipientsQuery.fetchMore}
        isFetchingMore={recipientsQuery.isFetchingNextPage}
        loading={recipientsQuery.isLoading}
        error={recipientsQuery.isError}
        onRetry={() => void recipientsQuery.refetch()}
        onChange={(value) => {
          const recipient = recipients.find((item) => item.id === Number(value));
          setRecipientId(recipient?.id ?? null);
          setRecipientLabel(recipient?.name ?? '');
          setRecipientCanShare(recipient?.allow_shared_appreciation ?? false);
          setVisibility('private');
        }}
      />
      {recipientOptions.length === 0 ? (
        <Text style={[styles.caption, { marginTop: spacing.sm }]}>No colleagues have opted in to receive appreciation yet.</Text>
      ) : null}

      <Text style={styles.label}>Message</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        style={[styles.input, styles.inputMultiline]}
        multiline
        maxLength={1000}
        placeholder="Thank you for..."
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.chipRow}>
        <Pressable onPress={() => setVisibility('private')} style={[styles.chip, visibility === 'private' && styles.chipActive]}>
          <Text style={[styles.chipText, visibility === 'private' && styles.chipTextActive]}>Private — just them</Text>
        </Pressable>
        <Pressable
          onPress={() => canShare && setVisibility('shared')}
          style={[styles.chip, visibility === 'shared' && styles.chipActive, !canShare && styles.chipDisabled]}
        >
          <Text style={[styles.chipText, visibility === 'shared' && styles.chipTextActive]}>Shared — visible to the team</Text>
        </Pressable>
      </View>
      {recipientId && !canShare ? <Text style={styles.caption}>This colleague hasn&apos;t opted in to shared appreciation, so this will stay private.</Text> : null}

      <Pressable style={[styles.button, sendAppreciation.isPending && styles.buttonDisabled]} onPress={handleSubmit} disabled={sendAppreciation.isPending}>
        {sendAppreciation.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send appreciation</Text>}
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  caption: { fontSize: 12, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 14, color: colors.ink, backgroundColor: colors.white },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.lime, borderColor: colors.limeDeep },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.pineDark, fontWeight: '700' },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
