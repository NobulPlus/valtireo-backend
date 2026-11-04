import { cn } from '@/lib/cn';

/**
 * A small colored dot for a SelectMenuOption's `icon` slot — gives a
 * dropdown's trigger and option rows a scannable visual identity without a
 * new control. Pass a `bg-*` tone class (success/warning/danger/info/draft,
 * for severity-style fields like priority or status) or a `bg-chart-*`
 * class (for purely categorical fields like item type or link target,
 * matching index.css's own "distinguish categories, not severities" intent
 * for the chart palette).
 */
export function OptionDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn('h-2 w-2 flex-shrink-0 rounded-full', className)} />;
}
