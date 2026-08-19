import { useId, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/apiClient';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Logomark } from '@/components/ui/Logomark';
import { WorkspaceModeModal } from '@/components/shell/WorkspaceModeModal';

const schema = z.object({
  email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

const footerWords = ['Organize.', 'Automate.', 'Govern.', 'Grow.'];

export function LoginPage() {
  const { login, isAuthenticated, defaultRoute } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  if (isAuthenticated && !showWorkspaceModal) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultRoute;
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(values: FormValues) {
    try {
      const canChooseWorkspaceMode = await login(values.email, values.password);
      if (canChooseWorkspaceMode) {
        setShowWorkspaceModal(true);
      } else {
        navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 422) {
          toast.error('Sign in failed', error.fieldError('email') ?? error.message);
        } else if (error.status >= 500 || error.status === 0) {
          toast.error('Sign in failed', 'Valtireo could not complete sign in right now. Please try again in a moment.');
        } else {
          toast.error('Sign in failed', error.message);
        }
      } else {
        toast.error('Sign in failed', 'We could not reach the server. Check your connection and try again.');
      }
    }
  }

  return (
    <>
    <main className="min-h-screen bg-[#f4f8f7] text-strong">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <aside className="login-brand-panel relative hidden min-h-screen overflow-hidden bg-pine text-white lg:flex">
          <div className="relative z-10 flex min-h-screen w-full flex-col justify-between px-10 py-9 xl:px-14">
            <header className="login-fade-in flex items-center gap-3">
              <Logomark size={22} />
              <div>
                <p className="font-display text-base font-semibold tracking-normal">Valtireo</p>
                <p className="text-xs text-white/52">Organizational OS</p>
              </div>
            </header>

            <div className="grid gap-8 xl:grid-cols-[minmax(360px,0.82fr)_minmax(320px,0.9fr)] xl:items-center">
              <div className="login-fade-in max-w-[430px]" style={{ animationDelay: '0.1s' }}>
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-bridge-teal/80">
                  Organizational command layer
                </p>
                <h1 className="font-display text-[30px] font-bold leading-[1.16] tracking-normal xl:text-[38px]">
                  One workspace for every department, process, and decision.
                </h1>
                <p className="mt-4 max-w-[360px] text-sm leading-6 text-white/62">
                  Structure the work, route the approvals, and keep every important action visible.
                </p>
              </div>

              <ModuleOrbit />
            </div>

            <footer className="login-fade-in border-t border-white/10 pt-5" style={{ animationDelay: '0.4s' }}>
              <div className="login-footer-sequence" aria-label="Organize. Automate. Govern. Grow.">
                {footerWords.map((word, index) => (
                  <span key={word} className="login-footer-word" style={{ animationDelay: `${index * 2.4}s` }}>
                    {word}
                  </span>
                ))}
              </div>
            </footer>
          </div>
        </aside>

        <div className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[390px]">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <Logomark size={21} />
              <div>
                <p className="font-display text-base font-semibold text-strong">Valtireo</p>
                <p className="text-xs text-muted">Organizational OS</p>
              </div>
            </div>

            <div
              className="login-fade-in rounded-lg border border-border bg-white p-6 shadow-[0_18px_60px_rgba(18,63,58,0.10)] sm:p-8"
              style={{ animationDelay: '0.15s' }}
            >
              <div className="mb-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-pine text-white">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h2 className="font-display text-2xl font-semibold tracking-normal text-strong">
                  Sign in to your workspace
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Use your organization-issued Valtireo credentials to continue.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                <Field label="Email address" htmlFor="email" error={errors.email?.message} errorId={emailErrorId} required>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    invalid={Boolean(errors.email)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? emailErrorId : undefined}
                    className="h-10"
                    {...register('email')}
                  />
                </Field>

                <Field label="Password" htmlFor="password" error={errors.password?.message} errorId={passwordErrorId} required>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      invalid={Boolean(errors.password)}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? passwordErrorId : undefined}
                      className="h-10 pr-10"
                      {...register('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-1 top-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </Field>

                <Button type="submit" variant="primary" className="mt-1 h-10 w-full" isLoading={isSubmitting}>
                  {isSubmitting ? (
                    'Signing in...'
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-5 text-center text-[13px] leading-5 text-muted">
                Forgot your password? Contact your workspace administrator.
              </p>
            </div>

            {import.meta.env.DEV && (
              <div className="mt-5 rounded-md border border-dashed border-border-strong bg-white/70 px-3 py-2.5 text-[11px] leading-5 text-muted">
                <span className="font-medium text-strong">Development only</span>
                <br />
                Organization Admin: admin@valtireo.test / Password1!
                <br />
                Super Admin (platform console): superadmin@valtireo.test / Password1!
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
    {showWorkspaceModal && <WorkspaceModeModal />}
    </>
  );
}

// Angle 0 = due right, increasing clockwise — matches both the CSS
// rotate() used on the connector spokes and the trig below, so a node's
// position and the spoke pointing at it always agree.
const ORBIT_NODES = [
  { label: 'Core', angle: -90 },
  { label: 'Workflows', angle: -30 },
  { label: 'Documents', angle: 30 },
  { label: 'Services', angle: 90 },
  { label: 'Reports', angle: 150 },
  { label: 'Governance', angle: 210, accent: true },
];

const ORBIT_RADIUS = 42; // percent of the container, center to node

function orbitPosition(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    left: `${50 + radius * Math.cos(rad)}%`,
    top: `${50 + radius * Math.sin(rad)}%`,
  };
}

/**
 * Six operating-layer nodes around a central hub — mirrors the sidebar's
 * module groups (Core, Workflows, Documents, Services, Reports, Governance).
 * Each is linked to the hub by a spoke carrying a slow traveling pulse, a
 * quiet nod to workflow routing rather than decoration for its own sake.
 * The Governance node carries a gold tint (decision/approval moments); the
 * hub carries a slow cyan pulse (automation/intelligence running quietly
 * underneath). No fake metrics — the visual states structure, not numbers.
 */
function ModuleOrbit() {
  return (
    <div className="login-orbit login-fade-in hidden xl:block" style={{ animationDelay: '0.25s' }} aria-hidden="true">
      <div className="login-orbit-grid" />
      <div className="login-orbit-sweep" />
      <div className="login-orbit-ring login-orbit-ring-outer" />
      <div className="login-orbit-ring login-orbit-ring-inner" />

      {ORBIT_NODES.map((node, index) => (
        <div
          key={`spoke-${node.label}`}
          className="login-orbit-spoke"
          style={{ width: `${ORBIT_RADIUS}%`, transform: `rotate(${node.angle}deg)` }}
        >
          <span className="login-orbit-pulse" style={{ animationDelay: `${index * 0.5}s` }} />
        </div>
      ))}

      <div className="login-orbit-hub">
        <Logomark size={26} withBackground={false} />
        <span>Valtireo</span>
      </div>

      {ORBIT_NODES.map((node, index) => {
        const position = orbitPosition(node.angle, ORBIT_RADIUS);
        return (
          <div
            key={node.label}
            className={node.accent ? 'login-orbit-node login-orbit-node-governance' : 'login-orbit-node'}
            style={{ ...position, animationDelay: `${index * 0.6}s` }}
          >
            {node.label}
          </div>
        );
      })}
    </div>
  );
}
