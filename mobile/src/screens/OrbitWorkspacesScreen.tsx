import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import { useOrbitWorkspaces, type OrbitWorkspaceSummary } from '../features/orbit/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { OrbitStackParamList } from '../navigation/OrbitStack';

type Props = NativeStackScreenProps<OrbitStackParamList, 'OrbitWorkspaces'>;

export function OrbitWorkspacesScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { data, isLoading, isError, error, refetch, isRefetching } = useOrbitWorkspaces();
  const workspaces = data?.data ?? [];

  return (
    <View style={styles.flex}>
      <ProductIconField />
      <FlatList
        data={workspaces}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }: { item: OrbitWorkspaceSummary }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('OrbitProjects', { workspaceId: item.id, workspaceName: item.name })}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.heading}>{item.name}</Text>
                {item.description ? <Text style={typography.caption}>{item.description}</Text> : null}
                <Text style={[typography.caption, styles.meta]}>
                  {item.projects_count ?? 0} project{item.projects_count === 1 ? '' : 's'}
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
            <Text style={[typography.caption, styles.empty]}>No workspaces yet.</Text>
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
  meta: { marginTop: spacing.xs },
});
