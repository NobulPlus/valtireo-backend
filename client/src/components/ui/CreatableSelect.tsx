import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CreatableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 8;
const MAX_MENU_HEIGHT = 224;

function computePosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;

  if (spaceBelow < MAX_MENU_HEIGHT && spaceAbove > spaceBelow) {
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MAX_MENU_HEIGHT, spaceAbove),
    };
  }

  return {
    top: rect.bottom + GAP,
    left: rect.left,
    width: rect.width,
    maxHeight: Math.min(MAX_MENU_HEIGHT, Math.max(spaceBelow, 120)),
  };
}

/**
 * A free-text input with filtered suggestions. There's no separate "create"
 * step — whatever is typed is the value, and clicking a suggestion just
 * fills it in, so picking a preset and typing a new one both just work.
 */
export function CreatableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Type or choose...',
  className,
  invalid,
  disabled,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, value]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const trigger = triggerRef.current;

    function reposition() {
      setPosition(computePosition(trigger));
    }

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
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
    <div ref={triggerRef} className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface px-3 pr-8 text-sm text-strong placeholder:text-muted focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:bg-surface-soft disabled:text-muted',
          invalid && 'border-danger focus:ring-danger/20',
        )}
      />
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 h-4 w-4 flex-shrink-0 -translate-y-1/2 text-muted transition-transform',
          open && 'rotate-180',
        )}
      />

      {open &&
        !disabled &&
        position &&
        filtered.length > 0 &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="z-[60] overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-xl"
          >
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={cn(
                  'block w-full truncate rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  option === value ? 'bg-teal/10 text-strong' : 'text-strong hover:bg-surface-soft',
                )}
              >
                {option}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
