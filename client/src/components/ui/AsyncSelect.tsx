import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface AsyncOption {
  value: number;
  label: string;
  description?: string;
}

/**
 * A minimal searchable select for large or dynamic lookups (e.g. reporting
 * manager). Debounces input and delegates fetching to the caller so it can
 * hit whichever endpoint is relevant (employees search, etc).
 */
export function AsyncSelect({
  value,
  onChange,
  loadOptions,
  placeholder = 'Search…',
  disabled,
  invalid,
}: {
  value: AsyncOption | null;
  onChange: (option: AsyncOption | null) => void;
  loadOptions: (query: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await loadOptions(query);
        if (!cancelled) setOptions(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-border bg-white px-3 text-left text-sm text-strong disabled:bg-surface-soft disabled:text-muted',
          invalid && 'border-danger',
        )}
      >
        <span className={cn('truncate', !value && 'text-muted')}>{value ? value.label : placeholder}</span>
        <span className="flex items-center gap-1">
          {value && (
            <X
              className="h-3.5 w-3.5 text-muted hover:text-danger"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
            />
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-white shadow-lg">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search…"
              className="h-8 w-full rounded-md border border-border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            )}
            {!loading && options.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted">No matches.</p>
            )}
            {!loading &&
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-soft"
                >
                  <span>
                    {option.label}
                    {option.description && (
                      <span className="ml-1.5 text-xs text-muted">{option.description}</span>
                    )}
                  </span>
                  {value?.value === option.value && <Check className="h-3.5 w-3.5 text-teal" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
