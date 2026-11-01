import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NAV_GROUPS, type NavItem } from '@/components/shell/navConfig';
import { Logomark } from '@/components/ui/Logomark';
import { assetUrl } from '@/lib/assetUrl';
import { cn } from '@/lib/cn';

const COLLAPSE_STORAGE_KEY = 'valtireo-sidebar-collapsed';

/** The org logo/name header shown above the nav links, shared by the desktop sidebar and the mobile drawer. */
export function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  const { session } = useAuth();
  const [orgLogoFailed, setOrgLogoFailed] = useState(false);
  const orgLogoUrl = assetUrl(session?.workspace?.identity?.logo_url);

  return (
    <div className={cn('flex h-14 flex-shrink-0 items-center gap-2.5', collapsed ? 'justify-center px-0' : 'px-5')}>
      {orgLogoUrl && !orgLogoFailed ? (
        <img
          src={orgLogoUrl}
          alt={`${session?.workspace?.workspace_name ?? 'Organization'} logo`}
          className="h-[18px] w-[18px] flex-shrink-0 rounded-sm object-cover"
          onError={() => setOrgLogoFailed(true)}
        />
      ) : (
        <Logomark size={18} withBackground={false} />
      )}
      {!collapsed && (
        <span className="truncate font-display text-[15px] font-semibold tracking-tight">
          {session?.workspace?.identity.short_name || session?.organization?.name || 'Valtireo'}
        </span>
      )}
    </div>
  );
}

/**
 * A row's label, portaled straight to `document.body` and positioned from
 * the row's own live bounding box. A plain CSS `group-hover` popover here
 * gets visually swallowed by the content column next to it — both sides
 * sit in valid, separately-painted layers (the scrollable `<main>` versus
 * the sidebar's own stacking context), and nothing short of leaving that
 * layer entirely renders reliably above it. Only ever mounted while the
 * pointer is actually over the row, so there's no reposition-on-scroll to
 * track.
 */
function RailTooltip({ label, anchor }: { label: string; anchor: HTMLElement }) {
  const rect = anchor.getBoundingClientRect();
  return createPortal(
    <span
      className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-pine-dark px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
      style={{ top: rect.top + rect.height / 2, left: rect.right + 10 }}
    >
      {label}
    </span>,
    document.body,
  );
}

function useRailHover(collapsed: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  return {
    rowProps: {
      onMouseEnter: () => collapsed && setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
    tooltip: (label: string) => hovered && ref.current && <RailTooltip label={label} anchor={ref.current} />,
    ref,
  };
}

function ComingSoonRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { rowProps, tooltip, ref } = useRailHover(collapsed);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      {...rowProps}
      className={cn(
        'relative flex cursor-not-allowed items-center rounded-md px-2 py-1.5 text-sm text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.4)]',
        collapsed ? 'justify-center' : 'justify-between',
      )}
    >
      <span className={cn('flex items-center', collapsed ? '' : 'gap-2.5')}>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.08)]">
          <item.icon className="h-4 w-4" />
        </span>
        {!collapsed && item.label}
      </span>
      {!collapsed && (
        <span className="rounded-full bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
      )}
      {tooltip(`${item.label} · Coming soon`)}
    </div>
  );
}

function NavItemRow({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const { rowProps, tooltip, ref } = useRailHover(collapsed);
  return (
    <NavLink
      ref={ref as React.RefObject<HTMLAnchorElement>}
      {...rowProps}
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex items-center rounded-md px-2 py-1.5 text-sm text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.8)] transition-colors hover:bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] hover:text-[rgb(var(--workspace-sidebar-fg,255_255_255))]',
          collapsed ? 'justify-center' : 'gap-2.5',
          isActive && 'bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.15)] font-semibold text-[rgb(var(--workspace-sidebar-fg,255_255_255))]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors',
              isActive ? 'bg-[var(--workspace-accent,var(--color-teal))] text-white' : 'bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.08)]',
            )}
          >
            <item.icon className="h-4 w-4" />
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
          {tooltip(item.label)}
        </>
      )}
    </NavLink>
  );
}

/**
 * The nav group/link list, shared by the desktop sidebar and the mobile
 * drawer (see MobileNavDrawer.tsx) so the two stay in sync automatically.
 * `collapsed` only ever comes from the desktop sidebar — the mobile drawer
 * never passes it, since a temporary full-width overlay has no use for an
 * icon-only rail.
 */
export function SidebarNavLinks({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { hasPermission, moduleByKey, session, workspaceMode } = useAuth();

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => {
          if (group.scope === 'employee' && workspaceMode !== 'employee') return null;
          if (group.scope !== 'core' && group.scope !== 'employee' && workspaceMode !== 'admin') return null;

          const visibleItems = group.items.filter((item) => {
            if (item.platformAdminOnly && !session?.is_platform_admin) return false;
            if (item.permission && !hasPermission(item.permission)) return false;
            if (item.moduleKey) {
              const module = moduleByKey(item.moduleKey);
              if (!module || module.visibility !== 'enabled') return false;
            }
            if (item.employeeExperienceKey && !session?.workspace?.employee_experience[item.employeeExperienceKey]) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-5">
              {collapsed ? (
                <div className="mx-1 mb-2 border-t border-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.12)]" />
              ) : (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.45)]">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) =>
                  item.comingSoon ? (
                    <ComingSoonRow key={item.label} item={item} collapsed={collapsed} />
                  ) : (
                    <NavItemRow key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {session?.organization && !collapsed && (
        <div className="border-t border-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] px-5 py-3 text-xs text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.5)]">
          {session.organization.name}
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
  }

  return (
    <aside
      className={cn(
        'relative m-4 hidden flex-shrink-0 flex-col rounded-2xl bg-[var(--workspace-sidebar,var(--color-pine))] text-[rgb(var(--workspace-sidebar-fg,255_255_255))] shadow-[0_24px_48px_-18px_rgba(12,44,40,0.5),0_6px_16px_rgba(12,44,40,0.18)] transition-[width] duration-300 ease-in-out lg:flex',
        collapsed ? 'w-[76px]' : 'w-60',
      )}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'absolute top-7 z-10 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-canvas bg-[var(--workspace-accent,var(--color-teal))] text-white shadow-md transition-transform duration-300 ease-in-out hover:brightness-110',
          collapsed ? '-right-3.5 rotate-180' : '-right-3.5',
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <SidebarBrand collapsed={collapsed} />
      <SidebarNavLinks collapsed={collapsed} />
    </aside>
  );
}
