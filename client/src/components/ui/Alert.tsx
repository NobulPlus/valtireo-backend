import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Alert({
  tone = 'danger',
  children,
  id,
}: {
  tone?: 'danger' | 'warning';
  children: ReactNode;
  id?: string;
}) {
  const toneClasses =
    tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning';

  return (
    <div
      id={id}
      role="alert"
      className={cn('flex items-start gap-2 rounded-md px-3 py-2.5 text-[13px] leading-5', toneClasses)}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}
