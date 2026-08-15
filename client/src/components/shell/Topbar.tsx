import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Topbar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-surface px-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        {session?.organization && (
          <span className="font-medium text-strong">{session.organization.name}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-soft hover:text-strong"
          title="Notifications (coming soon)"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-soft"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-light text-pine">
              <User className="h-3.5 w-3.5" />
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

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-border bg-white py-1 shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-[13px] font-medium text-strong">{session?.user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-strong hover:bg-surface-soft"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
