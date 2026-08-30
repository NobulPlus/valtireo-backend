import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Blocks,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileWarning,
  Headset,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Star,
  Timer,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useOrganizationDashboard, type OrganizationDashboardFilters } from '@/features/dashboard/api';
import { useAuth } from '@/context/AuthContext';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Input } from '@/components/ui/Input';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { AreaTrendChart, ChartLegend, DonutChart, RankedBarList } from '@/components/ui/Charts';
import { useSetupLookups } from '@/features/workspace/api';
import { downloadEmployeesCsv, useEmployees, type EmployeeFilters } from '@/features/employees/api';
import { EMPLOYEE_STATUS_OPTIONS, statusLabel } from '@/features/employees/statusHelpers';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import type { Employee, EmployeeSummary } from '@/types/api';

/** Pine/Teal/Blue family only — Gold/Cyan/Bridge Teal are reserved (index.css) and must not appear as general chart colors. */
const DEPARTMENT_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
];

type TrendMetric = 'created' | 'invited' | 'submitted' | 'activated';
const TREND_METRIC_OPTIONS: Array<{ value: TrendMetric; label: string; color: string }> = [
  { value: 'created', label: 'Created', color: 'var(--color-teal)' },
  { value: 'invited', label: 'Invited', color: 'var(--color-blue)' },
  { value: 'submitted', label: 'Submitted', color: 'var(--color-chart-4)' },
  { value: 'activated', label: 'Activated', color: 'var(--color-chart-5)' },
];

const SETUP_ITEM_LABELS: Record<string, string> = {
  locations: 'Locations',
  departments: 'Departments',
  units: 'Units',
  designations: 'Designations',
  grade_levels: 'Grade levels',
  employment_types: 'Employment types',
  employees: 'Employees added',
};

function lookupOptions<T extends { id: number; name: string }>(items: T[] | undefined, placeholder: string): SelectMenuOption[] {
  return [
    { value: '', label: placeholder },
    ...(items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

function HeroStat({
  icon: Icon,
  iconClassName,
  value,
  label,
  chip,
  chipClassName,
  delayMs,
}: {
  icon: LucideIcon;
  iconClassName: string;
  value: number | string;
  label: string;
  chip: string;
  chipClassName: string;
  delayMs: number;
}) {
  return (
    <div
      className="dashboard-hero-stat group flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-[0_20px_40px_-18px_rgba(15,35,32,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_44px_-16px_rgba(15,35,32,0.4)]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105', iconClassName)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', chipClassName)}>{chip}</span>
      </div>
      <div>
        <p className="font-display text-[26px] font-bold leading-none tabular-nums text-strong">{value}</p>
        <p className="mt-1.5 text-[12.5px] font-medium text-muted">{label}</p>
      </div>
    </div>
  );
}

function SummaryLinkCard({
  icon: Icon,
  iconClassName,
  title,
  stats,
  onClick,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  stats: Array<{ label: string; value: number; tone?: 'default' | 'warning' | 'danger' }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-[0_16px_32px_-18px_rgba(15,35,32,0.35)]"
    >
      <div className="flex items-center justify-between">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconClassName)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-muted group-hover:text-teal">View</span>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-strong">{title}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {stats.map((stat) => (
            <span key={stat.label} className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  'font-display text-lg font-bold tabular-nums',
                  stat.tone === 'danger' ? 'text-danger' : stat.tone === 'warning' ? 'text-warning' : 'text-strong',
                )}
              >
                {stat.value}
              </span>
              <span className="text-[11px] font-medium text-muted">{stat.label}</span>
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export function OrganizationDashboardView() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { formatDate } = useDateFormatter();
  const lookups = useSetupLookups();
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: number; name: string; total: number } | null>(null);
  const [showAllRecentEmployees, setShowAllRecentEmployees] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('created');
  const [filters, setFilters] = useState<OrganizationDashboardFilters>({
    date_column: 'created_at',
    recent_limit: 25,
  });
  const { data, isLoading, isError, error, refetch } = useOrganizationDashboard(filters);
  const [exporting, setExporting] = useState(false);
  const departmentEmployees = useEmployees(
    {
      search: filters.search,
      status: filters.status,
      department_id: selectedDepartment?.id,
      date_from: filters.date_from,
      date_to: filters.date_to,
      date_column: filters.date_column,
      sort_by: 'first_name',
      sort_direction: 'asc',
      per_page: 50,
    },
    Boolean(selectedDepartment),
  );

  const employeeColumns = useMemo<Column<EmployeeSummary>[]>(
    () => [
      {
        key: 'employee',
        header: 'Employee',
        render: (row) => (
          <div>
            <p className="font-medium text-strong">{row.full_name}</p>
            <p className="text-xs text-muted">{row.employee_number}</p>
          </div>
        ),
      },
      { key: 'department', header: 'Department', render: (row) => row.department?.name ?? 'Unassigned' },
      { key: 'location', header: 'Location', render: (row) => row.location?.name ?? 'Unassigned' },
      { key: 'status', header: 'Status', render: (row) => (row.status ? <StatusBadge status={row.status} /> : '-') },
    ],
    [],
  );
  const departmentEmployeeColumns = useMemo<Column<Employee>[]>(
    () => [
      {
        key: 'employee',
        header: 'Employee',
        render: (row) => (
          <div>
            <p className="font-medium text-strong">{row.full_name}</p>
            <p className="text-xs text-muted">{row.employee_number}</p>
          </div>
        ),
      },
      { key: 'email', header: 'Work email', render: (row) => row.work_email },
      { key: 'location', header: 'Location', render: (row) => row.location?.name ?? 'Unassigned' },
      { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ],
    [],
  );

  if (isLoading) return <LoadingState label="Loading organization dashboard..." fill />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;
  const dashboardData = data;
  const departmentEntries = data.breakdowns.by_department.map((entry, index) => ({
    id: entry.id,
    label: entry.name,
    value: entry.total,
    color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
  }));
  const employmentTypeEntries = data.breakdowns.by_employment_type.map((entry, index) => ({
    id: entry.id,
    label: entry.name,
    value: entry.total,
    color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
  }));
  const locationEntries = data.breakdowns.by_location.map((entry, index) => ({
    id: entry.id,
    label: entry.name,
    value: entry.total,
    color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
    badge: entry.is_primary ? (
      <Star className="h-3 w-3 flex-none fill-current text-warning" aria-label="Primary location" />
    ) : undefined,
  }));
  const statusEntries = data.breakdowns.by_status.map((entry, index) => ({
    id: entry.status,
    label: statusLabel(entry.status),
    value: entry.total,
    color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
  }));
  const pendingInvitations = data.recent.invitations.filter((invitation) => invitation.status === 'pending');
  const recentEmployees = data.recent.employees.slice(0, 5);
  const onboardingTrend = data.trends.onboarding;
  const selectedTrendMetric = TREND_METRIC_OPTIONS.find((option) => option.value === trendMetric) ?? TREND_METRIC_OPTIONS[0];
  const trendEntries = onboardingTrend.entries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    value: entry[trendMetric],
  }));

  const activePercentage = data.employees.total > 0 ? Math.round((data.employees.active / data.employees.total) * 100) : 0;
  const setupItems = Object.entries(data.setup_completion.items) as Array<[string, boolean]>;

  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const overviewParts = [
    `${data.employees.total} employee${data.employees.total === 1 ? '' : 's'} across ${data.structure.departments} department${data.structure.departments === 1 ? '' : 's'}`,
  ];
  if (data.employees.onboarding > 0) {
    overviewParts.push(`${data.employees.onboarding} mid-onboarding`);
  }
  if (data.onboarding.submitted_profiles > 0) {
    overviewParts.push(`${data.onboarding.submitted_profiles} profile${data.onboarding.submitted_profiles === 1 ? '' : 's'} awaiting review`);
  }

  async function handleExportEmployees() {
    setExporting(true);
    try {
      const exportFilters: EmployeeFilters = {
        search: filters.search,
        status: filters.status,
        department_id: filters.department_id,
        date_from: filters.date_from,
        date_to: filters.date_to,
        date_column: filters.date_column,
        sort_by: dashboardData.filters.sort_by as string,
        sort_direction: dashboardData.filters.sort_direction as 'asc' | 'desc',
      };
      await downloadEmployeesCsv(exportFilters);
    } finally {
      setExporting(false);
    }
  }

  function updateFilter<K extends keyof OrganizationDashboardFilters>(key: K, value: OrganizationDashboardFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function resetFilters() {
    setFilters({ date_column: 'created_at', recent_limit: 25 });
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="-mx-6 overflow-hidden rounded-b-[28px] px-6 pb-9 pt-5 sm:px-8"
        style={{
          background:
            'radial-gradient(120% 140% at 8% 0%, color-mix(in srgb, var(--workspace-primary, #123f3a) 78%, white 22%) 0%, var(--workspace-primary, #123f3a) 42%, color-mix(in srgb, var(--workspace-primary, #123f3a) 82%, black 18%) 100%)',
          color: 'rgb(var(--workspace-primary-fg, 255 255 255))',
        }}
      >
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p
              className="text-[11.5px] font-bold uppercase tracking-wide"
              style={{ color: 'rgb(var(--workspace-primary-fg, 255 255 255) / 0.8)' }}
            >
              {todayLabel} &middot; {session?.organization?.name ?? 'Organization'} overview
            </p>
            <p
              className="mt-1.5 max-w-[62ch] text-[15px] font-medium"
              style={{ color: 'rgb(var(--workspace-primary-fg, 255 255 255) / 0.9)' }}
            >
              {overviewParts.join(' · ')}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="onHero" size="sm" onClick={handleExportEmployees} isLoading={exporting}>
              {!exporting && <Download className="h-4 w-4" />}
              Export report
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/employees/new')}>
              <Plus className="h-4 w-4" />
              Add employee
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeroStat
            icon={Users}
            iconClassName="bg-teal-light text-pine"
            value={data.employees.total}
            label="Total employees"
            chip={`${data.employees.draft} draft`}
            chipClassName="bg-draft-bg text-draft"
            delayMs={40}
          />
          <HeroStat
            icon={UserCheck}
            iconClassName="bg-success-bg text-success"
            value={data.employees.active}
            label="Active"
            chip={`${activePercentage}% of workforce`}
            chipClassName="bg-surface-soft text-muted"
            delayMs={110}
          />
          <HeroStat
            icon={ClipboardList}
            iconClassName="bg-pending-bg text-pending"
            value={data.employees.onboarding}
            label="Onboarding"
            chip={`${data.onboarding.submitted_profiles} awaiting review`}
            chipClassName="bg-info-bg text-info"
            delayMs={180}
          />
          <HeroStat
            icon={Building2}
            iconClassName="bg-teal-light text-teal"
            value={data.structure.departments}
            label="Departments"
            chip={`${data.structure.locations} locations`}
            chipClassName="bg-surface-soft text-muted"
            delayMs={250}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organization filters</CardTitle>
            <p className="mt-1 text-xs text-muted">Refine employee metrics, charts, recent employees, and the report export.</p>
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_130px_160px_210px_36px]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <Input
              value={filters.search ?? ''}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search employees"
              className="pl-9"
            />
          </div>
          <SelectMenu
            value={filters.status ?? ''}
            onChange={(value) => updateFilter('status', value)}
            options={[
              { value: '', label: 'All statuses' },
              ...EMPLOYEE_STATUS_OPTIONS.map((option) => ({ value: option, label: statusLabel(option) })),
            ]}
          />
          <SelectMenu
            value={filters.department_id ? String(filters.department_id) : ''}
            onChange={(value) => updateFilter('department_id', value ? Number(value) : undefined)}
            options={lookupOptions(lookups.data?.departments, 'All departments')}
          />
          <DateRangePicker
            dateFrom={filters.date_from ?? ''}
            dateTo={filters.date_to ?? ''}
            onChange={(range) => {
              updateFilter('date_from', range.dateFrom);
              updateFilter('date_to', range.dateTo);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-9 px-0"
            onClick={resetFilters}
            aria-label="Reset organization dashboard filters"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryLinkCard
          icon={ClipboardCheck}
          iconClassName="bg-teal-light text-pine"
          title="Approvals"
          onClick={() => navigate('/approvals')}
          stats={[
            { label: 'pending', value: data.approvals.pending },
            { label: 'needs attention', value: data.approvals.needs_attention, tone: data.approvals.needs_attention > 0 ? 'warning' : 'default' },
          ]}
        />
        <SummaryLinkCard
          icon={Headset}
          iconClassName="bg-info-bg text-info"
          title="Service desk"
          onClick={() => navigate('/service-desk')}
          stats={[
            { label: 'open', value: data.service_desk.open },
            { label: 'unassigned', value: data.service_desk.unassigned, tone: data.service_desk.unassigned > 0 ? 'warning' : 'default' },
            { label: 'SLA breached', value: data.service_desk.sla_breached, tone: data.service_desk.sla_breached > 0 ? 'danger' : 'default' },
          ]}
        />
        <SummaryLinkCard
          icon={CalendarClock}
          iconClassName="bg-info-bg text-info"
          title="Leave"
          onClick={() => navigate('/leave')}
          stats={[
            { label: 'pending', value: data.leave.pending },
            { label: 'upcoming (7d)', value: data.leave.upcoming },
          ]}
        />
        <SummaryLinkCard
          icon={Timer}
          iconClassName="bg-success-bg text-success"
          title="Attendance today"
          onClick={() => navigate('/attendance')}
          stats={[
            { label: 'present', value: data.attendance.present },
            { label: 'late', value: data.attendance.late, tone: data.attendance.late > 0 ? 'warning' : 'default' },
            { label: 'absent', value: data.attendance.absent, tone: data.attendance.absent > 0 ? 'danger' : 'default' },
          ]}
        />
        <SummaryLinkCard
          icon={FileWarning}
          iconClassName="bg-pending-bg text-pending"
          title="Documents"
          onClick={() => navigate('/documents')}
          stats={[
            { label: 'missing', value: data.documents.missing, tone: data.documents.missing > 0 ? 'warning' : 'default' },
            { label: 'expiring soon', value: data.documents.expiring_soon, tone: data.documents.expiring_soon > 0 ? 'warning' : 'default' },
            { label: 'expired', value: data.documents.expired, tone: data.documents.expired > 0 ? 'danger' : 'default' },
          ]}
        />
        <SummaryLinkCard
          icon={Blocks}
          iconClassName="bg-surface-soft text-teal"
          title="Modules"
          onClick={() => navigate('/settings/control-center')}
          stats={[
            { label: 'active', value: data.modules.active },
            { label: 'locked', value: data.modules.locked, tone: data.modules.locked > 0 ? 'warning' : 'default' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Employee onboarding trend</CardTitle>
              <p className="mt-1 text-xs text-muted">
                {onboardingTrend.grain === 'day'
                  ? `Daily movement for ${onboardingTrend.label}; days without movement are hidden.`
                  : `Monthly movement for ${onboardingTrend.label}; empty months are hidden.`}
              </p>
            </div>
            <div className="sm:w-[160px]">
              <SelectMenu
                value={trendMetric}
                onChange={(value) => setTrendMetric(value as TrendMetric)}
                options={TREND_METRIC_OPTIONS}
              />
            </div>
          </CardHeader>
          <CardBody>
            <AreaTrendChart entries={trendEntries} valueLabel={selectedTrendMetric.label} color={selectedTrendMetric.color} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup progress</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col items-center">
            <ProgressRing percentage={data.setup_completion.percentage} />
            <div className="mt-5 w-full space-y-2">
              {setupItems.map(([key, done]) => (
                <div key={key} className="flex items-center gap-2.5 text-[12.5px]">
                  <span
                    className={cn(
                      'flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold',
                      done ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning',
                    )}
                  >
                    {done ? '✓' : '•'}
                  </span>
                  <span className={cn('font-medium', done ? 'text-strong' : 'text-muted')}>
                    {SETUP_ITEM_LABELS[key] ?? key}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="mt-4 self-start text-xs font-medium text-teal hover:underline"
            >
              Go to workspace setup
            </button>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By department</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center gap-5">
            <div className="w-[150px] flex-none">
              <DonutChart
                totalLabel="Employees"
                entries={departmentEntries}
                onEntryClick={(entry) => {
                  const department = data.breakdowns.by_department.find((item) => item.id === entry.id);
                  if (department) setSelectedDepartment(department);
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <ChartLegend
                entries={departmentEntries}
                onEntryClick={(entry) => {
                  const department = data.breakdowns.by_department.find((item) => item.id === entry.id);
                  if (department) setSelectedDepartment(department);
                }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By employment type</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList valueLabel="Employees" entries={employmentTypeEntries} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By location</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-3 flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5" />
              {data.structure.locations} location{data.structure.locations === 1 ? '' : 's'}
            </div>
            <RankedBarList valueLabel="Employees" entries={locationEntries} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList valueLabel="Employees" entries={statusEntries} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Pending invitations
            </CardTitle>
            {pendingInvitations.length > 0 && (
              <p className="text-xs text-muted">{pendingInvitations.length} awaiting acceptance</p>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {pendingInvitations.length > 0 ? (
              <ul className="divide-y divide-border">
                {pendingInvitations.slice(0, 5).map((invitation) => (
                  <li key={invitation.id}>
                    <button
                      type="button"
                      onClick={() => invitation.employee && navigate(`/employees/${invitation.employee.id}`)}
                      className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-surface-soft disabled:cursor-default disabled:hover:bg-transparent"
                      disabled={!invitation.employee}
                    >
                      <div>
                        <p className="font-medium text-strong">{invitation.employee?.full_name ?? invitation.email}</p>
                        <p className="text-xs text-muted">{invitation.email}</p>
                      </div>
                      <span className="text-xs text-muted">
                        {invitation.expires_at ? `Expires ${formatDate(invitation.expires_at)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No pending invitations.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recently added employees</CardTitle>
          {data.recent.employees.length > 5 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAllRecentEmployees(true)}>
              Read more
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {data.recent.employees.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No employees yet.</p>
          ) : (
            <DataTable
              columns={employeeColumns}
              rows={recentEmployees}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/employees/${row.id}`)}
            />
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(selectedDepartment)}
        onClose={() => setSelectedDepartment(null)}
        title={selectedDepartment ? `${selectedDepartment.name} employees` : 'Department employees'}
        size="lg"
      >
        {departmentEmployees.isLoading ? (
          <LoadingState label="Loading department employees..." />
        ) : departmentEmployees.isError ? (
          <ErrorState error={departmentEmployees.error} onRetry={() => departmentEmployees.refetch()} />
        ) : !departmentEmployees.data || departmentEmployees.data.data.length === 0 ? (
          <p className="py-6 text-sm text-muted">No employees match this department and the current filters.</p>
        ) : (
          <div>
            <DataTable
              columns={departmentEmployeeColumns}
              rows={departmentEmployees.data.data}
              rowKey={(row) => row.id}
              onRowClick={(row) => {
                setSelectedDepartment(null);
                navigate(`/employees/${row.id}`);
              }}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={showAllRecentEmployees}
        onClose={() => setShowAllRecentEmployees(false)}
        title="Recently added employees"
        size="lg"
      >
        <DataTable
          columns={employeeColumns}
          rows={data.recent.employees}
          rowKey={(row) => row.id}
          onRowClick={(row) => {
            setShowAllRecentEmployees(false);
            navigate(`/employees/${row.id}`);
          }}
        />
      </Modal>
    </div>
  );
}
