import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paginated } from '@/types/api';
import { Button } from '@/components/ui/Button';

export function Pagination<T>({
  meta,
  onPageChange,
}: {
  meta: Paginated<T>['meta'];
  onPageChange: (page: number) => void;
}) {
  if (meta.last_page <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
      <p>
        Showing <span className="font-medium text-strong">{meta.from ?? 0}</span>–
        <span className="font-medium text-strong">{meta.to ?? 0}</span> of{' '}
        <span className="font-medium text-strong">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-8 px-0"
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs">
          Page {meta.current_page} of {meta.last_page}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="w-8 px-0"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPageChange(meta.current_page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
