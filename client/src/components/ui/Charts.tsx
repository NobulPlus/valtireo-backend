import { cn } from '@/lib/cn';

export const CHART_COLORS = ['#0F766E', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#64748B'];

export interface ChartEntry {
  id?: string | number;
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  entries,
  totalLabel,
  className,
  onEntryClick,
}: {
  entries: ChartEntry[];
  totalLabel: string;
  className?: string;
  onEntryClick?: (entry: ChartEntry) => void;
}) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (entries.length === 0 || total === 0) {
    return (
      <div className={cn('flex aspect-square w-full max-w-[220px] items-center justify-center rounded-full bg-surface-soft', className)}>
        <p className="text-sm text-muted">No data</p>
      </div>
    );
  }

  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-[220px]', className)}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#E6EFED" strokeWidth="18" />
        {entries.map((entry, index) => {
          const segment = (entry.value / total) * circumference;
          const dashOffset = offset;
          offset += segment;

          return (
            <circle
              key={entry.id ?? entry.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(segment - 2, 0)} ${circumference}`}
              strokeDashoffset={-dashOffset}
              className={cn(onEntryClick && 'cursor-pointer transition-opacity hover:opacity-80')}
              onClick={() => onEntryClick?.(entry)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-3xl font-semibold text-strong">{total}</p>
        <p className="mt-1 text-xs font-medium text-muted">{totalLabel}</p>
      </div>
    </div>
  );
}

export function ChartLegend({
  entries,
  onEntryClick,
}: {
  entries: ChartEntry[];
  onEntryClick?: (entry: ChartEntry) => void;
}) {
  if (entries.length === 0) return <p className="py-4 text-sm text-muted">No data yet.</p>;

  return (
    <div className="space-y-2.5">
      {entries.map((entry, index) => {
        const className = cn(
          'flex w-full items-center justify-between gap-3 rounded-md bg-surface-soft px-3 py-2 text-left',
          onEntryClick && 'transition-colors hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
        );
        const content = (
          <>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate text-sm font-medium text-strong">{entry.label}</span>
          </span>
          <span className="font-display text-lg font-semibold text-strong">{entry.value}</span>
          </>
        );

        return onEntryClick ? (
          <button key={entry.id ?? entry.label} type="button" className={className} onClick={() => onEntryClick(entry)}>
            {content}
          </button>
        ) : (
          <div key={entry.id ?? entry.label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function RankedBarList({
  entries,
  valueLabel = 'Total',
  max,
}: {
  entries: ChartEntry[];
  valueLabel?: string;
  max?: number;
}) {
  if (entries.length === 0) return <p className="py-4 text-sm text-muted">No data yet.</p>;

  const scale = Math.max(1, max ?? Math.max(...entries.map((entry) => entry.value)));

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.id ?? entry.label}
          className="grid grid-cols-[minmax(132px,0.42fr)_minmax(120px,1fr)_2rem] items-center gap-3"
        >
          <span className="min-w-0 truncate text-sm font-medium text-strong" title={entry.label}>
            {entry.label}
          </span>
          <div className="h-2 min-w-0 overflow-hidden rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${entry.value > 0 ? Math.max(4, (entry.value / scale) * 100) : 0}%`,
                backgroundColor: entry.color ?? CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
          </div>
          <span
            className="text-right text-xs font-semibold text-strong"
            title={`${entry.value} ${valueLabel.toLowerCase()}`}
          >
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({
  entries,
  valueLabel = 'Total',
}: {
  entries: ChartEntry[];
  valueLabel?: string;
}) {
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  const gridLines = [1, 0.75, 0.5, 0.25, 0];
  const plotHeight = 184;
  const plotPaddingTop = 18;
  const plotPaddingBottom = 0;
  const drawableHeight = plotHeight - plotPaddingTop - plotPaddingBottom;

  if (entries.length === 0) return <p className="py-4 text-sm text-muted">No data yet.</p>;

  const columnTemplate = `repeat(${entries.length}, minmax(72px, 1fr))`;
  const yPosition = (line: number) => `${plotPaddingTop + (1 - line) * drawableHeight}px`;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[360px]">
        <div className="grid grid-cols-[32px_1fr]">
          <div className="relative" style={{ height: `${plotHeight}px` }}>
            {gridLines.map((line) => (
              <span
                key={line}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted"
                style={{ top: yPosition(line) }}
              >
                {Math.round(max * line)}
              </span>
            ))}
          </div>

          <div className="relative border-b border-l border-border" style={{ height: `${plotHeight}px` }}>
            <div className="absolute inset-0">
              {gridLines.map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 border-t border-border/70"
                  style={{ top: yPosition(line) }}
                />
              ))}
            </div>

            <div
              className="relative z-10 grid h-full items-end gap-5 px-5"
              style={{ gridTemplateColumns: columnTemplate, paddingTop: `${plotPaddingTop}px` }}
            >
              {entries.map((entry, index) => (
                <div key={entry.id ?? entry.label} className="flex h-full flex-col items-center justify-end">
                  <span className="mb-1 h-4 text-xs font-semibold leading-4 text-strong">{entry.value}</span>
                  <div
                    className="w-full max-w-12 rounded-t-sm transition-all"
                    title={`${entry.label}: ${entry.value} ${valueLabel.toLowerCase()}`}
                    style={{
                      height: `${entry.value > 0 ? Math.max(14, (entry.value / max) * (drawableHeight - 22)) : 0}px`,
                      backgroundColor: entry.color ?? CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div />
          <div className="mt-3 grid gap-5 px-5" style={{ gridTemplateColumns: columnTemplate }}>
            {entries.map((entry) => (
              <span
                key={entry.id ?? entry.label}
                className="line-clamp-2 min-h-8 text-center text-xs leading-4 text-muted"
                title={entry.label}
              >
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface GroupedChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface GroupedChartEntry {
  id?: string | number;
  label: string;
  values: Record<string, number>;
}

export function GroupedColumnChart({
  entries,
  series,
  valueLabel = 'Total',
}: {
  entries: GroupedChartEntry[];
  series: GroupedChartSeries[];
  valueLabel?: string;
}) {
  const max = Math.max(1, ...entries.flatMap((entry) => series.map((item) => entry.values[item.key] ?? 0)));
  const gridLines = [1, 0.75, 0.5, 0.25, 0];
  const plotHeight = 214;
  const plotPaddingTop = 20;
  const drawableHeight = plotHeight - plotPaddingTop;

  if (entries.length === 0 || series.length === 0) return <p className="py-4 text-sm text-muted">No data yet.</p>;

  const columnTemplate = `repeat(${entries.length}, minmax(92px, 1fr))`;
  const yPosition = (line: number) => `${plotPaddingTop + (1 - line) * drawableHeight}px`;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[32px_1fr]">
            <div className="relative" style={{ height: `${plotHeight}px` }}>
              {gridLines.map((line) => (
                <span
                  key={line}
                  className="absolute right-2 -translate-y-1/2 text-[10px] text-muted"
                  style={{ top: yPosition(line) }}
                >
                  {Math.round(max * line)}
                </span>
              ))}
            </div>

            <div className="relative border-b border-l border-border" style={{ height: `${plotHeight}px` }}>
              <div className="absolute inset-0">
                {gridLines.map((line) => (
                  <div
                    key={line}
                    className="absolute left-0 right-0 border-t border-border/70"
                    style={{ top: yPosition(line) }}
                  />
                ))}
              </div>

              <div
                className="relative z-10 grid h-full items-end gap-6 px-5"
                style={{ gridTemplateColumns: columnTemplate, paddingTop: `${plotPaddingTop}px` }}
              >
                {entries.map((entry) => (
                  <div key={entry.id ?? entry.label} className="flex h-full items-end justify-center gap-1.5">
                    {series.map((item) => {
                      const value = entry.values[item.key] ?? 0;

                      return (
                        <div key={item.key} className="flex h-full flex-1 max-w-5 flex-col items-center justify-end">
                          <span className="mb-1 h-4 text-[10px] font-semibold leading-4 text-strong">{value}</span>
                          <div
                            className="w-full rounded-t-sm transition-all"
                            title={`${entry.label} ${item.label}: ${value} ${valueLabel.toLowerCase()}`}
                            style={{
                              height: `${value > 0 ? Math.max(12, (value / max) * (drawableHeight - 24)) : 0}px`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div />
            <div className="mt-3 grid gap-6 px-5" style={{ gridTemplateColumns: columnTemplate }}>
              {entries.map((entry) => (
                <span
                  key={entry.id ?? entry.label}
                  className="line-clamp-2 min-h-8 text-center text-xs leading-4 text-muted"
                  title={entry.label}
                >
                  {entry.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-8">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MultiLineTrendChart({
  entries,
  series,
  valueLabel = 'Total',
}: {
  entries: GroupedChartEntry[];
  series: GroupedChartSeries[];
  valueLabel?: string;
}) {
  if (entries.length === 0 || series.length === 0) return <p className="py-4 text-sm text-muted">No data yet.</p>;

  const width = Math.max(560, entries.length * 64);
  const height = 260;
  const padding = { top: 24, right: 22, bottom: 44, left: 36 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...entries.flatMap((entry) => series.map((item) => entry.values[item.key] ?? 0)));
  const gridLines = [1, 0.75, 0.5, 0.25, 0];
  const xFor = (index: number) => padding.left + (entries.length === 1 ? plotWidth / 2 : (index / (entries.length - 1)) * plotWidth);
  const yFor = (value: number) => padding.top + (1 - value / max) * plotHeight;

  function pathFor(key: string): string {
    return entries
      .map((entry, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${xFor(index)} ${yFor(entry.values[key] ?? 0)}`;
      })
      .join(' ');
  }

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <svg width={width} height={height} role="img" aria-label={`${valueLabel} trend chart`} className="block">
          {gridLines.map((line) => {
            const y = padding.top + (1 - line) * plotHeight;

            return (
              <g key={line}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#D7E2E0" strokeOpacity="0.75" />
                <text x={padding.left - 8} y={y + 3} textAnchor="end" className="fill-muted text-[10px]">
                  {Math.round(max * line)}
                </text>
              </g>
            );
          })}

          <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} stroke="#D7E2E0" />
          <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} stroke="#D7E2E0" />

          {series.map((item) => (
            <path key={item.key} d={pathFor(item.key)} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {entries.map((entry, index) => (
            <g key={entry.id ?? entry.label}>
              {series.map((item) => {
                const value = entry.values[item.key] ?? 0;
                const x = xFor(index);
                const y = yFor(value);

                return (
                  <circle key={item.key} cx={x} cy={y} r="3.5" fill={item.color}>
                    <title>{`${entry.label} ${item.label}: ${value} ${valueLabel.toLowerCase()}`}</title>
                  </circle>
                );
              })}
              <text x={xFor(index)} y={height - 18} textAnchor="middle" className="fill-muted text-[11px]">
                {entry.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-8">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
