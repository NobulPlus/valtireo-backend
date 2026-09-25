import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label,
  htmlFor,
  error,
  errorId,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  errorId?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-strong">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
