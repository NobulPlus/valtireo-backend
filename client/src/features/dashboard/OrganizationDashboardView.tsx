import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Download, RotateCcw, Search, UserCheck, Users } from 'lucide-react';
import { useOrganizationDashboard, type OrganizationDashboardFilters } from '@/features/dashboard/api';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Input } from '@/components/ui/Input';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { CHART_COLORS, ChartLegend, ColumnChart, DonutChart } from '@/components/ui/Charts';
import { useSetupLookups } from '@/features/workspace/api';
import { downloadEmployeesCsv, useEmployees, type EmployeeFilters } from '@/features/employees/api';
import type { Employee, EmployeeSummary } from '@/types/api';

const EMPLOYEE_STATUS_OPTIONS = ['draft', 'invited', 'onboarding', 'active', 'suspended', 'exited'];
type TrendMetric = 'created' | 'invited' | 'submitted' | 'activated';
const TREND_METRIC_OPTIONS: Array<{ value: TrendMetric; label: string; color: string }> = [
  { value: 'created', label: 'Created', color: CHART_COLORS[0] },
  { value: 'invited', label: 'Invited', color: CHART_COLORS[1] },
  { value: 'submitted', label: 'Submitted', color: CHART_COLORS[2] },
  { value: 'activated', label: 'Activated', color: CHART_COLORS[3] },
];
function lookupOptions<T extends { id: number; name: string }>(items: T[] | undefined, placeholder: string): SelectMenuOption[] {
  return [
    { value: '', label: placeholder },
    ...(items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

export function OrganizationDashboardView() {
  const navigate = useNavigate();
  const lookups = useSetupLookups();
  const [selectedDepartment, setSelectedDepartment] = useState<{ id: number; name: string; total: number } | null>(null);
  const [showAllRecentEmployees, setShowAllRecentEmployees] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('created');
  const [filters, setFilters] = useState<OrganizationDashboardFilters>({
    date_column: 'created_at',
    recent_limit: 25,
    trend_year: new Date().getFullYear(),
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
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const recentEmployees = data.recent.employees.slice(0, 5);
  const onboardingTrend = data.trends.onboarding;
  const trendYearOptions = onboardingTrend.available_years.length > 0
    ? onboardingTrend.available_years.map((year) => ({ value: String(year), label: String(year) }))
    : [{ value: String(filters.trend_year ?? new Date().getFullYear()), label: String(filters.trend_year ?? new Date().getFullYear()) }];
  const trendMonthOptions = [
    { value: '', label: 'Monthly trend' },
    ...onboardingTrend.available_months.map((month) => ({ value: String(month.value), label: month.label })),
  ];
  const selectedTrendMetric = TREND_METRIC_OPTIONS.find((option) => option.value === trendMetric) ?? TREND_METRIC_OPTIONS[0];
  const trendEntries = onboardingTrend.entries
    .map((entry) => ({
      id: entry.key,
      label: entry.label,
      value: entry[trendMetric],
      color: selectedTrendMetric.color,
    }))
    .filter((entry) => entry.value > 0);

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
    setFilters({ date_column: 'created_at', recent_limit: 25, trend_year: new Date().getFullYear() });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <div>
            <CardTitle>Organization filters</CardTitle>
            <p className="mt-1 text-xs text-muted">Refine employee metrics, charts, recent employees, and the report export.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExportEmployees} isLoading={exporting}>
            {!exporting && <Download className="h-4 w-4" />}
            Report
          </Button>
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
              ...EMPLOYEE_STATUS_OPTIONS.map((option) => ({ value: option, label: option.charAt(0).toUpperCase() + option.slice(1) })),
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total employees" value={data.employees.total} icon={Users} />
        <StatTile label="Active" value={data.employees.active} tone="success" icon={UserCheck} />
        <StatTile label="Onboarding" value={data.employees.onboarding} icon={ClipboardList} />
        <StatTile label="Departments" value={data.structure.departments} icon={Building2} />
      </div>

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
          <div className="grid gap-2 sm:w-[460px] sm:grid-cols-[1.05fr_1fr_1fr]">
            <SelectMenu
              value={trendMetric}
              onChange={(value) => setTrendMetric(value as TrendMetric)}
              options={TREND_METRIC_OPTIONS}
            />
            <SelectMenu
              value={String(filters.trend_year ?? onboardingTrend.year)}
              onChange={(value) => {
                setFilters((current) => ({ ...current, trend_year: Number(value), trend_month: undefined }));
              }}
              options={trendYearOptions}
            />
            <SelectMenu
              value={filters.trend_month ? String(filters.trend_month) : ''}
              onChange={(value) => updateFilter('trend_month', value ? Number(value) : undefined)}
              options={trendMonthOptions}
            />
          </div>
        </CardHeader>
        <CardBody>
          <ColumnChart
            valueLabel="Employees"
            entries={trendEntries}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Employees by department</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-5 md:grid-cols-[240px_1fr] md:items-center">
            <DonutChart
              totalLabel="Employees"
              entries={departmentEntries}
              onEntryClick={(entry) => {
                const department = data.breakdowns.by_department.find((item) => item.id === entry.id);
                if (department) setSelectedDepartment(department);
              }}
            />
            <ChartLegend
              entries={departmentEntries}
              onEntryClick={(entry) => {
                const department = data.breakdowns.by_department.find((item) => item.id === entry.id);
                if (department) setSelectedDepartment(department);
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup progress</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>Workspace setup</span>
              <span>{data.setup_completion.percentage}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
              <div className="h-full rounded-full bg-teal" style={{ width: `${data.setup_completion.percentage}%` }} />
            </div>
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="mt-3 text-xs font-medium text-teal hover:underline"
            >
              Go to workspace setup
            </button>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
          <CardTitle>By employment type</CardTitle>
          </CardHeader>
          <CardBody>
            <ColumnChart
              valueLabel="Employees"
              entries={data.breakdowns.by_employment_type.map((entry, index) => ({
                id: entry.id,
                label: entry.name,
                value: entry.total,
                color: CHART_COLORS[index % CHART_COLORS.length],
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
          <CardTitle>By location</CardTitle>
          </CardHeader>
          <CardBody>
            <ColumnChart
              valueLabel="Employees"
              entries={data.breakdowns.by_location.map((entry, index) => ({
                id: entry.id,
                label: entry.name,
                value: entry.total,
                color: CHART_COLORS[index % CHART_COLORS.length],
              }))}
            />
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
