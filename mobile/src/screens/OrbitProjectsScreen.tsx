import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import { useOrbitProjects, type OrbitProjectSummary } from '../features/orbit/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { OrbitStackParamList } from '../navigation/OrbitStack';

type Props = NativeStackScreenProps<OrbitStackParamList, 'OrbitProjects'>;

export function OrbitProjectsScreen({ route, navigation }: Props) {
  const { workspaceId, workspaceName } = route.params;
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { data, isLoading, isError, error, refetch, isRefetching } = useOrbitProjects(workspaceId);
  const projects = data?.data ?? [];

  return (
    <View style={styles.flex}>
      <ProductIconField />
      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }: { item: OrbitProjectSummary }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('OrbitProjectBoard', { projectId: item.id, projectName: item.name })}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.heading}>
                  <Text style={styles.prefix}>{item.key_prefix} </Text>
                  {item.name}
                </Text>
                <Text style={[typography.caption, styles.meta]}>
                  {item.work_items_count ?? 0} item{item.work_items_count === 1 ? '' : 's'}
                  {item.overdue_count ? ` · ${item.overdue_count} overdue` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
        )}
        ListHeaderComponent={isError ? <QueryError retry={refetch} error={error} /> : null}
        ListEmptyComponent={
          isError ? null : isLoading ? (
            <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />
          ) : (
            <Text style={[typography.caption, styles.empty]}>No projects in {workspaceName} yet.</Text>
          )
        }
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prefix: { color: colors.muted, fontWeight: '700' },
  meta: { marginTop: spacing.xs },
});
