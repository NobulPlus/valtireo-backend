import { Calendar } from 'lucide-react';
import { cn } from '@/lib/cn';
import { toneClasses } from '@/components/ui/StatusBadge';
import { useDateFormatter } from '@/lib/dateFormat';

/** Days between a bare 'YYYY-MM-DD' due date and today, parsed without going through Date's timezone shift. */
function daysUntil(dueAt: string): number | null {
  const match = dueAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Plain muted text for a normal due date — only turns into a colored chip
 * once it's overdue or within 2 days, matching the "due soon" window the
 * backend's /my-work?filter=due_soon already uses, so the visual cue and
 * the filter mean the same thing.
 */
export function DueDateChip({ dueAt, className }: { dueAt?: string | null; className?: string }) {
  const { formatDate } = useDateFormatter();
  if (!dueAt) return null;

  const diffDays = daysUntil(dueAt);
  if (diffDays === null) return null;

  if (diffDays > 2) {
    return <span className={cn('text-xs text-muted', className)}>Due {formatDate(dueAt)}</span>;
  }

  const tone = diffDays < 0 ? 'danger' : 'warning';
  const label =
    diffDays < 0
      ? `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`
      : diffDays === 0
        ? 'Due today'
        : diffDays === 1
          ? 'Due tomorrow'
          : `Due ${formatDate(dueAt)}`;

  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', toneClasses[tone], className)}>
      <Calendar className="h-3 w-3" />
      {label}
    </span>
  );
}
