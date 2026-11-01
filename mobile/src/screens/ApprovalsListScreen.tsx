import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { ProductIconField } from '../components/ProductIconField';
import { QueryError } from '../components/QueryError';
import { useApprovalRequests } from '../features/approvals/api';
import { formatSnakeCase, MODULE_PRESENTATION, statusTone } from '../features/approvals/presentation';
import { radius, spacing, useV2Colors, v2ModuleColors, V2_FONTS, type V2Colors } from '../theme';
import type { ApprovalsStackParamList } from '../navigation/ApprovalsStack';
import type { ApprovalRequest } from '../types/api';

type Props = NativeStackScreenProps<ApprovalsStackParamList, 'ApprovalsList'>;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'changes_requested', label: 'Changes' },
  { value: '', label: 'All' },
];

function ApprovalRow({ item, onPress, v2, styles }: { item: ApprovalRequest; onPress: () => void; v2: V2Colors; styles: ReturnType<typeof makeStyles> }) {
  const presentation = MODULE_PRESENTATION[item.module];
  const moduleColors = v2ModuleColors[presentation?.colorKey ?? ''];
  const tone = statusTone(item.status, v2);

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={item.title}>
      <View style={[styles.iconWrap, { backgroundColor: moduleColors?.bg ?? v2.chip }]}>
        <Ionicons name={presentation?.icon ?? 'briefcase-outline'} size={18} color={moduleColors?.icon ?? v2.muted} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.pillText, { color: tone.fg }]}>{formatSnakeCase(item.status)}</Text>
          </View>
        </View>
        <Text style={styles.caption} numberOfLines={1}>
          {formatSnakeCase(item.module)} · {formatSnakeCase(item.action)} · {item.requester?.name ?? 'System'}
        </Text>
      </View>
    </Pressable>
  );
}

export function ApprovalsListScreen({ navigation }: Props) {
  const v2 = useV2Colors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(v2), [v2]);
  const [status, setStatus] = useState('pending');
  const { items, isLoading, isError, error, refetch, isRefetching, fetchMore, isFetchingNextPage } = useApprovalRequests({ status: status || undefined });

  return (
    <View style={styles.flex}>
      <ProductIconField />
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.headerTitle}>Approvals</Text>
        <Text style={styles.headerSubtitle}>Decisions waiting on your review.</Text>
      </View>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => {
          const active = filter.value === status;
          return (
            <Pressable
              key={filter.value || 'all'}
              onPress={() => setStatus(filter.value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ApprovalRow item={item} onPress={() => navigation.navigate('ApprovalDetail', { approvalRequestId: item.id })} v2={v2} styles={styles} />
        )}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={isError ? <QueryError retry={refetch} error={error} /> : null}
        ListFooterComponent={<ListFooterLoader visible={isFetchingNextPage} />}
        ListEmptyComponent={
          isError ? null : isLoading ? (
            <ActivityIndicator color={v2.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <Text style={styles.empty}>{status === 'pending' ? 'Nothing waiting on your review.' : 'No approval requests here.'}</Text>
          )
        }
      />
    </View>
  );
}

const makeStyles = (v2: V2Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: v2.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, gap: 4 },
  headerTitle: { fontFamily: V2_FONTS.interBold, fontSize: 30, color: v2.ink, letterSpacing: -0.4 },
  headerSubtitle: { fontFamily: V2_FONTS.interRegular, fontSize: 13, color: v2.muted },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 3, borderRadius: radius.pill, borderWidth: 1, borderColor: v2.border, backgroundColor: v2.surface },
  chipActive: { backgroundColor: v2.primary, borderColor: v2.primary },
  chipText: { fontFamily: V2_FONTS.interSemiBold, fontSize: 12, color: v2.muted },
  chipTextActive: { color: v2.surface },
  list: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl * 3 },
  empty: { fontFamily: V2_FONTS.interRegular, fontSize: 13, color: v2.muted, textAlign: 'center', marginTop: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: v2.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: v2.border },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md - 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: V2_FONTS.interSemiBold, fontSize: 14.5, color: v2.ink },
  caption: { fontFamily: V2_FONTS.interRegular, fontSize: 12, color: v2.muted, marginTop: 3 },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 1, paddingVertical: 3, flexShrink: 0 },
  pillText: { fontFamily: V2_FONTS.interBold, fontSize: 10 },
});
