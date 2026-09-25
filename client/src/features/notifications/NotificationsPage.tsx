import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { SEVERITY_DOT, timeAgo } from '@/components/shell/NotificationBell';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadNotificationCount,
  type NotificationEntry,
} from '@/features/notifications/api';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';

const STATUS_OPTIONS = [
  { value: '', label: 'All notifications' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const { formatDate } = useDateFormatter();
  const [status, setStatus] = useState<'' | 'read' | 'unread'>('');
  const [page, setPage] = useState(1);
  const unreadQuery = useUnreadNotificationCount();
  const notificationsQuery = useNotificationList({ status: status || undefined, page, per_page: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadQuery.data?.unread_count ?? 0;
  const notifications = notificationsQuery.data?.data ?? [];

  function handleSelect(notification: NotificationEntry) {
    if (!notification.read_at) {
      markRead.mutate(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Everything routed to you across approvals, leave, documents, and attendance."
        actions={
          unreadCount > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => markAllRead.mutate()} isLoading={markAllRead.isPending}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )
        }
      />

      <div className="mb-4 sm:w-52">
        <SelectMenu
          value={status}
          onChange={(value) => {
            setStatus(value as '' | 'read' | 'unread');
            setPage(1);
          }}
          options={STATUS_OPTIONS}
        />
      </div>

      {notificationsQuery.isLoading && <LoadingState label="Loading notifications..." fill />}
      {notificationsQuery.isError && <ErrorState error={notificationsQuery.error} onRetry={() => notificationsQuery.refetch()} />}

      {notificationsQuery.data && notifications.length === 0 && (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="You're all caught up." />
      )}

      {notifications.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {notifications.map((notification) => {
              const unread = !notification.read_at;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(notification)}
                    className={cn(
                      'flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-soft',
                      unread && 'bg-teal/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                        unread ? (SEVERITY_DOT[notification.severity] ?? 'bg-info') : 'bg-transparent',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn('truncate text-sm', unread ? 'font-semibold text-strong' : 'font-medium text-strong')}>
                          {notification.title ?? 'Notification'}
                        </span>
                        <span className="flex-shrink-0 text-xs text-muted">{timeAgo(notification.created_at, formatDate)}</span>
                      </span>
                      {notification.message && <span className="mt-1 block text-sm leading-5 text-muted">{notification.message}</span>}
                      {notification.action_label && (
                        <span className="mt-1.5 block text-xs font-medium text-teal">{notification.action_label} →</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {notificationsQuery.data && <Pagination meta={notificationsQuery.data.meta} onPageChange={setPage} />}
    </div>
  );
}
