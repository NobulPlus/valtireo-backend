import { useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Pencil,
  Plus,
  Search,
  Trash2,
  Umbrella,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import {
  useCompanyEvents,
  useCreateCompanyEvent,
  useDeleteCompanyEvent,
  useUpdateCompanyEvent,
  type CompanyEventPayload,
} from '@/features/calendar/api';
import { useLeaveHolidays, useMyLeaveRequests } from '@/features/leave/api';
import { useMyProfileOverview } from '@/features/profile/api';
import { useSetupLookups } from '@/features/workspace/api';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';
import type { CompanyEvent } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(date);
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isBetween(date: string, startsOn: string, endsOn: string): boolean {
  const current = date.slice(0, 10);
  return current >= startsOn.slice(0, 10) && current <= endsOn.slice(0, 10);
}

type CalendarView = 'month' | 'week';

type CalendarItem =
  | {
      kind: 'event';
      id: string;
      date: string;
      endDate: string;
      title: string;
      note: string | null;
      tone: 'teal' | 'blue';
      event: CompanyEvent;
    }
  | {
      kind: 'holiday';
      id: string;
      date: string;
      endDate: string;
      title: string;
      note: string | null;
      tone: 'amber';
    }
  | {
      kind: 'leave';
      id: string;
      date: string;
      endDate: string;
      title: string;
      note: string | null;
      tone: 'purple';
    };

const toneClasses: Record<CalendarItem['tone'], { dot: string; pill: string; soft: string; border: string }> = {
  teal: {
    dot: 'bg-teal',
    pill: 'bg-teal/10 text-teal',
    soft: 'bg-teal/5',
    border: 'border-teal/30',
  },
  blue: {
    dot: 'bg-blue-600',
    pill: 'bg-blue-50 text-blue-700',
    soft: 'bg-blue-50/70',
    border: 'border-blue-200',
  },
  amber: {
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700',
    soft: 'bg-amber-50/80',
    border: 'border-amber-200',
  },
  purple: {
    dot: 'bg-purple-500',
    pill: 'bg-purple-50 text-purple-700',
    soft: 'bg-purple-50/80',
    border: 'border-purple-200',
  },
};

function EventFormModal({
  event,
  canManageOrgWide,
  departmentOptions,
  onClose,
}: {
  event: CompanyEvent | 'new' | null;
  canManageOrgWide: boolean;
  departmentOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
}) {
  const toast = useToast();
  const isNew = event === 'new';
  const createMutation = useCreateCompanyEvent();
  const updateMutation = useUpdateCompanyEvent(event && event !== 'new' ? event.id : 0);
  const mutation = isNew ? createMutation : updateMutation;

  const [title, setTitle] = useState(event && event !== 'new' ? event.title : '');
  const [description, setDescription] = useState(event && event !== 'new' ? (event.description ?? '') : '');
  const [startsOn, setStartsOn] = useState(event && event !== 'new' ? event.starts_on.slice(0, 10) : '');
  const [endsOn, setEndsOn] = useState(event && event !== 'new' ? event.ends_on.slice(0, 10) : '');
  const [scope, setScope] = useState(event && event !== 'new' && event.department_id ? String(event.department_id) : '');

  const scopeOptions = [
    ...(canManageOrgWide ? [{ value: '', label: 'Entire organization' }] : []),
    ...departmentOptions,
  ];

  async function handleSubmit() {
    if (!title.trim() || !startsOn || !endsOn) return;
    const payload: CompanyEventPayload = {
      title: title.trim(),
      description: description.trim() || null,
      starts_on: startsOn,
      ends_on: endsOn,
      department_id: scope ? Number(scope) : null,
    };
    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success('Event created');
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('Event updated');
      }
      onClose();
    } catch (error) {
      toast.error('Could not save event', actionError(error, 'Could not save this event.'));
    }
  }

  return (
    <Modal
      open={event !== null}
      onClose={onClose}
      title={isNew ? 'Create event' : 'Edit event'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Save" isLoading={mutation.isPending} disabled={!title.trim() || !startsOn || !endsOn} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Title</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Town hall meeting" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Description</span>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional details" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Starts on</span>
            <DatePicker value={startsOn} onChange={setStartsOn} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Ends on</span>
            <DatePicker value={endsOn} onChange={setEndsOn} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Visible to</span>
          <SelectMenu value={scope} onChange={setScope} options={scopeOptions} placeholder="Select scope" />
        </label>
      </div>
    </Modal>
  );
}

function DeleteEventModal({ event, onClose }: { event: CompanyEvent | null; onClose: () => void }) {
  const toast = useToast();
  const deleteMutation = useDeleteCompanyEvent(event?.id ?? 0);

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync();
      toast.success('Event removed');
      onClose();
    } catch (error) {
      toast.error('Could not remove event', actionError(error, 'Could not remove this event.'));
    }
  }

  return (
    <Modal
      open={event !== null}
      onClose={onClose}
      title="Remove event"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Remove" variant="danger" isLoading={deleteMutation.isPending} onClick={handleDelete} />
        </>
      }
    >
      <p className="text-sm text-muted">
        This removes <span className="font-medium text-strong">{event?.title}</span> from the calendar. This cannot be undone.
      </p>
    </Modal>
  );
}

function ItemIcon({ kind }: { kind: CalendarItem['kind'] }) {
  if (kind === 'holiday') return <Umbrella className="h-3.5 w-3.5" />;
  if (kind === 'leave') return <CalendarClock className="h-3.5 w-3.5" />;
  return <BriefcaseBusiness className="h-3.5 w-3.5" />;
}

function CalendarContent() {
  const { hasPermission, moduleByKey, session, workspaceMode } = useAuth();
  const { formatDate } = useDateFormatter();
  const profileQuery = useMyProfileOverview();

  const [view, setView] = useState<CalendarView>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateOnly(new Date()));
  const [search, setSearch] = useState('');
  const [editingEvent, setEditingEvent] = useState<CompanyEvent | 'new' | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CompanyEvent | null>(null);

  const today = toDateOnly(new Date());
  const gridStart = useMemo(() => startOfWeek(visibleMonth), [visibleMonth]);
  const gridEnd = useMemo(() => addDays(gridStart, 41), [gridStart]);
  const weekStart = useMemo(() => startOfWeek(parseDateOnly(selectedDate)), [selectedDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const rangeStart = view === 'month' ? gridStart : weekStart;
  const rangeEnd = view === 'month' ? gridEnd : weekEnd;
  const dateFrom = toDateOnly(rangeStart);
  const dateTo = toDateOnly(rangeEnd);
  const leaveEnabled = Boolean(moduleByKey('leave'));

  const eventsQuery = useCompanyEvents({ date_from: dateFrom, date_to: dateTo });
  const holidaysQuery = useLeaveHolidays({ enabled: leaveEnabled });
  const leaveQuery = useMyLeaveRequests({ enabled: leaveEnabled });
  const lookupsQuery = useSetupLookups();

  const myEmployeeId = profileQuery.data?.employee?.id ?? null;
  const canManageOrgWide = hasPermission('company_events.manage');
  const myDepartments = (lookupsQuery.data?.departments ?? []).filter((department) => department.head_employee_id === myEmployeeId);
  const canCreateAnything = canManageOrgWide || myDepartments.length > 0;
  const departmentOptions = (canManageOrgWide ? (lookupsQuery.data?.departments ?? []) : myDepartments).map((department) => ({
    value: String(department.id),
    label: department.name,
  }));

  const days = useMemo(() => {
    const length = view === 'month' ? 42 : 7;
    const start = view === 'month' ? gridStart : weekStart;
    return Array.from({ length }, (_, index) => addDays(start, index));
  }, [gridStart, view, weekStart]);

  const items = useMemo<CalendarItem[]>(() => {
    const eventItems: CalendarItem[] = (eventsQuery.data?.data ?? []).map((event) => ({
      kind: 'event',
      id: `event-${event.id}`,
      date: event.starts_on.slice(0, 10),
      endDate: event.ends_on.slice(0, 10),
      title: event.title,
      note: event.description,
      tone: event.scope === 'organization' ? 'teal' : 'blue',
      event,
    }));

    const holidayItems: CalendarItem[] = (holidaysQuery.data?.data ?? [])
      .filter((holiday) => holiday.date.slice(0, 10) >= dateFrom && holiday.date.slice(0, 10) <= dateTo)
      .map((holiday) => ({
        kind: 'holiday',
        id: `holiday-${holiday.id}`,
        date: holiday.date.slice(0, 10),
        endDate: holiday.date.slice(0, 10),
        title: holiday.name,
        note: holiday.location ? holiday.location.name : null,
        tone: 'amber',
      }));

    const leaveItems: CalendarItem[] = (leaveQuery.data?.data ?? [])
      .filter((leave) => ['submitted', 'pending', 'approved'].includes(leave.status))
      .filter((leave) => leave.ends_on.slice(0, 10) >= dateFrom && leave.starts_on.slice(0, 10) <= dateTo)
      .map((leave) => ({
        kind: 'leave',
        id: `leave-${leave.id}`,
        date: leave.starts_on.slice(0, 10),
        endDate: leave.ends_on.slice(0, 10),
        title: leave.leave_type?.name ?? 'My leave',
        note: leave.status,
        tone: 'purple',
      }));

    return [...eventItems, ...holidayItems, ...leaveItems].sort((first, second) => {
      const dateSort = first.date.localeCompare(second.date);
      return dateSort === 0 ? first.title.localeCompare(second.title) : dateSort;
    });
  }, [dateFrom, dateTo, eventsQuery.data?.data, holidaysQuery.data?.data, leaveQuery.data?.data]);

  const filteredItems = items.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${item.title} ${item.note ?? ''} ${item.kind}`.toLowerCase().includes(term);
  });

  const selectedItems = filteredItems.filter((item) => isBetween(selectedDate, item.date, item.endDate));
  const upcomingItems = filteredItems.filter((item) => item.endDate >= today).slice(0, 6);
  const thisWeekCount = filteredItems.filter((item) => item.endDate >= toDateOnly(weekStart) && item.date <= toDateOnly(weekEnd)).length;
  const isLoading = eventsQuery.isLoading || holidaysQuery.isLoading || leaveQuery.isLoading;
  const isError = eventsQuery.isError || holidaysQuery.isError || leaveQuery.isError;
  const modeLabel = workspaceMode === 'employee' ? 'My calendar' : 'Workspace calendar';
  const selectedDateLabel = formatDate(selectedDate);
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function goToToday() {
    const now = new Date();
    setVisibleMonth(startOfMonth(now));
    setSelectedDate(toDateOnly(now));
  }

  function moveRange(direction: -1 | 1) {
    if (view === 'month') {
      const next = addMonths(visibleMonth, direction);
      setVisibleMonth(next);
      setSelectedDate(toDateOnly(next));
      return;
    }

    const next = addDays(parseDateOnly(selectedDate), direction * 7);
    setSelectedDate(toDateOnly(next));
    setVisibleMonth(startOfMonth(next));
  }

  return (
    <div>
      <PageHeader
        title={modeLabel}
        subtitle={`${session?.organization?.name ?? 'Organization'} events, holidays, and personal leave in one view.`}
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={goToToday}>
              <Clock3 className="h-3.5 w-3.5" /> Today
            </Button>
            {canCreateAnything && (
              <Button type="button" variant="primary" onClick={() => setEditingEvent('new')}>
                <Plus className="h-3.5 w-3.5" /> Create event
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Selected day</p>
              <p className="mt-1 font-display text-xl font-semibold text-strong">{selectedDateLabel}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-muted" />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">This week</p>
              <p className="mt-1 font-display text-xl font-semibold text-strong">{thisWeekCount}</p>
            </div>
            <CircleDot className="h-5 w-5 text-muted" />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Upcoming</p>
              <p className="mt-1 font-display text-xl font-semibold text-strong">{upcomingItems.length}</p>
            </div>
            <CalendarClock className="h-5 w-5 text-muted" />
          </CardBody>
        </Card>
      </div>

      <Card className="mb-5">
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="secondary" onClick={() => moveRange(-1)} aria-label="Previous calendar range">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[180px] text-center">
                <p className="font-display text-lg font-semibold text-strong">{view === 'month' ? monthLabel : `${formatDate(toDateOnly(weekStart))} - ${formatDate(toDateOnly(weekEnd))}`}</p>
                <p className="text-xs text-muted">{view === 'month' ? 'Month view' : 'Week view'}</p>
              </div>
              <Button type="button" size="icon" variant="secondary" onClick={() => moveRange(1)} aria-label="Next calendar range">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-md border border-border bg-surface p-1">
                {(['month', 'week'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    className={cn(
                      'h-7 rounded px-3 text-xs font-medium capitalize transition-colors',
                      view === option ? 'bg-pine text-white' : 'text-muted hover:bg-surface-soft hover:text-strong',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <Input className="min-w-[220px] pl-9 pr-9" placeholder="Search calendar" value={search} onChange={(event) => setSearch(event.target.value)} />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-surface-soft hover:text-strong"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {isLoading && <LoadingState label="Loading calendar..." />}
          {isError && <ErrorState error={eventsQuery.error ?? holidaysQuery.error ?? leaveQuery.error} onRetry={() => { eventsQuery.refetch(); holidaysQuery.refetch(); leaveQuery.refetch(); }} />}

          {!isLoading && !isError && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-hidden rounded-md border border-border bg-surface">
                <div className="grid grid-cols-7 border-b border-border bg-surface-soft">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-[11px] font-semibold uppercase text-muted">
                      {day}
                    </div>
                  ))}
                </div>
                <div className={cn('grid grid-cols-7', view === 'month' ? 'auto-rows-[128px]' : 'auto-rows-[220px]')}>
                  {days.map((day) => {
                    const iso = toDateOnly(day);
                    const dayItems = filteredItems.filter((item) => isBetween(iso, item.date, item.endDate));
                    const isToday = iso === today;
                    const isSelected = iso === selectedDate;
                    const isOutsideMonth = day.getMonth() !== visibleMonth.getMonth();

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => {
                          setSelectedDate(iso);
                          setVisibleMonth(startOfMonth(day));
                        }}
                        className={cn(
                          'min-w-0 border-b border-r border-border p-2 text-left transition-colors hover:bg-surface-soft',
                          isSelected && 'bg-teal/5 ring-1 ring-inset ring-teal/40',
                          isOutsideMonth && view === 'month' && 'bg-surface-soft/45 text-muted',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                              isToday ? 'bg-pine text-white' : isSelected ? 'bg-teal/10 text-teal' : 'text-strong',
                            )}
                          >
                            {day.getDate()}
                          </span>
                          {dayItems.length > 3 && <span className="text-[11px] font-medium text-muted">+{dayItems.length - 3}</span>}
                        </div>
                        <div className="space-y-1">
                          {dayItems.slice(0, view === 'month' ? 3 : 7).map((item) => (
                            <div key={`${iso}-${item.id}`} className={cn('truncate rounded border px-2 py-1 text-[11px] font-medium', toneClasses[item.tone].soft, toneClasses[item.tone].border)}>
                              {item.title}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardBody>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-strong">{selectedDateLabel}</h2>
                        <p className="text-xs text-muted">{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    {selectedItems.length === 0 ? (
                      <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nothing scheduled" description="This day is clear." />
                    ) : (
                      <div className="space-y-2">
                        {selectedItems.map((item) => (
                          <div key={item.id} className={cn('rounded-md border p-3', toneClasses[item.tone].border, toneClasses[item.tone].soft)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn('h-2 w-2 rounded-full', toneClasses[item.tone].dot)} />
                                  <p className="truncate text-sm font-semibold text-strong">{item.title}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted">
                                  {formatDate(item.date)}
                                  {item.date !== item.endDate && ` - ${formatDate(item.endDate)}`}
                                  {item.note && ` · ${item.note}`}
                                </p>
                              </div>
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', toneClasses[item.tone].pill)}>
                                <ItemIcon kind={item.kind} /> {item.kind}
                              </span>
                            </div>
                            {item.kind === 'event' && item.event.can_manage && (
                              <div className="mt-3 flex justify-end gap-2">
                                <Button type="button" size="icon" title="Edit" aria-label="Edit" onClick={() => setEditingEvent(item.event)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button type="button" size="icon" title="Remove" aria-label="Remove" onClick={() => setDeletingEvent(item.event)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <h2 className="mb-3 text-sm font-semibold text-strong">Upcoming</h2>
                    {upcomingItems.length === 0 ? (
                      <p className="text-sm text-muted">No upcoming calendar items.</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedDate(item.date);
                              setVisibleMonth(startOfMonth(parseDateOnly(item.date)));
                            }}
                            className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-surface-soft"
                          >
                            <span className={cn('mt-1 h-2.5 w-2.5 rounded-full', toneClasses[item.tone].dot)} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-strong">{item.title}</span>
                              <span className="block text-xs text-muted">{formatDate(item.date)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <EventFormModal
        event={editingEvent}
        canManageOrgWide={canManageOrgWide}
        departmentOptions={departmentOptions}
        onClose={() => setEditingEvent(null)}
      />
      <DeleteEventModal event={deletingEvent} onClose={() => setDeletingEvent(null)} />
    </div>
  );
}

export function CalendarPage() {
  return <CalendarContent />;
}
