import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDeleteEmergencyContact, useMyProfileOverview } from '../features/profile/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { EmergencyContact } from '../types/api';

type Props = NativeStackScreenProps<HomeStackParamList, 'EmergencyContacts'>;

function ContactCard({ contact, colors, styles, onEdit }: { contact: EmergencyContact; colors: ThemeColors; styles: ReturnType<typeof makeStyles>; onEdit: () => void }) {
  const deleteContact = useDeleteEmergencyContact();

  function handleDelete() {
    Alert.alert('Remove this contact?', contact.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact.mutateAsync(contact.id);
          } catch (err) {
            Alert.alert('Could not remove contact', err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{contact.name}</Text>
          {contact.relationship ? <Text style={styles.caption}>{contact.relationship}</Text> : null}
        </View>
        {contact.is_primary ? (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>Primary</Text>
          </View>
        ) : null}
        <Pressable onPress={onEdit} accessibilityLabel="Edit contact" style={styles.iconButton}>
          <Ionicons name="pencil-outline" size={18} color={colors.pine} />
        </Pressable>
        <Pressable onPress={handleDelete} disabled={deleteContact.isPending} accessibilityLabel="Remove contact" style={styles.iconButton}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
      <Text style={styles.caption}>{contact.phone}</Text>
      {contact.alternate_phone ? <Text style={styles.caption}>{contact.alternate_phone}</Text> : null}
      {contact.email ? <Text style={styles.caption}>{contact.email}</Text> : null}
      {contact.address ? <Text style={styles.caption}>{contact.address}</Text> : null}
    </View>
  );
}

export function EmergencyContactsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading } = useMyProfileOverview();
  const contacts = data?.emergency_contacts ?? [];

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {!isLoading && contacts.length === 0 ? (
          <Text style={styles.caption}>No emergency contacts yet. Add someone we can reach on your behalf.</Text>
        ) : (
          contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} colors={colors} styles={styles} onEdit={() => navigation.navigate('EmergencyContactForm', { contact })} />
          ))
        )}
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => navigation.navigate('EmergencyContactForm', {})}>
        <Text style={styles.fabText}>+ Add contact</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  caption: { fontSize: 12, color: colors.muted, marginTop: 2 },
  iconButton: { padding: spacing.xs },
  primaryBadge: { backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: colors.pineDark, textTransform: 'uppercase' },
  fab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  fabText: { color: colors.white, fontWeight: '700' },
});
