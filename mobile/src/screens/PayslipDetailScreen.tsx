import { useMemo, useState } from 'react';
import { QueryError } from '../components/QueryError';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMyPayslip, downloadMyPayslip } from '../features/payroll/api';
import { radius, spacing, useTheme, type ThemeColors, type Typography } from '../theme';
import type { PayslipsStackParamList } from '../navigation/PayslipsStack';

type Props = NativeStackScreenProps<PayslipsStackParamList, 'PayslipDetail'>;

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PayslipDetailScreen({ route }: Props) {
  const { colors, typography } = useTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { runItemId } = route.params;
  const { data: payslip, isLoading, isError, refetch } = useMyPayslip(runItemId);
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!payslip) return;
    setIsDownloading(true);
    try {
      await downloadMyPayslip(runItemId, payslip.payroll_run?.reference ?? String(runItemId));
    } catch {
      Alert.alert('Could not download', 'Something went wrong fetching your payslip.');
    } finally {
      setIsDownloading(false);
    }
  }

  if (isLoading) return <ActivityIndicator style={styles.flex} color={colors.pine} />;

  if (isError || !payslip) return <QueryError retry={refetch} />;

  const currency = payslip.payroll_run?.currency ?? 'NGN';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={typography.title}>{payslip.payroll_run?.name ?? payslip.payroll_run?.reference}</Text>
      <Text style={[typography.caption, { marginBottom: spacing.lg }]}>
        {payslip.payroll_run?.period_start} → {payslip.payroll_run?.period_end} · Paid {payslip.payroll_run?.payment_date}
      </Text>

      <View style={styles.summaryCard}>
        <SummaryRow label="Gross pay" value={formatMoney(payslip.gross_pay, currency)} typography={typography} styles={styles} />
        <SummaryRow label="Total deductions" value={formatMoney(payslip.total_deductions, currency)} typography={typography} styles={styles} />
        <View style={styles.divider} />
        <SummaryRow label="Net pay" value={formatMoney(payslip.net_pay, currency)} emphasize typography={typography} styles={styles} />
      </View>

      {payslip.lines && payslip.lines.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Breakdown</Text>
          {payslip.lines.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={typography.body}>{line.component_name}</Text>
              <Text style={[typography.body, line.type === 'deduction' && styles.deduction]}>
                {line.type === 'deduction' ? '− ' : ''}{formatMoney(line.amount, currency)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable style={[styles.button, isDownloading && styles.buttonDisabled]} onPress={handleDownload} disabled={isDownloading}>
        {isDownloading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Download payslip</Text>}
      </Pressable>
    </ScrollView>
  );
}

function SummaryRow({ label, value, emphasize, typography, styles }: { label: string; value: string; emphasize?: boolean; typography: Typography; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={typography.body}>{label}</Text>
      <Text style={emphasize ? styles.netValue : typography.body}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, typography: Typography) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  summaryCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  netValue: { fontSize: 18, fontWeight: '700', color: colors.pine },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.lg },
  sectionTitle: { ...typography.heading, marginBottom: spacing.sm },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  deduction: { color: colors.danger },
  button: { backgroundColor: colors.pine, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
