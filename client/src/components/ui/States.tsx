import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-soft px-6 py-14 text-center">
      <div className="mb-1 text-muted">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm font-medium text-strong">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

/** Renders a permission-denied (403) panel with calm, specific copy. */
export function ForbiddenState({ description }: { description?: string }) {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-6 w-6" />}
      title="You don't have permission to view this"
      description={description ?? 'Ask a workspace admin if you believe you should have access.'}
    />
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && error.status === 403) {
    return <ForbiddenState description={error.message} />;
  }
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="Not found" description="This record could not be found." />;
  }

  const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger-bg bg-danger-bg/40 px-6 py-14 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm font-medium text-strong">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
