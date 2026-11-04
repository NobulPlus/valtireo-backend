import { useMemo } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import { useOrbitProject, useOrbitWorkItems, type OrbitWorkItemSummaryForBoard } from '../features/orbit/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { OrbitStackParamList } from '../navigation/OrbitStack';

type Props = NativeStackScreenProps<OrbitStackParamList, 'OrbitProjectBoard'>;

const PRIORITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export function OrbitProjectBoardScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { data: projectData } = useOrbitProject(projectId);
  const { data, isLoading, isError, error, refetch, isRefetching } = useOrbitWorkItems(projectId);

  const project = projectData?.project;
  const items = data?.data ?? [];
  const canCreate = Boolean(project?.can_edit_work_items);

  const sections = useMemo(() => {
    const statuses = project?.statuses ?? [];
    return statuses
      .map((status) => ({ title: status.name, statusId: status.id, data: items.filter((item) => item.status_id === status.id) }))
      .filter((section) => section.data.length > 0 || statuses.length <= 1);
  }, [project, items]);

  return (
    <View style={styles.flex}>
      <ProductIconField />
      {canCreate && (
        <Pressable
          style={styles.newItemButton}
          onPress={() => navigation.navigate('OrbitNewWorkItem', { projectId, projectName: project?.name ?? route.params.projectName })}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newItemButtonText}>New item</Text>
        </Pressable>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title} · {section.data.length}</Text>}
        renderItem={({ item }: { item: OrbitWorkItemSummaryForBoard }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('OrbitWorkItemDetail', { itemKey: item.key })}>
            <Text style={typography.heading}>
              <Text style={styles.key}>{item.key} </Text>
              {item.title}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.priority}>{PRIORITY_LABEL[item.priority] ?? item.priority}</Text>
              {item.assignee ? <Text style={typography.caption}>{item.assignee.name}</Text> : null}
              {item.due_at ? <Text style={typography.caption}>Due {item.due_at}</Text> : null}
            </View>
          </Pressable>
        )}
        ListHeaderComponent={isError ? <QueryError retry={refetch} error={error} /> : null}
        ListEmptyComponent={
          isError ? null : isLoading ? (
            <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} />
          ) : (
            <Text style={[typography.caption, styles.empty]}>No work items yet.</Text>
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
  sectionHeader: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.line },
  key: { color: colors.muted, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, gap: spacing.sm },
  priority: { fontSize: 12, fontWeight: '700', color: colors.pine, textTransform: 'uppercase' },
  newItemButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.pine,
    borderRadius: radius.sm, paddingVertical: spacing.sm,
  },
  newItemButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
