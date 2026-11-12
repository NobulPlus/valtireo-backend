import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/States';
import type { OrbitWorkItem } from '@/features/orbit/api';

export function OrbitSimpleTaskList({
  items,
  canEdit,
  onOpenItem,
  onComplete,
  onReopen,
}: {
  items: OrbitWorkItem[];
  canEdit: boolean;
  onOpenItem: (key: string) => void;
  onComplete: (item: OrbitWorkItem) => void;
  onReopen: (item: OrbitWorkItem) => void;
}) {
  if (items.length === 0) {
    return <EmptyState title="No tasks yet" description="Add a task to get started." />;
  }

  const sorted = [...items].sort((a, b) => Number(a.position) - Number(b.position));

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {sorted.map((item) => {
        const isDone = item.status?.category === 'done';

        return (
          <li key={item.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => onOpenItem(item.key)} className="min-w-0 flex-1 text-left">
              <p className={isDone ? 'truncate font-medium text-muted line-through' : 'truncate font-medium text-strong'}>
                <span className="mr-1 text-xs text-muted">{item.key}</span>
                {item.title}
              </p>
              {item.assignee && <p className="mt-0.5 text-xs text-muted">{item.assignee.name}</p>}
            </button>

            <div className="flex flex-shrink-0 items-center gap-2">
              <PriorityBadge priority={item.priority} />
              <StatusBadge status={item.status?.category} />
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={isDone ? `Reopen ${item.key}` : `Mark ${item.key} done`}
                  title={isDone ? 'Reopen' : 'Mark done'}
                  onClick={() => (isDone ? onReopen(item) : onComplete(item))}
                >
                  {isDone ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
