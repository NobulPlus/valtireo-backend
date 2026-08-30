import { useState } from 'react';
import { Layers, ListChecks, Search, Smile, TimerReset, TriangleAlert, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { DonutChart, MultiLineTrendChart, RankedBarList } from '@/components/ui/Charts';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { TicketCategoriesPanel } from '@/features/settings/SetupDataPages';
import { TicketDetailModal } from '@/features/tickets/TicketDetailModal';
import { slaStatus, useTicketCategories, useTicketQueue, useTicketReporting, useTicketResolvers, type TicketQueueFilters } from '@/features/tickets/api';
import { useSetupLookups } from '@/features/workspace/api';
import { useDateFormatter } from '@/lib/dateFormat';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const SORT_OPTIONS: Array<{ value: NonNullable<TicketQueueFilters['sort_by']> | ''; label: string }> = [
  { value: '', label: 'Newest first' },
  { value: 'submitted_at', label: 'Submitted date' },
  { value: 'sla_due_at', label: 'SLA due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'escalation_level', label: 'Escalation level' },
];

function TicketQueuePanel() {
  const { formatDateTime } = useDateFormatter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false);
  const [watchingOnly, setWatchingOnly] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [viewingTicketId, setViewingTicketId] = useState<number | null>(null);

  const categoriesQuery = useTicketCategories({ is_active: true });
  const lookupsQuery = useSetupLookups();
  const resolversQuery = useTicketResolvers();
  const queueQuery = useTicketQueue({
    q: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
    ticket_category_id: categoryId ? Number(categoryId) : undefined,
    department_id: departmentId ? Number(departmentId) : undefined,
    assigned_to_user_id: assignee ? (assignee === 'unassigned' ? 'unassigned' : Number(assignee)) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    sla_breached: slaBreachedOnly || undefined,
    watching: watchingOnly || undefined,
    sort_by: (sortBy || undefined) as TicketQueueFilters['sort_by'],
    sort_direction: sortBy ? sortDirection : undefined,
  });

  const tickets = queueQuery.data?.data ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Ticket queue</CardTitle>
            <p className="mt-1 text-xs text-muted">Every ticket routed through the service desk, across all categories.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setCategoriesModalOpen(true)}>
            Categories
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, description, employee" className="pl-9" />
            </div>
            <SelectMenu value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <SelectMenu value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
            <SelectMenu
              value={categoryId}
              onChange={setCategoryId}
              options={[{ value: '', label: 'All categories' }, ...(categoriesQuery.data?.data ?? []).map((category) => ({ value: String(category.id), label: category.name }))]}
            />
            <SelectMenu
              value={departmentId}
              onChange={setDepartmentId}
              options={[{ value: '', label: 'All departments' }, ...(lookupsQuery.data?.departments ?? []).map((department) => ({ value: String(department.id), label: department.name }))]}
            />
            <SelectMenu
              value={assignee}
              onChange={setAssignee}
              options={[
                { value: '', label: 'All assignees' },
                { value: 'unassigned', label: 'Unassigned' },
                ...(resolversQuery.data?.data ?? []).map((resolver) => ({ value: String(resolver.id), label: resolver.name })),
              ]}
            />
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={(range) => { setDateFrom(range.dateFrom); setDateTo(range.dateTo); }} />
            <div className="flex items-center gap-2">
              <SelectMenu className="flex-1" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
              {sortBy && (
                <SelectMenu
                  className="w-28"
                  value={sortDirection}
                  onChange={(value) => setSortDirection(value as 'asc' | 'desc')}
                  options={[{ value: 'desc', label: 'Desc' }, { value: 'asc', label: 'Asc' }]}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-strong">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={slaBreachedOnly}
                onChange={(event) => setSlaBreachedOnly(event.target.checked)}
              />
              SLA breached only
            </label>
            <label className="flex items-center gap-2 text-sm text-strong">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={watchingOnly}
                onChange={(event) => setWatchingOnly(event.target.checked)}
              />
              Watching only
            </label>
          </div>

          {queueQuery.isLoading && <LoadingState label="Loading tickets..." />}
          {queueQuery.isError && <ErrorState error={queueQuery.error} onRetry={() => queueQuery.refetch()} />}
          {queueQuery.data && tickets.length === 0 && (
            <EmptyState title="No tickets match these filters" description="Adjust the filters above to widen the queue." />
          )}
          {tickets.length > 0 && (
            <ul className="-mx-5 divide-y divide-border">
              {tickets.map((ticket) => {
                const sla = slaStatus(ticket);

                return (
                  <li
                    key={ticket.id}
                    onClick={() => setViewingTicketId(ticket.id)}
                    className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-surface-soft"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-strong">{ticket.subject}</p>
                      <p className="text-xs text-muted">
                        {ticket.category?.name ?? 'Uncategorized'} · {ticket.employee?.full_name ?? 'Unknown employee'} · {formatDateTime(ticket.submitted_at)}
                        {ticket.department && ` · ${ticket.department.name}`}
                        {ticket.assigned_to && ` · Assigned to ${ticket.assigned_to.name}`}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      {ticket.escalation_level > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                          <Zap className="h-3.5 w-3.5" /> ×{ticket.escalation_level}
                        </span>
                      )}
                      {sla && <span className={`text-xs font-medium ${sla.overdue ? 'text-danger' : 'text-muted'}`}>{sla.label}</span>}
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={categoriesModalOpen} onClose={() => setCategoriesModalOpen(false)} title="Ticket categories" size="lg">
        <TicketCategoriesPanel />
      </Modal>

      <TicketDetailModal ticketId={viewingTicketId} onClose={() => setViewingTicketId(null)} mode="resolver" />
    </>
  );
}

function TicketReportingSection() {
  const reportingQuery = useTicketReporting();
  const reporting = reportingQuery.data;

  if (reportingQuery.isLoading) return <LoadingState label="Loading reporting..." />;
  if (reportingQuery.isError || !reporting) return <ErrorState error={reportingQuery.error} onRetry={() => reportingQuery.refetch()} />;

  const totalSubmitted = reporting.volume_trend.entries.reduce((sum, entry) => sum + entry.submitted, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tickets submitted (YTD)" value={totalSubmitted} icon={ListChecks} />
        <StatTile label="In progress" value={reporting.in_progress_count} icon={TimerReset} />
        <StatTile label="On hold" value={reporting.on_hold_count} icon={TimerReset} tone={reporting.on_hold_count ? 'warning' : 'default'} />
        <StatTile label="Escalated" value={reporting.escalated_count} icon={Zap} tone={reporting.escalated_count ? 'danger' : 'default'} />
        <StatTile label="Resolved (YTD)" value={reporting.resolved_count} icon={Layers} tone="success" />
        <StatTile label="Closed (YTD)" value={reporting.closed_count} icon={Layers} />
        <StatTile
          label="Avg. resolution time"
          value={reporting.average_resolution_hours !== null ? `${reporting.average_resolution_hours}h` : '—'}
          icon={TimerReset}
        />
        <StatTile
          label="Avg. first response"
          value={reporting.average_first_response_hours !== null ? `${reporting.average_first_response_hours}h` : '—'}
          icon={TimerReset}
        />
        <StatTile
          label="Satisfaction avg."
          value={reporting.satisfaction_average !== null ? `${reporting.satisfaction_average} / 5` : '—'}
          icon={Smile}
        />
        <StatTile
          label="SLA breaches (open now)"
          value={reporting.sla_breach_count}
          icon={TriangleAlert}
          tone={reporting.sla_breach_count ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Volume trend</CardTitle>
          </CardHeader>
          <CardBody>
            <MultiLineTrendChart
              valueLabel="Tickets"
              entries={reporting.volume_trend.entries.map((entry) => ({
                id: entry.key,
                label: entry.label,
                values: { submitted: entry.submitted, resolved: entry.resolved },
              }))}
              series={[
                { key: 'submitted', label: 'Submitted', color: 'var(--color-teal)' },
                { key: 'resolved', label: 'Resolved', color: 'var(--color-info)' },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardBody>
            <DonutChart
              totalLabel="Tickets"
              entries={reporting.by_category.map((entry) => ({ label: entry.name, value: entry.total }))}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By priority</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList
              valueLabel="Tickets"
              entries={reporting.by_priority.map((entry) => ({ label: entry.priority, value: entry.total }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList
              valueLabel="Tickets"
              entries={reporting.by_status.map((entry) => ({ label: entry.status, value: entry.total }))}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function TicketQueueContent() {
  return (
    <div>
      <PageHeader title="Service desk" subtitle="Resolver queue and reporting for every ticket in the organization." />
      <div className="space-y-5">
        <TicketReportingSection />
        <TicketQueuePanel />
      </div>
    </div>
  );
}

export function TicketQueuePage() {
  return (
    <RequirePermission permission="service_desk.view">
      <TicketQueueContent />
    </RequirePermission>
  );
}
