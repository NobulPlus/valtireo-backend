import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { todayInZone } from '../../lib/calendarDate';
import { pagedResource } from '../../lib/pagedResource';
import type { CompanyEvent, LeaveHoliday, LeaveRequest } from '../../types/api';

function useMyLeaveRequestsAll(limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ['leave', 'requests', 'mine', 'calendar', limit],
    queryFn: () => pagedResource<LeaveRequest>('/leave/requests', limit),
    enabled,
  });
}

function useCompanyEvents(dateFrom: string, limit: number) {
  return useQuery({
    queryKey: ['company-events', dateFrom, limit],
    queryFn: () => pagedResource<CompanyEvent>('/company-events', limit, { date_from: dateFrom }),
  });
}

const PAGE_SIZE = 100;

export type AgendaItem = {
  key: string;
  kind: 'holiday' | 'event' | 'leave';
  date: string;
  endDate: string;
  title: string;
  subtitle: string | null;
};

const ACTIVE_LEAVE_STATUSES = new Set(['pending', 'approved']);

/** Combines company events, holidays and the employee's own leave into one sorted, upcoming-only agenda. */
export function useAgenda() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { session, moduleByKey } = useAuth();
  const leaveEnabled = moduleByKey('leave')?.can_access === true;
  const today = todayInZone(session?.workspace?.localization.timezone ?? 'Africa/Lagos');
  const eventsQuery = useCompanyEvents(today, limit);
  const holidaysQuery = useQuery({ queryKey: ['leave', 'holidays', 'calendar', limit], queryFn: () => pagedResource<LeaveHoliday>('/leave/holidays', limit, { is_active: true }), enabled: leaveEnabled });
  const leaveQuery = useMyLeaveRequestsAll(limit, leaveEnabled);

  const totalAvailable = Math.max(eventsQuery.data?.meta.total ?? 0, leaveEnabled ? leaveQuery.data?.meta.total ?? 0 : 0, leaveEnabled ? holidaysQuery.data?.meta.total ?? 0 : 0);
  const canLoadMore = totalAvailable > limit;

  const isLoading = eventsQuery.isLoading || holidaysQuery.isLoading || leaveQuery.isLoading;
  const isError = eventsQuery.isError || holidaysQuery.isError || leaveQuery.isError;
  const isRefetching = eventsQuery.isRefetching || holidaysQuery.isRefetching || leaveQuery.isRefetching;

  function refetch() {
    void eventsQuery.refetch();
    if (leaveEnabled) { void holidaysQuery.refetch(); void leaveQuery.refetch(); }
  }

  const items: AgendaItem[] = [];

  for (const holiday of leaveEnabled ? holidaysQuery.data?.data ?? [] : []) {
    if (holiday.date >= today) {
      items.push({ key: `holiday-${holiday.id}`, kind: 'holiday', date: holiday.date, endDate: holiday.date, title: holiday.name, subtitle: holiday.location?.name ?? 'All locations' });
    }
  }

  for (const event of eventsQuery.data?.data ?? []) {
    items.push({ key: `event-${event.id}`, kind: 'event', date: event.starts_on, endDate: event.ends_on, title: event.title, subtitle: event.department?.name ?? 'Organization-wide' });
  }

  for (const leave of leaveEnabled ? leaveQuery.data?.data ?? [] : []) {
    if (ACTIVE_LEAVE_STATUSES.has(leave.status) && leave.ends_on >= today) {
      items.push({
        key: `leave-${leave.id}`,
        kind: 'leave',
        date: leave.starts_on,
        endDate: leave.ends_on,
        title: `${leave.leave_type?.name ?? 'Leave'} (${leave.status})`,
        subtitle: `${leave.total_days} day(s)`,
      });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  return { items, isLoading, isError, isRefetching, refetch, canLoadMore, loadMore: () => setLimit((current) => current + PAGE_SIZE) };
}
