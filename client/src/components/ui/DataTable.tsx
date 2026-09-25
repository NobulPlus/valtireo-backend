import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-soft">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted',
                  column.headerClassName,
                )}
              >
                {column.onSort ? (
                  <button
                    type="button"
                    onClick={column.onSort}
                    className="inline-flex items-center gap-1.5 rounded-sm text-left transition-colors hover:text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    {column.header}
                    {column.sortDirection === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : column.sortDirection === 'desc' ? (
                      <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-border last:border-b-0',
                onRowClick && 'cursor-pointer hover:bg-surface-soft',
              )}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-middle text-strong', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
