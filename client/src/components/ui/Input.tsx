import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const baseFieldClasses =
  'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-strong placeholder:text-muted focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:bg-surface-soft disabled:text-muted';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(baseFieldClasses, invalid && 'border-danger focus:ring-danger/20', className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseFieldClasses, 'h-auto min-h-20 resize-y py-2', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
