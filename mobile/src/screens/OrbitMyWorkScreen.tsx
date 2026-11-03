import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import { useMyOrbitWork, type OrbitWorkItemSummary } from '../features/orbit/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { OrbitStackParamList } from '../navigation/OrbitStack';

type Props = NativeStackScreenProps<OrbitStackParamList, 'OrbitMyWork'>;

const FILTERS: { value: string; label: string }[] = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'watched', label: 'Watching' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_soon', label: 'Due soon' },
];

const PRIORITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export function OrbitMyWorkScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [filter, setFilter] = useState('assigned');
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyOrbitWork(filter);
  const items = data?.data ?? [];

  return (
    <View style={styles.flex}>
      <ProductIconField />

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === item.value && styles.filterChipTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }: { item: OrbitWorkItemSummary }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('OrbitWorkItemDetail', { itemKey: item.key })}>
            <Text style={typography.heading}>
              <Text style={styles.key}>{item.key} </Text>
              {item.title}
            </Text>
            <Text style={typography.caption}>{item.project?.name ?? ''}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.priority}>{PRIORITY_LABEL[item.priority] ?? item.priority}</Text>
              {item.due_at ? <Text style={typography.caption}>Due {item.due_at}</Text> : null}
            </View>
          </Pressable>
        )}
        ListHeaderComponent={isError ? <QueryError retry={refetch} error={error} /> : null}
        ListEmptyComponent={
          isError ? null : isLoading ? (
            <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />
          ) : (
            <Text style={[typography.caption, styles.empty]}>Nothing here.</Text>
          )
        }
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.chip },
  filterChipActive: { backgroundColor: colors.pine },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  filterChipTextActive: { color: colors.white },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  key: { color: colors.muted, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  priority: { fontSize: 12, fontWeight: '700', color: colors.pine, textTransform: 'uppercase' },
});
