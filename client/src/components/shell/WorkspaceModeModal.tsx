import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logomark } from '@/components/ui/Logomark';
import type { WorkspaceMode } from '@/context/AuthContext';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Shown once per login session for anyone who can choose between the admin
 * dashboard and the employee self-service module — a fixed overlay so it can
 * sit on top of either the login page (right after sign-in, before any
 * navigation) or the app shell fallback (see ProtectedRoute) with no route
 * change or sidebar flash underneath. Unlike a dialog, no close button: this
 * is a required routing decision, not a dismissible preference. The choice
 * can still be changed anytime via the Topbar account menu (see Topbar.tsx).
 *
 * Design mocked up and approved on the design canvas first (per standing
 * practice) — the tinted panels and decorative motifs reuse only the
 * existing pine/teal tokens, no new brand colors introduced.
 */
export function WorkspaceModeModal() {
  const { session, adminLandingRoute, setWorkspaceMode } = useAuth();
  const navigate = useNavigate();
  const firstName = session?.user?.name?.split(' ')[0] || 'there';
  const greeting = greetingForHour(new Date().getHours());

  function choose(mode: WorkspaceMode) {
    setWorkspaceMode(mode);
    navigate(mode === 'admin' ? adminLandingRoute : '/dashboard/me', { replace: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-5 py-10 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-mode-greeting"
        className="workspace-modal-rise w-full max-w-3xl rounded-[26px] bg-surface p-8 shadow-[0_40px_90px_-24px_rgba(18,63,58,0.45),0_10px_30px_rgba(18,63,58,0.2)] sm:p-11"
      >
        <div className="mb-7 flex items-center gap-2.5">
          <Logomark size={22} />
          <p className="font-display text-base font-semibold text-strong">OrgaviaHR</p>
        </div>

        <h1 id="workspace-mode-greeting" className="font-display text-2xl font-bold tracking-tight text-strong">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-1.5 text-sm text-muted">Where would you like to go today?</p>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose('admin')}
            className="group relative overflow-hidden rounded-2xl bg-pine/[0.06] p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-12px_rgba(18,63,58,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <svg className="pointer-events-none absolute -right-6 -top-7 h-36 w-36 opacity-50" viewBox="0 0 150 150" fill="none" aria-hidden="true">
              <circle cx="75" cy="75" r="60" stroke="#123F3A" strokeWidth="1.4" strokeDasharray="2 7" />
              <circle cx="75" cy="75" r="40" stroke="#2F8F8A" strokeWidth="1.4" strokeDasharray="2 7" />
            </svg>
            <span className="relative flex h-11 w-11 items-center justify-center rounded-[13px] bg-pine text-white">
              <Activity className="h-5 w-5" />
            </span>
            <span className="relative mt-4 block font-display text-lg font-bold text-strong">Pulse</span>
            <span className="relative mt-1 block text-[13px] leading-relaxed text-muted">
              Manage your organization — people, workflows, documents, and reports, all in one live view.
            </span>
            <ArrowRight className="relative mt-4 h-4 w-4 text-teal opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </button>

          <button
            type="button"
            onClick={() => choose('employee')}
            className="group relative overflow-hidden rounded-2xl bg-teal/[0.07] p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-12px_rgba(18,63,58,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <svg className="pointer-events-none absolute -right-4 -top-2 h-36 w-36 opacity-40" viewBox="0 0 150 150" fill="none" aria-hidden="true">
              <path d="M30 100 L75 30 L120 100" stroke="#2F8F8A" strokeWidth="3" strokeLinecap="round" opacity=".4" />
              <circle cx="75" cy="105" r="5" fill="#2F8F8A" opacity=".5" />
            </svg>
            <span className="relative flex h-11 w-11 items-center justify-center rounded-[13px] bg-teal text-white">
              <UserRound className="h-5 w-5" />
            </span>
            <span className="relative mt-4 block font-display text-lg font-bold text-strong">My workspace</span>
            <span className="relative mt-1 block text-[13px] leading-relaxed text-muted">
              Your own profile, leave, and attendance — the same view your whole team signs in to.
            </span>
            <ArrowRight className="relative mt-4 h-4 w-4 text-teal opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted">You can switch between these anytime from the account menu.</p>
      </div>
    </div>
  );
}
