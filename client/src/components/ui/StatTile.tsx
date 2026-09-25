import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClasses = {
    default: 'text-strong',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted" />}
      </div>
      <p className={cn('mt-1.5 font-display text-2xl font-semibold', toneClasses)}>{value}</p>
    </div>
  );
}
