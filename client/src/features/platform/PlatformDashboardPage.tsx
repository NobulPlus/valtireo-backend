import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  ChevronRight,
  Download,
  FileClock,
  Layers3,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { CHART_COLORS, DonutChart, RankedBarList } from '@/components/ui/Charts';
import { downloadPlatformOrganizationsCsv, usePlatformDashboard, usePlatformOrganizations } from '@/features/platform/api';
import type { PlatformDashboard, PlatformOrganizationSummary } from '@/types/api';

const STATUS_OPTIONS = ['', 'active', 'invited', 'setup_in_progress', 'suspended'];
type AttentionKey = 'setup_incomplete' | 'without_modules' | 'without_admins';

const ATTENTION_COPY: Record<AttentionKey, { label: string; description: string }> = {
  setup_incomplete: {
    label: 'Setup incomplete',
    description: 'Organizations still in invitation or setup stages.',
  },
  without_modules: {
    label: 'No active modules',
    description: 'Organizations without any active or trial module subscription.',
  },
  without_admins: {
    label: 'No org admin',
    description: 'Organizations without an assigned Organization Admin user.',
  },
};

const STATUS_COLORS: Record<string, string> = {
  active: '#0F766E',
  invited: '#2563EB',
  setup_in_progress: '#D97706',
  setup: '#D97706',
  suspended: '#DC2626',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(status: string): string {
  return status
    .replaceAll('_', ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const DASHBOARD_HEADER_TITLE = 'Valtireo console';
const DASHBOARD_HEADER_SUBTITLE = 'Monitor every customer workspace, subscription footprint, and setup risk from one place.';

function PlatformDashboardContent({
  data,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  data: PlatformDashboard;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  const navigate = useNavigate();
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatus, setTableStatus] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [activeAttention, setActiveAttention] = useState<AttentionKey | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllModules, setShowAllModules] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const organizations = usePlatformOrganizations({
    page,
    search: tableSearch,
    status: tableStatus,
    sort_by: sortBy,
    sort_direction: sortDirection,
  });

  function sortDirectionFor(field: string): 'asc' | 'desc' | null {
    return sortBy === field ? sortDirection : null;
  }

  function sortByField(field: string) {
    setSortBy(field);
    setSortDirection((current) => (sortBy === field && current === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  }

  async function handleDownloadReport() {
    setIsExporting(true);

    try {
      await downloadPlatformOrganizationsCsv({
        search: tableSearch,
        status: tableStatus,
        sort_by: sortBy,
        sort_direction: sortDirection,
        date_from: dateFrom,
        date_to: dateTo,
      });
    } finally {
      setIsExporting(false);
    }
  }

  const columns = useMemo<Column<PlatformOrganizationSummary>[]>(
    () => [
      {
        key: 'organization',
        header: 'Organization',
        sortDirection: sortDirectionFor('name'),
        onSort: () => sortByField('name'),
        render: (row) => (
          <div>
            <p className="font-medium text-strong">{row.name}</p>
            <p className="text-xs text-muted">{row.code}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortDirection: sortDirectionFor('status'),
        onSort: () => sortByField('status'),
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'country',
        header: 'Country',
        sortDirection: sortDirectionFor('country'),
        onSort: () => sortByField('country'),
        render: (row) => row.country ?? 'Not set',
      },
      {
        key: 'employees',
        header: 'Employees',
        sortDirection: sortDirectionFor('employees_count'),
        onSort: () => sortByField('employees_count'),
        render: (row) => row.employees_count,
      },
      {
        key: 'modules',
        header: 'Modules',
        sortDirection: sortDirectionFor('module_subscriptions_count'),
        onSort: () => sortByField('module_subscriptions_count'),
        render: (row) => row.modules_count,
      },
      {
        key: 'created',
        header: 'Created',
        sortDirection: sortDirectionFor('created_at'),
        onSort: () => sortByField('created_at'),
        render: (row) => formatDate(row.created_at),
      },
    ],
    [sortBy, sortDirection],
  );

  const summary = data.summary;
  const sortedModules = [...data.module_adoption]
    .sort((a, b) => b.active_organizations - a.active_organizations)
    .map((module, index) => ({
      id: module.key,
      label: module.name,
      value: module.active_organizations,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  const topModules = sortedModules.slice(0, 6);
  const moduleScale = sortedModules[0]?.value ?? 0;
  const attentionItems: Array<{ key: AttentionKey; value: number }> = [
    { key: 'setup_incomplete', value: data.attention.setup_incomplete },
    { key: 'without_modules', value: data.attention.without_modules },
    { key: 'without_admins', value: data.attention.without_admins },
  ];
  const activeAttentionCopy = activeAttention ? ATTENTION_COPY[activeAttention] : null;
  const activeAttentionOrganizations = activeAttention ? data.attention_details[activeAttention] : [];

  return (
    <div>
      <PageHeader
        title={DASHBOARD_HEADER_TITLE}
        subtitle={DASHBOARD_HEADER_SUBTITLE}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleDownloadReport} isLoading={isExporting}>
              {!isExporting && <Download className="h-4 w-4" />}
              Report
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/platform/organizations/new')}>
              <Plus className="h-4 w-4" />
              New organization
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardBody className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-strong">Reporting window</p>
            <p className="mt-1 text-xs text-muted">Filter console metrics by organization creation date.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(range) => {
                onDateFromChange(range.dateFrom);
                onDateToChange(range.dateTo);
              }}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Organizations" value={summary.organizations_total} icon={Building2} />
        <StatTile label="Active workspaces" value={summary.organizations_active} icon={ShieldCheck} tone="success" />
        <StatTile label="Total users" value={summary.users_total} icon={Users} />
        <StatTile label="Pending documents" value={summary.pending_documents} icon={FileClock} tone="warning" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Organization status</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-5 md:grid-cols-[240px_1fr] md:items-center">
            <DonutChart
              totalLabel="Organizations"
              entries={data.organizations_by_status.map((entry) => ({
                id: entry.status,
                label: statusLabel(entry.status),
                value: entry.total,
                color: STATUS_COLORS[entry.status] ?? '#64748B',
              }))}
            />
            <div className="space-y-3">
              {data.organizations_by_status.map((entry) => (
                <div key={entry.status} className="flex items-center justify-between gap-3 rounded-md bg-surface-soft px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[entry.status] ?? '#64748B' }}
                    />
                    <span className="truncate text-sm font-medium text-strong">{statusLabel(entry.status)}</span>
                  </span>
                  <span className="font-display text-lg font-semibold text-strong">{entry.total}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardBody className="space-y-3">
            {attentionItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveAttention(item.key)}
                className="group flex w-full items-center justify-between rounded-md bg-surface-soft px-3 py-2 text-left transition-colors hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <span>
                  <span className="block text-sm font-medium text-strong">{ATTENTION_COPY[item.key].label}</span>
                  <span className="text-xs text-muted">{ATTENTION_COPY[item.key].description}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-display text-lg font-semibold text-strong">{item.value}</span>
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Module adoption</CardTitle>
            <Layers3 className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody className="space-y-3">
            {sortedModules.length === 0 ? (
              <EmptyState title="No module data yet" />
            ) : (
              <>
                <RankedBarList valueLabel="Organizations" entries={topModules} max={moduleScale} />
                {sortedModules.length > 6 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllModules(true)}>
                    View more
                  </Button>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently created</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.recent_organizations.length === 0 ? (
              <EmptyState title="No organizations yet" />
            ) : (
              <>
                {data.recent_organizations.slice(0, 5).map((organization) => (
                  <button
                    key={organization.id}
                    type="button"
                    onClick={() => navigate(`/platform/organizations/${organization.id}`)}
                    className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-surface-soft"
                  >
                    <span>
                      <span className="block text-sm font-medium text-strong">{organization.name}</span>
                      <span className="text-xs text-muted">{organization.code}</span>
                    </span>
                    <StatusBadge status={organization.status} />
                  </button>
                ))}
                {data.recent_organizations.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllRecent(true)}>
                    View more
                  </Button>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <CardTitle>All organizations</CardTitle>
        </CardHeader>
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(130px,180px)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <Input
              value={tableSearch}
              onChange={(event) => {
                setTableSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search organization"
              className="pl-9"
            />
          </div>
          <SelectMenu
            value={tableStatus}
            onChange={(value) => {
              setTableStatus(value);
              setPage(1);
            }}
            options={STATUS_OPTIONS.map((option) => ({
              value: option,
              label: option ? option.replaceAll('_', ' ') : 'All statuses',
            }))}
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-9 px-0"
            onClick={() => {
              setTableSearch('');
              setTableStatus('');
              setSortBy('created_at');
              setSortDirection('desc');
              setPage(1);
            }}
            aria-label="Reset organization table filters"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {organizations.isLoading ? (
          <LoadingState label="Loading organizations..." />
        ) : organizations.isError ? (
          <ErrorState error={organizations.error} onRetry={() => organizations.refetch()} />
        ) : !organizations.data ? (
          <CardBody>
            <EmptyState title="Organization data is not available" />
          </CardBody>
        ) : organizations.data.data.length === 0 ? (
          <CardBody>
            <EmptyState title="No organizations found" description="Try changing the search or status filter." />
          </CardBody>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={organizations.data.data}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/platform/organizations/${row.id}`)}
            />
            <Pagination meta={organizations.data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(activeAttention)}
        onClose={() => setActiveAttention(null)}
        title={activeAttentionCopy?.label ?? 'Needs attention'}
      >
        <div className="space-y-4">
          {activeAttentionCopy && <p className="text-sm leading-6 text-muted">{activeAttentionCopy.description}</p>}

          {activeAttentionOrganizations.length === 0 ? (
            <EmptyState title="No organizations in this group" description="This alert is currently clear." />
          ) : (
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {activeAttentionOrganizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => {
                    setActiveAttention(null);
                    navigate(`/platform/organizations/${organization.id}`);
                  }}
                  className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-surface-soft"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-strong">{organization.name}</span>
                    <span className="text-xs text-muted">
                      {organization.code} - {organization.employees_count} employees - {organization.modules_count} modules
                    </span>
                  </span>
                  <StatusBadge status={organization.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showAllRecent}
        onClose={() => setShowAllRecent(false)}
        title="Recently created"
      >
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {data.recent_organizations.map((organization) => (
            <button
              key={organization.id}
              type="button"
              onClick={() => {
                setShowAllRecent(false);
                navigate(`/platform/organizations/${organization.id}`);
              }}
              className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-surface-soft"
            >
              <span>
                <span className="block text-sm font-medium text-strong">{organization.name}</span>
                <span className="text-xs text-muted">{organization.code}</span>
              </span>
              <StatusBadge status={organization.status} />
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={showAllModules}
        onClose={() => setShowAllModules(false)}
        title="Module adoption"
      >
        <div className="max-h-[360px] overflow-y-auto pr-1">
          <RankedBarList valueLabel="Organizations" entries={sortedModules} max={moduleScale} />
        </div>
      </Modal>
    </div>
  );
}

export function PlatformDashboardPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dashboard = usePlatformDashboard({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  if (dashboard.isLoading) {
    return (
      <div>
        <PageHeader title={DASHBOARD_HEADER_TITLE} subtitle={DASHBOARD_HEADER_SUBTITLE} />
        <LoadingState label="Loading Valtireo console..." fill />
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div>
        <PageHeader title={DASHBOARD_HEADER_TITLE} subtitle={DASHBOARD_HEADER_SUBTITLE} />
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </div>
    );
  }

  if (!dashboard.data) {
    return (
      <div>
        <PageHeader title={DASHBOARD_HEADER_TITLE} subtitle={DASHBOARD_HEADER_SUBTITLE} />
        <EmptyState title="Platform data is not available" />
      </div>
    );
  }

  return (
    <PlatformDashboardContent
      data={dashboard.data}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
    />
  );
}
