import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, UserCheck, UserPlus, Users } from 'lucide-react';
import { useManagerDashboard } from '@/features/dashboard/api';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BreakdownList } from '@/components/ui/BreakdownList';
import { statusLabel } from '@/features/employees/statusHelpers';

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date);
}

export function ManagerDashboardView() {
  const { data, isLoading, isError, error, refetch } = useManagerDashboard();

  if (isLoading) return <LoadingState label="Loading manager dashboard…" fill />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  if (data.employees.total === 0) {
    return (
      <EmptyState
        title="No team members found"
        description="You don't have any direct reports or department assignments yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Team size" value={data.employees.total} icon={Users} />
        <StatTile label="Active" value={data.employees.active} tone="success" icon={UserCheck} />
        <StatTile label="Profiles pending" value={data.team_health.profiles_pending} icon={ClipboardList} />
        <StatTile label="Leave pending" value={data.leave.pending_requests} icon={CalendarClock} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Team by designation</CardTitle>
          </CardHeader>
          <CardBody>
            <BreakdownList
              entries={data.composition.by_designation.map((entry) => ({ label: entry.name, total: entry.total }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team by status</CardTitle>
          </CardHeader>
          <CardBody>
            <BreakdownList
              entries={data.composition.by_status.map((entry) => ({ label: statusLabel(entry.status), total: entry.total }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attendance today</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-semibold text-success">{data.attendance.present}</p>
              <p className="text-xs text-muted">Present</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-warning">{data.attendance.late}</p>
              <p className="text-xs text-muted">Late</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-danger">{data.attendance.absent}</p>
              <p className="text-xs text-muted">Absent</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
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
                    <Link
                      to={`/employees/${employee.id}`}
                      className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-soft"
                    >
                      <div>
                        <p className="font-medium text-strong">{employee.full_name}</p>
                        <p className="text-xs text-muted">{employee.employee_number}</p>
                      </div>
                      {employee.status && <StatusBadge status={employee.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No new joiners in this range.</p>
            )}
          </CardBody>
        </Card>

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
                      className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-soft"
                    >
                      <div>
                        <p className="font-medium text-strong">{update.employee?.full_name ?? 'Unknown employee'}</p>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {data.people.members.map((employee) => (
              <li key={employee.id}>
                <Link
                  to={`/employees/${employee.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-soft"
                >
                  <div>
                    <p className="font-medium text-strong">{employee.full_name}</p>
                    <p className="text-xs text-muted">{employee.employee_number}</p>
                  </div>
                  <span className="text-xs text-muted">{employee.department?.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
