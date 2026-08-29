import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Award, Briefcase, CalendarClock, FileWarning, PartyPopper, Timer } from 'lucide-react';
import { useMyDashboard } from '@/features/dashboard/api';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AreaTrendChart } from '@/components/ui/Charts';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { useToast } from '@/components/ui/Toast';
import { useAcknowledgeDocument } from '@/features/profile/api';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function MyDashboardView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [attendanceRange, setAttendanceRange] = useState({ dateFrom: '', dateTo: '' });
  const { data, isLoading, isError, error, refetch } = useMyDashboard({
    date_from: attendanceRange.dateFrom || undefined,
    date_to: attendanceRange.dateTo || undefined,
  });
  const { formatDate } = useDateFormatter();
  const acknowledgeDocumentMutation = useAcknowledgeDocument();

  async function handleAcknowledge(documentId: number) {
    try {
      await acknowledgeDocumentMutation.mutateAsync(documentId);
      toast.success('Document acknowledged');
      refetch();
    } catch (acknowledgeError) {
      toast.error('Could not acknowledge document', actionError(acknowledgeError, 'Could not acknowledge this document.'));
    }
  }

  const range = data?.attendance?.range;
  useEffect(() => {
    if (!attendanceRange.dateFrom && !attendanceRange.dateTo && range) {
      setAttendanceRange({ dateFrom: range.date_from, dateTo: range.date_to });
    }
  }, [attendanceRange, range]);

  if (isLoading) return <LoadingState label="Loading your dashboard…" fill />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  const hasExpired = data.document_compliance.some((row) => row.state === 'expired');

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

      {data.document_compliance.length > 0 && (
        <Card className={cn(hasExpired ? 'border-danger-bg bg-danger-bg/30' : 'border-warning-bg bg-warning-bg/30')}>
          <CardBody className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileWarning className={cn('h-4 w-4 flex-shrink-0', hasExpired ? 'text-danger' : 'text-warning')} />
                <span className={hasExpired ? 'text-danger' : 'text-warning'}>
                  {data.document_compliance.length} document{data.document_compliance.length === 1 ? '' : 's'} need{data.document_compliance.length === 1 ? 's' : ''} your attention
                </span>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/me/profile?tab=documents')}>
                Manage documents
              </Button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {data.document_compliance.map((row) => (
                <li key={row.requirement.id} className="flex items-center justify-between text-sm">
                  <span className="text-strong">{row.requirement.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {row.expires_at && `Expires ${formatDate(row.expires_at)}`}
                    <StatusBadge status={row.state} />
                    {row.state === 'pending_acknowledgment' && row.document_id && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        isLoading={acknowledgeDocumentMutation.isPending}
                        onClick={() => handleAcknowledge(row.document_id!)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
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
              <ul className="flex flex-col gap-3.5">
                {data.leave.balances.map((balance) => {
                  const pct = balance.days_allocated > 0
                    ? Math.min(100, Math.round((balance.days_available / balance.days_allocated) * 100))
                    : 0;
                  return (
                    <li key={balance.leave_type.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-strong">{balance.leave_type.name}</span>
                        <span className="text-muted">
                          {balance.days_available} / {balance.days_allocated} days available
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
                        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
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
            {data.attendance ? (
              <>
                <div className="grid grid-cols-4 gap-2 border-b border-border px-5 py-3.5 text-center">
                  <div>
                    <p className="font-display text-lg font-semibold text-strong">{data.attendance.this_month.present}</p>
                    <p className="text-[11px] text-muted">Present</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-strong">{data.attendance.this_month.late}</p>
                    <p className="text-[11px] text-muted">Late</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-strong">{data.attendance.this_month.absent}</p>
                    <p className="text-[11px] text-muted">Absent</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-strong">{data.attendance.this_month.total_hours}</p>
                    <p className="text-[11px] text-muted">Hours (mo.)</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 pt-4">
                  <p className="text-xs font-medium text-muted">Trend</p>
                  <DateRangePicker
                    dateFrom={attendanceRange.dateFrom}
                    dateTo={attendanceRange.dateTo}
                    onChange={({ dateFrom, dateTo }) => setAttendanceRange({ dateFrom, dateTo })}
                    className="w-auto"
                  />
                </div>
                <div className="px-5 py-4">
                  <AreaTrendChart
                    entries={data.attendance.trend.map((day) => ({
                      label: day.label,
                      value: day.value,
                    }))}
                    valueLabel="Hours"
                  />
                </div>
              </>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No attendance records yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-4 w-4" /> Coming up
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {data.tenure && (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal-light text-pine">
                  <Award className="h-4 w-4" />
                </span>
                <div className="text-sm">
                  <p className="font-medium text-strong">
                    {data.tenure.years_of_service} year{data.tenure.years_of_service === 1 ? '' : 's'} of service
                  </p>
                  <p className="text-xs text-muted">
                    Next anniversary {formatDate(data.tenure.next_anniversary)} &middot; in {data.tenure.days_until_anniversary} day{data.tenure.days_until_anniversary === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            )}
            {data.next_holiday && (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-teal-light text-pine">
                  <PartyPopper className="h-4 w-4" />
                </span>
                <div className="text-sm">
                  <p className="font-medium text-strong">{data.next_holiday.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(data.next_holiday.date)} &middot; in {data.next_holiday.days_away} day{data.next_holiday.days_away === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            )}
            {!data.tenure && !data.next_holiday && (
              <p className="text-sm text-muted">Nothing scheduled right now.</p>
            )}
            <div className="mt-auto flex gap-2 border-t border-border pt-3.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/me/leave')}>
                Request leave
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/me/profile')}>
                View profile
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
