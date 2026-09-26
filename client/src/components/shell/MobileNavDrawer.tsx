import { useEffect } from 'react';
import { X } from 'lucide-react';
import { SidebarBrand, SidebarNavLinks } from '@/components/shell/Sidebar';

/**
 * The Sidebar is `hidden` below the `lg` breakpoint (see Sidebar.tsx), so on
 * phones/tablets this drawer is the only way to reach navigation — it's
 * opened by the hamburger button in Topbar.tsx.
 */
export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-[var(--workspace-sidebar,var(--color-pine))] text-[rgb(var(--workspace-sidebar-fg,255_255_255))] shadow-xl">
        <div className="flex items-center justify-between pr-2">
          <SidebarBrand />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.7)] hover:bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] hover:text-[rgb(var(--workspace-sidebar-fg,255_255_255))]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarNavLinks onNavigate={onClose} />
      </div>
    </div>
  );
}
