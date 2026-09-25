import { cn } from '@/lib/cn';
import { toneClasses, type Tone } from '@/components/ui/StatusBadge';

const PRIORITY_TONE: Record<string, Tone> = {
  low: 'draft',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export function PriorityBadge({ priority, className }: { priority?: string | null; className?: string }) {
  const tone = priority ? PRIORITY_TONE[priority] ?? 'draft' : 'draft';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        toneClasses[tone],
        className,
      )}
    >
      {priority ?? 'Unknown'}
    </span>
  );
}
