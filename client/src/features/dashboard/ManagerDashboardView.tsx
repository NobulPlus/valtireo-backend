import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Timer,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useManagerDashboard } from '@/features/dashboard/api';
import { useDepartmentOptions } from '@/features/employees/api';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { ColumnChart, RankedBarList } from '@/components/ui/Charts';
import { statusLabel } from '@/features/employees/statusHelpers';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import type { EmployeeSummary, ManagerDashboard } from '@/types/api';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

function TeamAction({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface p-4',
        tone === 'danger'
          ? 'border-danger-bg'
          : tone === 'warning'
            ? 'border-warning-bg'
            : tone === 'success'
              ? 'border-success-bg'
              : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            tone === 'danger'
              ? 'bg-danger-bg text-danger'
              : tone === 'warning'
                ? 'bg-warning-bg text-warning'
                : tone === 'success'
                  ? 'bg-success-bg text-success'
                  : 'bg-teal-light text-pine',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-display text-2xl font-bold tabular-nums text-strong">{value}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-strong">{label}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}

function TeamPersonRow({ employee, extra }: { employee: EmployeeSummary; extra?: ReactNode }) {
  return (
    <Link
      to={`/employees/${employee.id}`}
      className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface-soft"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-strong">{employee.full_name}</p>
        <p className="truncate text-xs text-muted">
          {employee.employee_number}
          {employee.department?.name ? ` · ${employee.department.name}` : ''}
        </p>
      </div>
      {extra ?? (employee.status ? <StatusBadge status={employee.status} /> : null)}
    </Link>
  );
}

function scopeLabel(data: ManagerDashboard): string {
  if (data.scope.type === 'department') return data.scope.department?.name ?? 'Department';
  if (data.scope.type === 'cluster') return data.scope.cluster?.name ?? 'Cluster';
  return 'Direct reports';
}

export function ManagerDashboardView() {
  const { hasPermission, hasManagerScope } = useAuth();
  const canBrowseDepartments = hasPermission('reports.view');
  const [departmentId, setDepartmentId] = useState('');
  const departmentOptions = useDepartmentOptions();
  const effectiveDepartmentId = departmentId ? Number(departmentId) : undefined;
  const queryEnabled = hasManagerScope || Boolean(effectiveDepartmentId);

  const { data, isLoading, isError, error, refetch } = useManagerDashboard(
    { department_id: effectiveDepartmentId },
    queryEnabled,
  );
  const { formatDateTime } = useDateFormatter();

  const departmentPicker = canBrowseDepartments && (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-sm font-medium text-muted">Viewing</span>
      <div className="w-full sm:w-72">
        <SelectMenu
          value={departmentId}
          onChange={setDepartmentId}
          options={[
            { value: '', label: hasManagerScope ? 'My team' : 'Select a department...' },
            ...(departmentOptions.data ?? []).map((department) => ({
              value: String(department.id),
              label: department.name,
            })),
          ]}
        />
      </div>
    </div>
  );

  if (!queryEnabled) {
    return (
      <div>
        {departmentPicker}
        <EmptyState title="Pick a department" description="Select a department above to view its team dashboard." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        {departmentPicker}
        <LoadingState label="Loading manager dashboard..." fill />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        {departmentPicker}
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!data) return null;

  if (data.employees.total === 0) {
    return (
      <div>
        {departmentPicker}
        <EmptyState
          title="No team members found"
          description="You don't have any direct reports or department assignments yet."
        />
      </div>
    );
  }

  const attendanceExceptions = data.attendance.late + data.attendance.absent + data.attendance.corrections_pending;
  const profileAttention = data.team_health.profiles_pending + data.team_health.profiles_submitted + data.team_health.incomplete_profiles;
  const availabilityEntries = [
    { id: 'present', label: 'Present', value: data.attendance.present, color: 'var(--color-teal)' },
    { id: 'late', label: 'Late', value: data.attendance.late, color: 'var(--color-warning)' },
    { id: 'absent', label: 'Absent', value: data.attendance.absent, color: 'var(--color-danger)' },
  ];
  const locationEntries = data.composition.by_location.map((entry, index) => ({
    id: entry.id,
    label: entry.name,
    value: entry.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const statusEntries = data.composition.by_status.map((entry, index) => ({
    id: entry.status,
    label: statusLabel(entry.status),
    value: entry.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div className="flex flex-col gap-5">
      {departmentPicker}

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-[0_16px_40px_-30px_rgba(15,35,32,0.45)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Team operations</p>
            <h3 className="mt-1 font-display text-2xl font-semibold text-strong">{scopeLabel(data)}</h3>
            <p className="mt-1 text-sm text-muted">Coverage, exceptions, profile readiness, and new joiners for the people you manage.</p>
          </div>
          <StatusBadge status={data.scope.source.replaceAll('_', ' ')} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Team size" value={data.employees.total} icon={Users} />
          <StatTile label="Active" value={data.employees.active} tone="success" icon={UserCheck} />
          <StatTile label="Leave pending" value={data.leave.pending_requests} icon={CalendarClock} tone={data.leave.pending_requests ? 'warning' : 'default'} />
          <StatTile label="Exceptions" value={attendanceExceptions} icon={AlertTriangle} tone={attendanceExceptions ? 'warning' : 'success'} />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeamAction
          icon={ClipboardList}
          label="Profile readiness"
          value={profileAttention}
          detail={`${data.team_health.profiles_submitted} submitted, ${data.team_health.incomplete_profiles} without profile.`}
          tone={profileAttention ? 'warning' : 'success'}
        />
        <TeamAction
          icon={CalendarClock}
          label="Leave coverage"
          value={data.leave.days_pending}
          detail={`${data.leave.pending_requests} request(s) awaiting approval, ${data.leave.days_approved} approved day(s).`}
          tone={data.leave.pending_requests ? 'warning' : 'default'}
        />
        <TeamAction
          icon={Timer}
          label="Hours captured"
          value={Math.round(data.attendance.duration_minutes / 60)}
          detail={`${data.attendance.corrections_pending} attendance correction(s) waiting.`}
          tone={data.attendance.corrections_pending ? 'warning' : 'default'}
        />
        <TeamAction
          icon={CheckCircle2}
          label="Direct reports"
          value={data.people.direct_reports.length}
          detail="People reporting directly to you inside this team scope."
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Availability today</CardTitle>
            <MapPin className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            <ColumnChart entries={availabilityEntries} valueLabel="Employees" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team locations</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList entries={locationEntries} valueLabel="Employees" />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Team by status</CardTitle>
          </CardHeader>
          <CardBody>
            <RankedBarList entries={statusEntries} valueLabel="Employees" />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> New joiners
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {data.recent.new_joiners.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.recent.new_joiners.map((employee) => (
                  <li key={employee.id}>
                    <TeamPersonRow employee={employee} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No new joiners in this range.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent profile updates</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {data.recent.profile_updates.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.recent.profile_updates.map((update) => (
                  <li key={update.id}>
                    <Link
                      to={update.employee ? `/employees/${update.employee.id}` : '#'}
                      className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface-soft"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-strong">{update.employee?.full_name ?? 'Unknown employee'}</p>
                        <p className="text-xs text-muted">{formatDateTime(update.updated_at)}</p>
                      </div>
                      <StatusBadge status={update.completion_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No recent profile updates.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Direct reports</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {data.people.direct_reports.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.people.direct_reports.map((employee) => (
                  <li key={employee.id}>
                    <TeamPersonRow employee={employee} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No direct reports found.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {data.people.members.map((employee) => (
              <li key={employee.id}>
                <TeamPersonRow
                  employee={employee}
                  extra={<span className="text-xs text-muted">{employee.location?.name ?? employee.department?.name}</span>}
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
