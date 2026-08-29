import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction } from '@/components/ui/ModalActions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import type { ActivityFeedEntry, AuditLogEntry } from '@/types/api';
import { useActivityFeed, useAuditLogs } from '@/features/audit/api';

type Tab = 'activity' | 'audit';

const TAB_LABELS: Record<Tab, string> = {
  activity: 'Activity feed',
  audit: 'Audit log',
};

function prettify(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface FilterProps {
  event: string;
  dateFrom: string;
  dateTo: string;
}

function AuditDetailModal({ entry, onClose }: { entry: AuditLogEntry; onClose: () => void }) {
  const { formatDateTime } = useDateFormatter();
  const keys = Array.from(new Set([...Object.keys(entry.old_values), ...Object.keys(entry.new_values)])).sort();

  return (
    <Modal
      open
      onClose={onClose}
      title={`${prettify(entry.event)} — ${prettify(entry.auditable_type)} #${entry.auditable_id}`}
      size="lg"
      footer={<ModalCancelAction onClick={onClose} title="Close" />}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{entry.user ? `${entry.user.name} (${entry.user.email})` : 'System'}</span>
          <span>·</span>
          <span>{formatDateTime(entry.created_at)}</span>
          {entry.ip_address && (
            <>
              <span>·</span>
              <span>{entry.ip_address}</span>
            </>
          )}
        </div>

        {keys.length === 0 ? (
          <p className="text-sm text-muted">No field-level changes recorded for this event.</p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 text-left">Field</th>
                  <th className="px-3 py-2 text-left">Before</th>
                  <th className="px-3 py-2 text-left">After</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-medium text-strong">{key}</td>
                    <td className="px-3 py-2 text-muted">{formatValue(entry.old_values[key])}</td>
                    <td className="px-3 py-2 text-strong">{formatValue(entry.new_values[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function auditColumns(formatDateTime: (value: string) => string): Column<AuditLogEntry>[] {
  return [
    { key: 'event', header: 'Event', render: (row) => <StatusBadge status={row.event} /> },
    {
      key: 'record',
      header: 'Record',
      render: (row) => `${prettify(row.auditable_type)} #${row.auditable_id}`,
    },
    { key: 'user', header: 'Changed by', render: (row) => row.user?.name ?? 'System' },
    {
      key: 'changes',
      header: 'Changes',
      render: (row) => {
        const count = Object.keys(row.new_values).length || Object.keys(row.old_values).length;
        return count > 0 ? `${count} field${count === 1 ? '' : 's'}` : '—';
      },
    },
    { key: 'date', header: 'Date', render: (row) => formatDateTime(row.created_at) },
  ];
}

function AuditLogTable({ event, dateFrom, dateTo }: FilterProps) {
  const { formatDateTime } = useDateFormatter();
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    setPage(1);
  }, [event, dateFrom, dateTo]);

  const query = useAuditLogs({ event, date_from: dateFrom, date_to: dateTo, page });

  if (query.isLoading) return <LoadingState label="Loading audit log..." fill />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const entries = query.data?.data ?? [];

  if (entries.length === 0) {
    return <EmptyState title="No audit entries found" description="Try widening your filters." />;
  }

  return (
    <>
      <DataTable columns={auditColumns(formatDateTime)} rows={entries} rowKey={(row) => row.id} onRowClick={setDetail} />
      {query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
      {detail && <AuditDetailModal entry={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function activityColumns(formatDateTime: (value: string) => string): Column<ActivityFeedEntry>[] {
  return [
    {
      key: 'title',
      header: 'Activity',
      render: (row) => (
        <div>
          <p className="font-medium text-strong">{row.title}</p>
          {row.description && <p className="text-xs text-muted">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div>
          <p className="text-strong">{row.employee.full_name}</p>
          <p className="text-xs text-muted">{row.employee.employee_number}</p>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => row.employee.department?.name ?? '—' },
    { key: 'actor', header: 'By', render: (row) => row.actor?.name ?? 'System' },
    { key: 'date', header: 'Date', render: (row) => formatDateTime(row.created_at) },
  ];
}

function ActivityFeedTable({ event, dateFrom, dateTo }: FilterProps) {
  const { formatDateTime } = useDateFormatter();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [event, dateFrom, dateTo]);

  const query = useActivityFeed({ event, date_from: dateFrom, date_to: dateTo, page });

  if (query.isLoading) return <LoadingState label="Loading activity feed..." fill />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const entries = query.data?.data ?? [];

  if (entries.length === 0) {
    return <EmptyState title="No activity found" description="Try widening your filters." />;
  }

  return (
    <>
      <DataTable columns={activityColumns(formatDateTime)} rows={entries} rowKey={(row) => row.id} />
      {query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
    </>
  );
}

function AuditActivityContent() {
  const [tab, setTab] = useState<Tab>('activity');
  const [event, setEvent] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1 border-b border-border">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={cn(
              'border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors',
              tab === tabKey ? 'border-pine text-pine' : 'border-transparent text-muted hover:text-strong',
            )}
          >
            {TAB_LABELS[tabKey]}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={event}
              onChange={(changeEvent) => setEvent(changeEvent.target.value)}
              placeholder="Filter by event…"
              className="pl-9"
            />
          </div>
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(range) => {
              setDateFrom(range.dateFrom);
              setDateTo(range.dateTo);
            }}
            className="lg:w-auto"
          />
        </div>

        {tab === 'activity' ? (
          <ActivityFeedTable event={event} dateFrom={dateFrom} dateTo={dateTo} />
        ) : (
          <AuditLogTable event={event} dateFrom={dateFrom} dateTo={dateTo} />
        )}
      </Card>
    </div>
  );
}

export function AuditActivityPage() {
  return (
    <div>
      <PageHeader
        title="Audit & activity"
        subtitle="Every change and workflow event recorded across this organization."
      />
      <RequirePermission permission="audit_logs.view">
        <AuditActivityContent />
      </RequirePermission>
    </div>
  );
}
