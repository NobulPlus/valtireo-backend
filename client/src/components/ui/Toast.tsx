import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'danger' | 'warning' | 'info';

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastMessage extends Required<Pick<ToastInput, 'title' | 'tone' | 'duration'>> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: 'border-success-bg bg-white text-success',
  danger: 'border-danger-bg bg-white text-danger',
  warning: 'border-warning-bg bg-white text-warning',
  info: 'border-info-bg bg-white text-info',
};

const icons = {
  success: CheckCircle2,
  danger: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, description, tone = 'info', duration = 4500 }: ToastInput) => {
      const id = crypto.randomUUID();
      const toast: ToastMessage = { id, title, description, tone, duration };

      setToasts((current) => [toast, ...current].slice(0, 4));
      window.setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (title, description) => notify({ title, description, tone: 'success' }),
      error: (title, description) => notify({ title, description, tone: 'danger', duration: 6000 }),
      warning: (title, description) => notify({ title, description, tone: 'warning' }),
      info: (title, description) => notify({ title, description, tone: 'info' }),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];

          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-3 shadow-xl shadow-ink/10',
                toneClasses[toast.tone],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-strong">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-xs leading-5 text-muted">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="rounded-md p-1 text-muted transition-colors hover:bg-surface-soft hover:text-strong"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
