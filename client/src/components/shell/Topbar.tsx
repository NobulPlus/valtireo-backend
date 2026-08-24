import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Monitor, Moon, Sun, User, UserRound, Gauge } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { Dropdown, DropdownMenuItem } from '@/components/ui/Dropdown';
import { NotificationBell } from '@/components/shell/NotificationBell';

const THEME_SEQUENCE: ThemePreference[] = ['light', 'dark', 'system'];
const THEME_ICON: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL: Record<ThemePreference, string> = { light: 'Light', dark: 'Dark', system: 'Match system' };

function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const Icon = THEME_ICON[preference];

  function cycle() {
    const next = THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(preference) + 1) % THEME_SEQUENCE.length];
    setPreference(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-strong"
      title={`Theme: ${THEME_LABEL[preference]} (click to change)`}
      aria-label={`Theme: ${THEME_LABEL[preference]}. Click to switch.`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Topbar() {
  const { session, logout, canChooseWorkspaceMode, workspaceMode, setWorkspaceMode, adminLandingRoute } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function handleSwitchWorkspaceMode() {
    if (workspaceMode === 'admin') {
      setWorkspaceMode('employee');
      navigate('/dashboard/me');
    } else {
      setWorkspaceMode('admin');
      navigate(adminLandingRoute);
    }
  }

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-surface px-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        {session?.organization && (
          <span className="font-medium text-strong">{session.organization.name}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />

        <Dropdown
          align="right"
          panelClassName="w-48"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-soft"
              aria-label="Account menu"
            >
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-teal-light text-pine">
                {session?.user.photo_url ? (
                  <img src={session.user.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-[13px] font-medium leading-tight text-strong">
                  {session?.user.name}
                </span>
                <span className="block text-[11px] leading-tight text-muted">
                  {session?.roles[0] ?? 'Member'}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>
          )}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-[13px] font-medium text-strong">{session?.user.email}</p>
          </div>
          {canChooseWorkspaceMode && (
            <DropdownMenuItem icon={workspaceMode === 'admin' ? UserRound : Gauge} onClick={handleSwitchWorkspaceMode}>
              {workspaceMode === 'admin' ? 'Switch to employee view' : 'Switch to admin view'}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon={LogOut} onClick={handleLogout}>
            Log out
          </DropdownMenuItem>
        </Dropdown>
      </div>
    </header>
  );
}
