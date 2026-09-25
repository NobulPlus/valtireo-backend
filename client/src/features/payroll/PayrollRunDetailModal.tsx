import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Receipt } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction } from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import {
  downloadPaymentBatch,
  downloadPayslip,
  useCalculatePayrollRun,
  useFinalizePayrollRun,
  useGenerateJournal,
  usePaymentExport,
  useMarkPaymentBatchPaid,
  usePayrollReadiness,
  usePayrollRun,
  usePublishPayrollRun,
  useSubmitPayrollRun,
  useVoidPayrollRun,
} from '@/features/payroll/api';
import { useCurrencyFormatter } from '@/features/payroll/useCurrencyFormatter';
import { useDateFormatter } from '@/lib/dateFormat';
import { api, ApiError } from '@/lib/apiClient';
import type { PayrollPaymentBatch, PayrollRunItem } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function PayrollRunDetailModal({ runId, onClose }: { runId: number | null; onClose: () => void }) {
  const toast = useToast();
  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const { hasPermission } = useAuth();

  const runQuery = usePayrollRun(runId);
  const readinessQuery = usePayrollReadiness(runId);
  const run = runQuery.data;

  const calculateMutation = useCalculatePayrollRun(runId ?? 0);
  const submitMutation = useSubmitPayrollRun(runId ?? 0);
  const finalizeMutation = useFinalizePayrollRun(runId ?? 0);
  const publishMutation = usePublishPayrollRun(runId ?? 0);
  const voidMutation = useVoidPayrollRun(runId ?? 0);
  const paymentExportMutation = usePaymentExport(runId ?? 0);
  const journalMutation = useGenerateJournal(runId ?? 0);
  const markPaidMutation = useMarkPaymentBatchPaid(runId ?? 0);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [downloadingItemId, setDownloadingItemId] = useState<number | null>(null);
  const [showOnlyExceptions, setShowOnlyExceptions] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState<PayrollPaymentBatch | null>(null);

  const canManage = hasPermission('payroll.runs.manage');
  const canSubmit = hasPermission('payroll.runs.submit');
  const canFinalize = hasPermission('payroll.runs.finalize');

  const items = run?.items ?? [];
  const exceptionCount = items.filter((item) => item.status === 'exception').length;
  const hasExceptions = exceptionCount > 0;
  const visibleItems = showOnlyExceptions ? items.filter((item) => item.status === 'exception') : items;
  const isFinalized = run?.status === 'finalized';

  async function handleCalculate() {
    try {
      await calculateMutation.mutateAsync();
      toast.success('Payroll calculated');
    } catch (error) {
      toast.error('Could not calculate', actionError(error, 'Could not calculate this payroll run.'));
    }
  }

  async function handleSubmit() {
    try {
      await submitMutation.mutateAsync();
      toast.success('Submitted for approval');
    } catch (error) {
      toast.error('Could not submit', actionError(error, 'Could not submit this payroll run.'));
    }
  }

  async function handleFinalize() {
    try {
      await finalizeMutation.mutateAsync();
      toast.success('Payroll finalized');
    } catch (error) {
      toast.error('Could not finalize', actionError(error, 'Could not finalize this payroll run.'));
    }
  }

  async function handlePublish() {
    try {
      await publishMutation.mutateAsync();
      toast.success('Payslips published');
    } catch (error) {
      toast.error('Could not publish', actionError(error, 'Could not publish this payroll run.'));
    }
  }

  async function handleVoid() {
    if (!voidReason.trim()) return;
    try {
      await voidMutation.mutateAsync(voidReason.trim());
      toast.success('Payroll run voided');
      setVoidOpen(false);
      setVoidReason('');
    } catch (error) {
      toast.error('Could not void run', actionError(error, 'Could not void this payroll run.'));
    }
  }

  async function handlePaymentExport() {
    try {
      const result = await paymentExportMutation.mutateAsync();
      setPaymentBatch(result.payment_batch);
      await downloadPaymentBatch(result.payment_batch.id, `${run?.reference ?? 'payroll'}-payment.csv`);
      toast.success('Payment export ready');
    } catch (error) {
      toast.error('Could not export payment batch', actionError(error, 'Could not export the payment batch.'));
    }
  }

  async function handleMarkPaid() {
    if (!paymentBatch) return;
    try {
      const result = await markPaidMutation.mutateAsync(paymentBatch.id);
      setPaymentBatch(result.payment_batch);
      toast.success('Payment batch marked as paid');
    } catch (error) {
      toast.error('Could not settle payment batch', actionError(error, 'Could not mark this payment batch as paid.'));
    }
  }

  async function handleJournal() {
    try {
      await journalMutation.mutateAsync();
      toast.success('Journal generated');
    } catch (error) {
      toast.error('Could not generate journal', actionError(error, 'Could not generate the journal.'));
    }
  }

  async function handleDownloadPayslip(item: PayrollRunItem) {
    setDownloadingItemId(item.id);
    try {
      await api.post(`/payroll/run-items/${item.id}/payslip`);
      await downloadPayslip(item.id, item.employee_number);
    } catch (error) {
      toast.error('Could not download payslip', actionError(error, 'Could not download this payslip.'));
    } finally {
      setDownloadingItemId(null);
    }
  }

  return (
    <>
      <Modal open={runId !== null} onClose={onClose} title={run ? `${run.name} · ${run.reference}` : 'Payroll run'} size="lg" footer={<ModalCancelAction onClick={onClose} title="Close" />}>
        {runQuery.isLoading && <LoadingState label="Loading run…" />}
        {run && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <StatusBadge status={run.status} />
                <p className="mt-1 text-xs text-muted">
                  {formatDate(run.period_start)} → {formatDate(run.period_end)} · pays {formatDate(run.payment_date)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(run.status === 'draft' || run.status === 'calculated' || run.status === 'rejected') && canManage && (
                  <Button type="button" size="sm" isLoading={calculateMutation.isPending} onClick={handleCalculate}>
                    {run.status === 'draft' ? 'Calculate' : 'Recalculate'}
                  </Button>
                )}
                {run.status === 'calculated' && canSubmit && (
                  <Button type="button" size="sm" variant="primary" isLoading={submitMutation.isPending} disabled={hasExceptions} onClick={handleSubmit}>
                    Submit for approval
                  </Button>
                )}
                {run.status === 'approved' && canFinalize && (
                  <Button type="button" size="sm" variant="primary" isLoading={finalizeMutation.isPending} onClick={handleFinalize}>
                    Finalize
                  </Button>
                )}
                {run.status === 'finalized' && !run.published_at && canFinalize && (
                  <Button type="button" size="sm" variant="primary" isLoading={publishMutation.isPending} onClick={handlePublish}>
                    Publish payslips
                  </Button>
                )}
                {(run.status === 'approved' || run.status === 'finalized') && canManage && (
                  <Button type="button" size="sm" variant="danger" onClick={() => setVoidOpen(true)}>
                    Void
                  </Button>
                )}
              </div>
            </div>

            {run.status === 'pending_approval' && (
              <div className="flex items-start gap-2 rounded-md border border-warning-bg bg-warning-bg/40 px-3.5 py-3 text-sm text-strong">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                <p>This run is awaiting approval. Approve or reject it from the Approvals page.</p>
              </div>
            )}

            {run.status === 'voided' && run.void_reason && (
              <div className="rounded-md border border-danger-bg bg-danger-bg/40 px-3.5 py-3 text-sm text-strong">
                <span className="font-medium">Void reason: </span>
                {run.void_reason}
              </div>
            )}

            {readinessQuery.data && !readinessQuery.data.ready && ['draft', 'calculated', 'rejected'].includes(run.status) && (
              <div className="rounded-md border border-warning-bg bg-warning-bg/40 px-3.5 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-strong"><AlertTriangle className="h-4 w-4 text-warning" /> Payroll readiness needs attention</div>
                <p className="mt-1 text-xs text-muted">{readinessQuery.data.issue_count} employee record{readinessQuery.data.issue_count === 1 ? '' : 's'} must be completed before payment.</p>
                <ul className="mt-2 space-y-1">
                  {readinessQuery.data.issues.slice(0, 5).map((issue) => <li key={issue.employee_id} className="flex items-center justify-between gap-3 text-xs"><span>{issue.employee_name} · {issue.issues.map((value) => value.replaceAll('_', ' ')).join(', ')}</span><a href={`/employees/${issue.employee_id}`} target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">Fix</a></li>)}
                </ul>
              </div>
            )}
            {readinessQuery.data?.ready && run.status === 'draft' && <div className="flex items-center gap-2 rounded-md border border-success-bg bg-success-bg/40 px-3.5 py-3 text-sm text-strong"><CheckCircle2 className="h-4 w-4 text-success" /> Payroll records are ready for calculation.</div>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label="Employees" value={run.employee_count} />
              <StatTile label="Gross" value={formatCurrency(run.total_gross, run.currency)} />
              <StatTile label="Deductions" value={formatCurrency(run.total_deductions, run.currency)} />
              <StatTile label="Net" value={formatCurrency(run.total_net, run.currency)} tone="success" />
              <StatTile label="Employer cost" value={formatCurrency(run.total_employer_contributions, run.currency)} />
            </div>

            {isFinalized && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" isLoading={paymentExportMutation.isPending} onClick={handlePaymentExport}>
                  <Download className="h-3.5 w-3.5" /> Payment export
                </Button>
                {paymentBatch?.status === 'generated' && <Button type="button" size="sm" variant="primary" isLoading={markPaidMutation.isPending} onClick={handleMarkPaid}><CheckCircle2 className="h-3.5 w-3.5" /> Mark paid</Button>}
                {paymentBatch?.status === 'paid' && <StatusBadge status="paid" />}
                <Button type="button" size="sm" variant="secondary" isLoading={journalMutation.isPending} onClick={handleJournal}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Generate journal
                </Button>
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Employees ({items.length})
                  {exceptionCount > 0 && (
                    <span className="ml-2 rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-semibold normal-case text-danger">
                      {exceptionCount} exception{exceptionCount === 1 ? '' : 's'}
                    </span>
                  )}
                </p>
                {exceptionCount > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={showOnlyExceptions}
                      onChange={(e) => setShowOnlyExceptions(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    Only show exceptions
                  </label>
                )}
              </div>
              {items.length === 0 && <p className="text-sm text-muted">Run this payroll's calculation to see per-employee results.</p>}
              {items.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {visibleItems.map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-strong">
                          {item.employee_name} <span className="text-xs font-normal text-muted">· {item.employee_number}</span>
                        </p>
                        {item.status === 'exception' && item.exceptions && item.exceptions.length > 0 && (
                          <p className="mt-0.5 text-xs text-danger">
                            {item.exceptions.map((e) => e.message).join('; ')}{' '}
                            <a href={`/employees/${item.employee_id}`} target="_blank" rel="noreferrer" className="underline hover:text-danger/80">
                              Fix →
                            </a>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-3">
                        <span className="font-medium text-strong">{formatCurrency(item.net_pay, run.currency)}</span>
                        <StatusBadge status={item.status} />
                        {isFinalized && item.status !== 'exception' && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Download payslip"
                            aria-label="Download payslip"
                            isLoading={downloadingItemId === item.id}
                            onClick={() => handleDownloadPayslip(item)}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Void payroll run"
        footer={
          <>
            <ModalCancelAction onClick={() => setVoidOpen(false)} />
            <Button type="button" size="sm" variant="danger" disabled={!voidReason.trim()} isLoading={voidMutation.isPending} onClick={handleVoid}>
              Void run
            </Button>
          </>
        }
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="Why is this run being voided?" />
        </label>
      </Modal>
    </>
  );
}
