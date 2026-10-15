import { useMemo } from 'react';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMyAttendanceRecords } from '../features/attendance/api';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AttendanceStackParamList } from '../navigation/AttendanceStack';
import type { AttendanceRecord } from '../types/api';

type Props = NativeStackScreenProps<AttendanceStackParamList, 'AttendanceList'>;

export function AttendanceListScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusColors: Record<string, string> = { present: colors.success, late: colors.warning, absent: colors.danger };
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useMyAttendanceRecords();

  function renderItem({ item }: { item: AttendanceRecord }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={typography.heading}>{item.attendance_date}</Text>
          <Text style={[styles.status, { color: statusColors[item.status] ?? colors.muted }]}>{item.status}</Text>
        </View>
        <Text style={typography.body}>
          {item.check_in_at ? new Date(item.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          {' → '}
          {item.check_out_at ? new Date(item.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </Text>
        <Pressable onPress={() => navigation.navigate('RequestCorrection', { record: item })}>
          <Text style={styles.link}>Request correction</Text>
        </Pressable>
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
        isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No attendance records yet.</Text>
      }
    />
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  link: { color: colors.pine, fontWeight: '600', fontSize: 13, marginTop: spacing.sm },
});
