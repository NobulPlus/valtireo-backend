import { useMemo } from 'react';
import { ListFooterLoader } from '../components/ListFooterLoader';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMyPayslips } from '../features/payroll/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { PayslipsStackParamList } from '../navigation/PayslipsStack';
import type { PayrollRunItem } from '../types/api';

type Props = NativeStackScreenProps<PayslipsStackParamList, 'PayslipsList'>;

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PayslipsListScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { items, isLoading, isError, refetch, isRefetching, fetchMore, isFetchingNextPage } = useMyPayslips();

  function renderItem({ item }: { item: PayrollRunItem }) {
    const currency = item.payroll_run?.currency ?? 'NGN';
    return (
      <Pressable style={styles.card} onPress={() => navigation.navigate('PayslipDetail', { runItemId: item.id })}>
        <Text style={typography.heading}>{item.payroll_run?.name ?? item.payroll_run?.reference ?? 'Payslip'}</Text>
        <Text style={typography.caption}>{item.payroll_run?.period_start} → {item.payroll_run?.period_end}</Text>
        <Text style={styles.net}>{formatMoney(item.net_pay, currency)}</Text>
      </Pressable>
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
        isError ? null : isLoading ? <ActivityIndicator color={colors.pine} style={{ marginTop: spacing.xl }} /> : <Text style={[typography.caption, styles.empty]}>No payslips published yet.</Text>
      }
    />
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  list: { padding: spacing.lg },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  net: { ...typography.title, fontSize: 18, color: colors.pine, marginTop: spacing.xs },
});
