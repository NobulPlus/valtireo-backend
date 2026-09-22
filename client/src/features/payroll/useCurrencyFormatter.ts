import { useCallback, useMemo } from 'react';
import { usePayrollSettings } from '@/features/payroll/api';

export function useCurrencyFormatter() {
  const settingsQuery = usePayrollSettings();
  const defaultCurrency = settingsQuery.data?.currency ?? 'NGN';

  const formatCurrency = useCallback(
    (value: string | number | null | undefined, currency?: string) => {
      const amount = typeof value === 'string' ? Number(value) : value;
      if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
      try {
        return new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: currency ?? defaultCurrency,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${currency ?? defaultCurrency} ${amount.toFixed(2)}`;
      }
    },
    [defaultCurrency],
  );

  return useMemo(() => ({ formatCurrency, defaultCurrency }), [formatCurrency, defaultCurrency]);
}
