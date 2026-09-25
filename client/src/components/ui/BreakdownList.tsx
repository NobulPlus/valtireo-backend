interface BreakdownEntry {
  label: string;
  total: number;
}

export function BreakdownList({ entries, emptyLabel = 'No data yet.' }: { entries: BreakdownEntry[]; emptyLabel?: string }) {
  const max = Math.max(1, ...entries.map((entry) => entry.total));

  if (entries.length === 0) {
    return <p className="py-4 text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <div key={entry.label} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 truncate text-xs text-muted" title={entry.label}>
            {entry.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${Math.max(4, (entry.total / max) * 100)}%` }}
            />
          </div>
          <span className="w-6 flex-shrink-0 text-right text-xs font-medium text-strong">
            {entry.total}
          </span>
        </div>
      ))}
    </div>
  );
}
