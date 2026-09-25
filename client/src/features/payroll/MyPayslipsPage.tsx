import { useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { downloadPayslip, useMyPayslip, useMyPayslips } from '@/features/payroll/api';
import { useCurrencyFormatter } from '@/features/payroll/useCurrencyFormatter';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="max-w-[65%] text-right font-medium text-strong">{value ?? 'Not set'}</span>
    </div>
  );
}

function PayslipDetailModal({ runItemId, onClose }: { runItemId: number | null; onClose: () => void }) {
  const toast = useToast();
  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const payslipQuery = useMyPayslip(runItemId);
  const payslip = payslipQuery.data;
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!payslip) return;
    setIsDownloading(true);
    try {
      await downloadPayslip(payslip.id, payslip.employee_number);
    } catch (error) {
      toast.error('Could not download payslip', actionError(error, 'Could not download this payslip.'));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal
      open={runItemId !== null}
      onClose={onClose}
      title={payslip?.payroll_run ? `${payslip.payroll_run.name} · ${payslip.payroll_run.reference}` : 'Payslip'}
      size="lg"
      footer={
        <Button type="button" size="sm" variant="primary" isLoading={isDownloading} onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      }
    >
      {payslipQuery.isLoading && <LoadingState label="Loading payslip…" />}
      {payslip && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoRow label="Gross pay" value={formatCurrency(payslip.gross_pay, payslip.payroll_run?.currency)} />
            <InfoRow label="Deductions" value={formatCurrency(payslip.total_deductions, payslip.payroll_run?.currency)} />
            <InfoRow label="Net pay" value={formatCurrency(payslip.net_pay, payslip.payroll_run?.currency)} />
            <InfoRow label="Payment date" value={payslip.payroll_run ? formatDate(payslip.payroll_run.payment_date) : null} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Breakdown</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {(payslip.lines ?? []).map((line) => (
                <li key={line.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-strong">{line.component_name}</span>
                  <span className={line.type === 'deduction' ? 'font-medium text-danger' : 'font-medium text-strong'}>
                    {line.type === 'deduction' ? '-' : ''}
                    {formatCurrency(line.amount, payslip.payroll_run?.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function MyPayslipsPage() {
  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const payslipsQuery = useMyPayslips();
  const payslips = payslipsQuery.data?.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div>
      <PageHeader title="My payslips" subtitle="Published payslips from finalized payroll runs." />

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {payslipsQuery.isLoading && <LoadingState label="Loading payslips…" />}
          {payslipsQuery.isError && <ErrorState error={payslipsQuery.error} onRetry={() => payslipsQuery.refetch()} />}
          {payslipsQuery.data && payslips.length === 0 && (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No payslips yet"
              description="Payslips appear here once a payroll run has been finalized and published."
            />
          )}
          {payslips.length > 0 && (
            <ul className="divide-y divide-border">
              {payslips.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
                  <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 text-left">
                    <p className="font-medium text-strong">{item.payroll_run?.name ?? `Run #${item.payroll_run_id}`}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.payroll_run ? `${formatDate(item.payroll_run.period_start)} → ${formatDate(item.payroll_run.period_end)}` : ''}
                      {item.payroll_run?.payment_date ? ` · paid ${formatDate(item.payroll_run.payment_date)}` : ''}
                    </p>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="font-medium text-strong">{formatCurrency(item.net_pay, item.payroll_run?.currency)}</span>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedId(item.id)}>
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <PayslipDetailModal runItemId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
