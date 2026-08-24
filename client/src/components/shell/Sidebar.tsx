import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NAV_GROUPS } from '@/components/shell/navConfig';
import { Logomark } from '@/components/ui/Logomark';
import { cn } from '@/lib/cn';

export function Sidebar() {
  const { hasPermission, moduleByKey, session, workspaceMode } = useAuth();
  const [orgLogoFailed, setOrgLogoFailed] = useState(false);
  const orgLogoUrl = session?.workspace?.identity?.logo_url;

  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-[var(--workspace-sidebar,var(--color-pine))] text-[rgb(var(--workspace-sidebar-fg,255_255_255))] lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
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
        <span className="truncate font-display text-[15px] font-semibold tracking-tight">
          {session?.workspace?.identity.short_name || session?.organization?.name || 'Valtireo'}
        </span>
      </div>

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
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.45)]">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) =>
                  item.comingSoon ? (
                    <div
                      key={item.label}
                      className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.4)]"
                      title="Coming soon"
                    >
                      <span className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="rounded-full bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] px-1.5 py-0.5 text-[10px] font-medium">
                        Soon
                      </span>
                    </div>
                  ) : (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.8)] transition-colors hover:bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] hover:text-[rgb(var(--workspace-sidebar-fg,255_255_255))]',
                          isActive && 'bg-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.15)] text-[rgb(var(--workspace-sidebar-fg,255_255_255))]',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {session?.organization && (
        <div className="border-t border-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.1)] px-5 py-3 text-xs text-[rgb(var(--workspace-sidebar-fg,255_255_255)/0.5)]">
          {session.organization.name}
        </div>
      )}
    </aside>
  );
}
