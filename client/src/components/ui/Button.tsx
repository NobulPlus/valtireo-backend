import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onHero';
type Size = 'icon' | 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[var(--workspace-button,var(--color-pine))] text-white hover:brightness-95 focus-visible:outline-pine',
  secondary:
    'bg-white text-strong border border-border hover:bg-surface-soft focus-visible:outline-teal',
  ghost: 'bg-transparent text-muted hover:bg-surface-soft hover:text-strong',
  danger: 'bg-danger text-white hover:opacity-90 focus-visible:outline-danger',
  onHero: 'bg-white/10 text-white border border-white/20 hover:bg-white/15 focus-visible:outline-white',
};

const sizeClasses: Record<Size, string> = {
  icon: 'h-8 w-8 p-0 text-[13px]',
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {!(isLoading && size === 'icon') && children}
      </button>
    );
  },
);
Button.displayName = 'Button';
