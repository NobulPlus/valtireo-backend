import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, UserCheck, Users } from 'lucide-react';
import { useManagerDashboard } from '@/features/dashboard/api';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { BreakdownList } from '@/components/ui/BreakdownList';

export function ManagerDashboardView() {
  const { data, isLoading, isError, error, refetch } = useManagerDashboard();

  if (isLoading) return <LoadingState label="Loading manager dashboard…" />;
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
