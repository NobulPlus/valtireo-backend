import { useNavigate } from 'react-router-dom';
import { Gauge, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logomark } from '@/components/ui/Logomark';
import type { WorkspaceMode } from '@/context/AuthContext';

/**
 * Shown once per login session for anyone who can choose between the admin
 * dashboard and the employee self-service module — a fixed overlay so it can
 * sit on top of either the login page (right after sign-in, before any
 * navigation) or the app shell fallback (see ProtectedRoute) with no route
 * change or sidebar flash underneath. Unlike a dialog, no close button: this
 * is a required routing decision, not a dismissible preference. The choice
 * can still be changed anytime via the Topbar account menu (see Topbar.tsx).
 */
export function WorkspaceModeModal() {
  const { session, adminLandingRoute, setWorkspaceMode } = useAuth();
  const navigate = useNavigate();

  function choose(mode: WorkspaceMode) {
    setWorkspaceMode(mode);
    navigate(mode === 'admin' ? adminLandingRoute : '/dashboard/me', { replace: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-5 py-10">
      <div className="w-full max-w-xl rounded-lg border border-border bg-white p-8 shadow-[0_18px_60px_rgba(18,63,58,0.10)]">
        <div className="mb-6 flex items-center gap-3">
          <Logomark size={22} />
          <div>
            <p className="font-display text-base font-semibold text-strong">Valtireo</p>
            <p className="text-xs text-muted">Organizational OS</p>
          </div>
        </div>

        <h1 className="font-display text-xl font-semibold text-strong">
          Welcome back, {session?.user.name.split(' ')[0]}.
        </h1>
        <p className="mt-1.5 text-sm text-muted">Where would you like to go?</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose('admin')}
            className="flex flex-col items-start gap-3 rounded-lg border border-border p-5 text-left transition-colors hover:border-teal hover:bg-teal/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-pine text-white">
              <Gauge className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-strong">Dashboard</span>
              <span className="mt-0.5 block text-sm text-muted">
                Manage your organization — people, workflows, documents, and reports.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose('employee')}
            className="flex flex-col items-start gap-3 rounded-lg border border-border p-5 text-left transition-colors hover:border-teal hover:bg-teal/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal text-white">
              <UserRound className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-strong">Employee module</span>
              <span className="mt-0.5 block text-sm text-muted">
                Your own profile, leave, and attendance — the same view your team sees.
              </span>
            </span>
          </button>
        </div>

        <p className="mt-5 text-xs text-muted">You can switch between these anytime from the account menu.</p>
      </div>
    </div>
  );
}
