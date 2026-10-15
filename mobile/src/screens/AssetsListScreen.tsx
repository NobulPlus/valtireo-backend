import { useMemo } from 'react';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMyAssets } from '../features/assets/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AssetsStackParamList } from '../navigation/AssetsStack';
import type { Asset } from '../types/api';

type Props = NativeStackScreenProps<AssetsStackParamList, 'AssetsList'>;

export function AssetsListScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusColors: Record<string, string> = { assigned: colors.success, available: colors.pine, maintenance: colors.warning, retired: colors.muted };
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useMyAssets();

  function renderItem({ item }: { item: Asset }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={typography.heading}>{item.name}</Text>
          <Text style={[styles.status, { color: statusColors[item.status] ?? colors.muted }]}>{item.status}</Text>
        </View>
        <Text style={typography.caption}>
          {item.asset_tag}
          {item.category ? ` · ${item.category.name}` : ''}
        </Text>
        {item.condition ? <Text style={typography.caption}>Condition: {item.condition}</Text> : null}
        {item.status !== 'maintenance' ? (
          <Pressable onPress={() => navigation.navigate('ReportFault', { assetId: item.id, assetName: item.name })} style={{ marginTop: spacing.sm }}>
            <Text style={styles.link}>Report a fault</Text>
          </Pressable>
        ) : (
          <Text style={[typography.caption, { marginTop: spacing.sm }]}>Currently in maintenance.</Text>
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      renderItem={renderItem}
      refreshing={isRefetching}
      onRefresh={refetch}
      onEndReached={fetchMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={isError ? <QueryError retry={refetch} /> : null}
      ListFooterComponent={<ListFooterLoader visible={isFetchingNextPage} />}
      ListEmptyComponent={
        isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No equipment assigned to you yet.</Text>
      }
    />
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13 },
});
