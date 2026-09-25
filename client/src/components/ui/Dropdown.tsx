import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DropdownProps {
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
}

/** A trigger + floating menu panel with outside-click and Escape handling. */
export function Dropdown({ trigger, children, align = 'right', panelClassName }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open && (
        <div
          className={cn(
            'absolute z-20 mt-2 min-w-[190px] rounded-md border border-border bg-surface py-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  icon: Icon,
  className,
  children,
  ...props
}: { icon?: LucideIcon; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-strong transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 text-muted" />}
      {children}
    </button>
  );
}
