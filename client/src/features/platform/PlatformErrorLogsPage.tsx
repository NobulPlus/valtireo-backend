import { useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Search, ServerCrash, ShieldAlert, TimerReset } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { Pagination } from '@/components/ui/Pagination';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { useResolveSystemErrorLog, useSystemErrorLogs, useSystemErrorLogSummary } from '@/features/platform/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { SystemErrorLog } from '@/types/api';

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

function compactException(value: string): string {
  return value.split('\\').pop() ?? value;
}

function ErrorDetailModal({
  error,
  onClose,
}: {
  error: SystemErrorLog | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { formatDateTime } = useDateFormatter();
  const resolveMutation = useResolveSystemErrorLog();
  const [note, setNote] = useState('');

  async function handleResolve() {
    if (!error) return;

    try {
      const result = await resolveMutation.mutateAsync({ id: error.id, note: note.trim() || undefined });
      toast.success('Error resolved', result.message);
      setNote('');
      onClose();
    } catch (resolveError) {
      toast.error('Could not resolve error', resolveError instanceof ApiError ? resolveError.message : 'Please try again.');
    }
  }

  return (
    <Modal
      open={error !== null}
      onClose={onClose}
      title={error ? compactException(error.exception_class) : 'Error detail'}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          {error && !error.is_resolved && (
            <ModalSaveAction title="Mark resolved" isLoading={resolveMutation.isPending} onClick={handleResolve} />
          )}
        </>
      }
    >
      {error && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-soft p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={error.is_resolved ? 'resolved' : 'open'} />
              <StatusBadge status={error.level} />
              {error.status_code && <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">HTTP {error.status_code}</span>}
            </div>
            <p className="mt-3 text-sm font-medium text-strong">{error.message}</p>
            <p className="mt-1 text-xs text-muted">
              {formatDateTime(error.created_at)} · {error.organization?.name ?? 'No organization'} · {error.user?.email ?? 'No user'}
            </p>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <InfoBlock label="Route" value={error.route ?? '-'} />
            <InfoBlock label="Method" value={error.method ?? '-'} />
            <InfoBlock label="File" value={error.file ? `${error.file}${error.line ? `:${error.line}` : ''}` : '-'} />
            <InfoBlock label="Fingerprint" value={error.fingerprint} mono />
            <div className="md:col-span-2">
              <InfoBlock label="URL" value={error.url ?? '-'} />
            </div>
          </div>

          {error.context && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Request context</p>
              <pre className="max-h-48 overflow-auto rounded-md border border-border bg-surface-soft p-3 text-xs text-strong">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}

          {error.trace_excerpt && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Trace excerpt</p>
              <pre className="max-h-48 overflow-auto rounded-md border border-border bg-surface-soft p-3 text-xs text-strong">
                {JSON.stringify(error.trace_excerpt, null, 2)}
              </pre>
            </div>
          )}

          {error.is_resolved ? (
            <div className="rounded-md border border-success/20 bg-success-bg px-3 py-2 text-sm">
              <p className="font-medium text-success">Resolved by {error.resolved_by?.name ?? 'a platform admin'}</p>
              <p className="mt-1 text-xs text-muted">
                {error.resolved_at ? formatDateTime(error.resolved_at) : ''}
                {error.resolution_note ? ` · ${error.resolution_note}` : ''}
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Resolution note</p>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for the team." />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function InfoBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-surface-soft px-3 py-2">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={mono ? 'mt-1 break-all font-mono text-xs text-strong' : 'mt-1 break-words text-sm font-medium text-strong'}>
        {value}
      </p>
    </div>
  );
}

export function PlatformErrorLogsPage() {
  const { formatDateTime } = useDateFormatter();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState<'open' | 'resolved' | ''>('open');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedError, setSelectedError] = useState<SystemErrorLog | null>(null);

  const summary = useSystemErrorLogSummary();
  const logs = useSystemErrorLogs({
    page,
    search,
    level,
    status,
    date_from: dateFrom,
    date_to: dateTo,
    per_page: 15,
  });

  const columns: Column<SystemErrorLog>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.is_resolved ? 'resolved' : 'open'} />,
    },
    {
      key: 'exception',
      header: 'Error',
      render: (row) => (
        <div className="max-w-lg">
          <p className="truncate font-medium text-strong">{compactException(row.exception_class)}</p>
          <p className="truncate text-xs text-muted">{row.message}</p>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Organization',
      render: (row) => row.organization?.name ?? '-',
    },
    {
      key: 'route',
      header: 'Route',
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {row.method ?? 'GET'} {row.route ?? '-'}
        </span>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      render: (row) => <StatusBadge status={row.level} />,
    },
    {
      key: 'created_at',
      header: 'Captured',
      render: (row) => formatDateTime(row.created_at),
    },
  ];

  const rows = logs.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Error logs"
        subtitle="Platform-only visibility into backend failures across Valtireo workspaces."
        breadcrumbs={[{ label: 'Platform console', to: '/platform' }, { label: 'Error logs' }]}
      />

      {summary.isLoading ? (
        <LoadingState label="Loading system health..." />
      ) : summary.isError || !summary.data ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open errors" value={summary.data.open} icon={ShieldAlert} tone={summary.data.open ? 'danger' : 'success'} />
          <StatTile label="Captured today" value={summary.data.today} icon={TimerReset} tone={summary.data.today ? 'warning' : 'default'} />
          <StatTile label="Resolved" value={summary.data.resolved} icon={CheckCircle2} tone="success" />
          <StatTile label="Total captured" value={summary.data.total} icon={ServerCrash} />
        </div>
      )}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>System incidents</CardTitle>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            title="Refresh"
            aria-label="Refresh"
            onClick={() => {
              summary.refetch();
              logs.refetch();
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardBody className="border-b border-border">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.7fr_0.7fr_1.2fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
                placeholder="Search message, class, route, URL..."
              />
            </div>
            <SelectMenu
              value={level}
              onChange={(value) => {
                setLevel(value);
                setPage(1);
              }}
              options={LEVEL_OPTIONS}
            />
            <SelectMenu
              value={status}
              onChange={(value) => {
                setStatus(value as 'open' | 'resolved' | '');
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(range) => {
                setDateFrom(range.dateFrom);
                setDateTo(range.dateTo);
                setPage(1);
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              title="Clear filters"
              aria-label="Clear filters"
              onClick={() => {
                setSearch('');
                setLevel('');
                setStatus('open');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardBody>

        {logs.isLoading ? (
          <LoadingState label="Loading error logs..." />
        ) : logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No errors found" description="The current filters have no captured incidents." />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} onRowClick={setSelectedError} />
            {logs.data && <Pagination meta={logs.data.meta} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <ErrorDetailModal error={selectedError} onClose={() => setSelectedError(null)} />
    </div>
  );
}
