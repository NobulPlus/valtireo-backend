import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmptyState, LoadingState } from '@/components/ui/States';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
  type NotificationEntry,
} from '@/features/notifications/api';

export const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString();
}

function NotificationRow({ notification, onRead }: { notification: NotificationEntry; onRead: (notification: NotificationEntry) => void }) {
  const unread = !notification.read_at;

  return (
    <button
      type="button"
      onClick={() => onRead(notification)}
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-soft',
        unread && 'bg-teal/5',
      )}
    >
      <span className={cn('mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full', unread ? (SEVERITY_DOT[notification.severity] ?? 'bg-info') : 'bg-transparent')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px]', unread ? 'font-semibold text-strong' : 'font-medium text-strong')}>
          {notification.title ?? 'Notification'}
        </span>
        {notification.message && <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted">{notification.message}</span>}
        <span className="mt-1 block text-[11px] text-muted">{timeAgo(notification.created_at)}</span>
      </span>
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unreadQuery = useUnreadNotificationCount();
  const notificationsQuery = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadQuery.data?.unread_count ?? 0;
  const notifications = notificationsQuery.data?.data ?? [];

  function handleSelect(notification: NotificationEntry) {
    if (!notification.read_at) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-strong"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold text-strong">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notificationsQuery.isLoading ? (
                <div className="p-4">
                  <LoadingState label="Loading notifications..." />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No notifications yet" description="You're all caught up." />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <NotificationRow key={notification.id} notification={notification} onRead={handleSelect} />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="block w-full border-t border-border px-3 py-2.5 text-center text-xs font-medium text-teal hover:bg-surface-soft hover:underline"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}
