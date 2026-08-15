import { AlertCircle, Briefcase, CalendarClock } from 'lucide-react';
import { useMyDashboard } from '@/features/dashboard/api';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function MyDashboardView() {
  const { data, isLoading, isError, error, refetch } = useMyDashboard();

  if (isLoading) return <LoadingState label="Loading your dashboard…" />;
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
      </div>
    </div>
  );
}
