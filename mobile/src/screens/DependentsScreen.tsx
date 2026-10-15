import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDeleteDependent, useMyProfileOverview } from '../features/profile/api';
import { ApiError } from '../lib/apiClient';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/HomeStack';
import type { Dependent } from '../types/api';

type Props = NativeStackScreenProps<HomeStackParamList, 'Dependents'>;

function DependentCard({ dependent, colors, styles, onEdit }: { dependent: Dependent; colors: ThemeColors; styles: ReturnType<typeof makeStyles>; onEdit: () => void }) {
  const deleteDependent = useDeleteDependent();

  function handleDelete() {
    Alert.alert('Remove this dependent?', dependent.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDependent.mutateAsync(dependent.id);
          } catch (err) {
            Alert.alert('Could not remove dependent', err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{dependent.name}</Text>
          <Text style={styles.caption}>{dependent.relationship}</Text>
        </View>
        {dependent.is_beneficiary ? (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>Beneficiary</Text>
          </View>
        ) : null}
        <Pressable onPress={onEdit} accessibilityLabel="Edit dependent" style={styles.iconButton}>
          <Ionicons name="pencil-outline" size={18} color={colors.pine} />
        </Pressable>
        <Pressable onPress={handleDelete} disabled={deleteDependent.isPending} accessibilityLabel="Remove dependent" style={styles.iconButton}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
      {dependent.date_of_birth ? <Text style={styles.caption}>Born {dependent.date_of_birth}</Text> : null}
      {dependent.phone ? <Text style={styles.caption}>{dependent.phone}</Text> : null}
      {dependent.email ? <Text style={styles.caption}>{dependent.email}</Text> : null}
      {dependent.address ? <Text style={styles.caption}>{dependent.address}</Text> : null}
    </View>
  );
}

export function DependentsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading } = useMyProfileOverview();
  const dependents = data?.dependents ?? [];

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {!isLoading && dependents.length === 0 ? (
          <Text style={styles.caption}>No dependents on file yet.</Text>
        ) : (
          dependents.map((dependent) => (
            <DependentCard key={dependent.id} dependent={dependent} colors={colors} styles={styles} onEdit={() => navigation.navigate('DependentForm', { dependent })} />
          ))
        )}
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => navigation.navigate('DependentForm', {})}>
        <Text style={styles.fabText}>+ Add dependent</Text>
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
