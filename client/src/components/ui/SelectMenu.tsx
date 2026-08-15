import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectMenuOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
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

  function select(value: string) {
    onChange(value);
    setOpen(false);
  }

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex h-9 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-white px-3 text-left text-sm text-strong shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:bg-surface-soft disabled:text-muted',
          invalid && 'border-danger focus-visible:outline-danger',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-40 mt-2 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-lg border border-border bg-white p-1.5 shadow-xl">
          {options.map((option, index) => {
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
                <span className="min-w-0">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description && <span className="block truncate text-xs text-muted">{option.description}</span>}
                </span>
                {active && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
