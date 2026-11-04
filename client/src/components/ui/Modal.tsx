import { useEffect, useId, useRef, type ReactNode } from 'react';

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useLatest(onClose);

  // Base accessibility for every modal in the app (28 call sites): focus the
  // dialog on open, restore focus to whatever opened it on close, trap Tab
  // cycling inside the dialog, and close on Escape — none of this existed
  // before, so a keyboard user could tab out into the page behind an open
  // modal and a screen reader got no dialog role at all.
  //
  // Deliberately depends on [open] only, not onClose: every caller passes an
  // inline onClose (e.g. onClose={() => setOpen(false)}), a new function on
  // every render of the parent — including every render caused by typing
  // into a field inside the modal, since that field's state usually lives in
  // the same parent. With onClose in the dependency array, each keystroke
  // re-ran this effect: the cleanup refocused whatever element opened the
  // modal, then the effect refocused the dialog panel, yanking focus out of
  // the field the user was actively typing into. onCloseRef reads the latest
  // onClose without making it a dependency.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const sizeClass = size === 'lg' ? 'max-w-4xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[calc(100vh-3rem)] w-full flex-col ${sizeClass} rounded-lg border border-border bg-surface shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id={titleId} className="text-sm font-semibold text-strong">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-strong" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-strong">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
