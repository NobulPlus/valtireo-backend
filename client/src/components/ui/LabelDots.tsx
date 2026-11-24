import { cn } from '@/lib/cn';

interface LabelDotsLabel {
  id: number;
  name: string;
  color: string;
}

export function LabelDots({ labels, max = 3, className }: { labels?: LabelDotsLabel[]; max?: number; className?: string }) {
  if (!labels || labels.length === 0) return null;

  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;

  return (
    <div className={cn('flex items-center gap-1', className)} title={labels.map((label) => label.name).join(', ')}>
      {visible.map((label) => (
        <span key={label.id} className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
      ))}
      {overflow > 0 && <span className="text-[10px] font-medium text-muted">+{overflow}</span>}
    </div>
  );
}
