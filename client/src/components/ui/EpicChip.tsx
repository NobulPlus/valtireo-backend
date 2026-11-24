import { Layers } from 'lucide-react';
import { cn } from '@/lib/cn';

export function EpicChip({ epic, className }: { epic?: { key: string; title: string } | null; className?: string }) {
  if (!epic) return null;

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full bg-teal-light px-2 py-0.5 text-xs font-medium text-pine', className)}>
      <Layers className="h-3 w-3 flex-shrink-0" />
      <span className="truncate">{epic.key} · {epic.title}</span>
    </span>
  );
}
