import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useMyOrbitWork } from '@/features/orbit/api';

const FILTERS: { value: string; label: string }[] = [
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'watched', label: 'Watching' },
  { value: 'mentioned', label: 'Mentioned' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_soon', label: 'Due soon' },
];

export function OrbitMyWorkPage() {
  const [filter, setFilter] = useState('assigned');
  const { data, isLoading, isError, error, refetch } = useMyOrbitWork(filter);
  const items = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="My Work"
        subtitle="Work items assigned to you, watched, mentioned in, or coming due."
        actions={
          <Link to="/orbit/workspaces" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-strong hover:bg-surface-soft">
            <LayoutGrid className="h-3.5 w-3.5" /> Workspaces
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === item.value ? 'bg-pine text-white' : 'bg-surface-soft text-muted hover:text-strong'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading && <LoadingState fill />}
        {isError && <ErrorState error={error} onRetry={refetch} />}
        {!isLoading && !isError && items.length === 0 && (
          <EmptyState title="Nothing here" description="Nothing matches this view right now." />
        )}
        {!isLoading && !isError && items.length > 0 && (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/orbit/projects/${item.project?.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-soft"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-strong">
                      <span className="text-muted">{item.key}</span> {item.title}
                    </p>
                    <p className="text-xs text-muted">{item.project?.name}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    {item.due_at && <span className="text-xs text-muted">Due {item.due_at}</span>}
                    <PriorityBadge priority={item.priority} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
