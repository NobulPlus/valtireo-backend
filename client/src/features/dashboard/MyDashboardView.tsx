import { AlertCircle, Blocks, Briefcase, CalendarClock, Timer } from 'lucide-react';
import { useMyDashboard } from '@/features/dashboard/api';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';

function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(value: string): string {
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(`${dateOnly ? dateOnly[1] : value}T00:00:00`),
  );
}

export function MyDashboardView() {
  const { data, isLoading, isError, error, refetch } = useMyDashboard();

  if (isLoading) return <LoadingState label="Loading your dashboard…" fill />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      {data.pending_actions.length > 0 && (
        <Card className="border-pending-bg bg-pending-bg/30">
          <CardBody className="flex flex-col gap-2">
            {data.pending_actions.map((action) => (
              <div key={action.key} className="flex items-center gap-2 text-sm text-pending">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {action.label}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> My employment
            </CardTitle>
          </CardHeader>
          <CardBody>
            {data.employee ? (
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted">Employee number</dt>
                <dd className="text-right font-medium text-strong">{data.employee.employee_number}</dd>
                <dt className="text-muted">Department</dt>
                <dd className="text-right font-medium text-strong">
                  {data.work?.department?.name ?? '—'}
                </dd>
                <dt className="text-muted">Designation</dt>
                <dd className="text-right font-medium text-strong">
                  {data.work?.designation?.name ?? '—'}
                </dd>
                <dt className="text-muted">Reporting manager</dt>
                <dd className="text-right font-medium text-strong">
                  {data.work?.reporting_manager?.full_name ?? '—'}
                </dd>
                <dt className="text-muted">Profile status</dt>
                <dd className="text-right">
                  {data.profile ? <StatusBadge status={data.profile.completion_status} /> : '—'}
                </dd>
              </dl>
            ) : (
              <p className="text-sm text-muted">No employee record is linked to your account yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Leave balance
            </CardTitle>
            {data.leave && (data.leave.pending_requests > 0 || data.leave.approved_requests > 0) && (
              <p className="text-xs text-muted">
                {data.leave.pending_requests} pending &middot; {data.leave.approved_requests} approved
              </p>
            )}
          </CardHeader>
          <CardBody>
            {data.leave && data.leave.balances.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {data.leave.balances.map((balance) => (
                  <li key={balance.leave_type.id} className="flex items-center justify-between text-sm">
                    <span className="text-strong">{balance.leave_type.name}</span>
                    <span className="text-muted">
                      {balance.days_available} / {balance.days_allocated} days available
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No leave entitlements set up yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-4 w-4" /> My attendance
            </CardTitle>
            {data.attendance && data.attendance.corrections_pending > 0 && (
              <p className="text-xs text-muted">{data.attendance.corrections_pending} correction(s) pending</p>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {data.attendance && data.attendance.recent_records.length > 0 ? (
              <ul className="divide-y divide-border">
                {data.attendance.recent_records.map((record) => (
                  <li key={record.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-strong">{formatDate(record.attendance_date)}</span>
                    <span className="text-muted">
                      {formatTime(record.check_in_at)} → {formatTime(record.check_out_at)}
                    </span>
                    <StatusBadge status={record.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No attendance records yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Blocks className="h-4 w-4" /> My modules
            </CardTitle>
          </CardHeader>
          <CardBody>
            {data.modules.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {data.modules.map((module) => (
                  <li
                    key={module.key}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium',
                      module.can_access ? 'bg-teal-light text-pine' : 'bg-surface-soft text-muted',
                    )}
                    title={module.description ?? undefined}
                  >
                    {module.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No modules assigned yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
