import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectMenuOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Small leading visual (e.g. a flag) shown before the label, in both the trigger and the option row. */
  icon?: ReactNode;
}

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
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
const MIN_WIDTH = 220;
const MAX_MENU_HEIGHT = 256;
/** Lists shorter than this stay a plain scroll list; at/above it, a filter box appears. */
const SEARCH_THRESHOLD = 10;

function computePosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(rect.width, MIN_WIDTH);
  const spaceBelow = window.innerHeight - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;

  if (spaceBelow < MAX_MENU_HEIGHT && spaceAbove > spaceBelow) {
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left: rect.left,
      width,
      maxHeight: Math.min(MAX_MENU_HEIGHT, spaceAbove),
    };
  }

  return {
    top: rect.bottom + GAP,
    left: rect.left,
    width,
    maxHeight: Math.min(MAX_MENU_HEIGHT, Math.max(spaceBelow, 120)),
  };
}

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  className,
  invalid,
  disabled,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const searchable = options.length >= SEARCH_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

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

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  function select(value: string) {
    onChange(value);
    setOpen(false);
  }

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-white px-3 text-left text-sm text-strong shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:bg-surface-soft disabled:text-muted',
          invalid && 'border-danger focus-visible:outline-danger',
        )}
      >
        <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted')}>
          {selected?.icon}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        !disabled &&
        position &&
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
            className="z-[60] overflow-y-auto rounded-lg border border-border bg-white p-1.5 shadow-xl"
          >
            {searchable && (
              <div className="sticky top-0 z-10 mb-1.5 bg-white pb-1.5">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="h-8 w-full rounded-md border border-border px-2 text-sm text-strong focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
                />
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-muted">No matches.</p>
            ) : (
              filteredOptions.map((option, index) => {
                const active = option.value === value;

                return (
                  <button
                    key={`${option.value || '__empty'}-${index}`}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => select(option.value)}
                    className={cn(
                      'flex w-full items-start justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                      active ? 'bg-teal/10 text-strong' : 'text-strong hover:bg-surface-soft',
                      option.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                    )}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      {option.icon && <span className="mt-0.5 flex-shrink-0">{option.icon}</span>}
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.description && <span className="block truncate text-xs text-muted">{option.description}</span>}
                      </span>
                    </span>
                    {active && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
