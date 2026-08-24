import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError, setStoredToken } from '@/lib/apiClient';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Logomark } from '@/components/ui/Logomark';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

interface AcceptInvitationResponse {
  token: string;
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh, defaultRoute } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [invalidTokenMessage, setInvalidTokenMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: FormValues) {
    if (!token) return;

    try {
      const result = await api.post<AcceptInvitationResponse>(`/employee-invitations/${token}/accept`, {
        password: values.password,
        password_confirmation: values.confirmPassword,
      });

      setStoredToken(result.token);
      await refresh();
      toast.success('Welcome to Valtireo', 'Your password is set and you are signed in.');
      navigate(defaultRoute, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const tokenError = error.fieldError('token');
        if (tokenError) {
          setInvalidTokenMessage(tokenError);
          return;
        }

        if (error.fieldError('password')) {
          setError('password', { message: error.fieldError('password') });
        }
        toast.error('Could not set your password', error.message);
      } else {
        toast.error('Could not set your password', 'We could not reach the server. Check your connection and try again.');
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f8f7] px-5 py-10 text-strong sm:px-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-9 flex items-center justify-center gap-3">
          <Logomark size={21} />
          <div>
            <p className="font-display text-base font-semibold text-strong">Valtireo</p>
            <p className="text-xs text-muted">Organizational OS</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-[0_18px_60px_rgba(18,63,58,0.10)] sm:p-8">
          {invalidTokenMessage ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-danger-bg text-danger">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h2 className="font-display text-xl font-semibold tracking-normal text-strong">This invitation isn't valid</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{invalidTokenMessage}</p>
              <p className="mt-4 text-sm leading-6 text-muted">
                Ask your organization admin to send a new invitation, or sign in if you already have a password.
              </p>
              <Button type="button" variant="secondary" className="mt-5 w-full" onClick={() => navigate('/login')}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-pine text-white">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h2 className="font-display text-2xl font-semibold tracking-normal text-strong">Set your password</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Choose a password to activate your Valtireo account and sign in.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
                <Field label="Password" htmlFor="password" error={errors.password?.message} required>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      autoFocus
                      invalid={Boolean(errors.password)}
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

                <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    invalid={Boolean(errors.confirmPassword)}
                    className="h-10"
                    {...register('confirmPassword')}
                  />
                </Field>

                <Button type="submit" variant="primary" className="mt-1 h-10 w-full" isLoading={isSubmitting}>
                  {isSubmitting ? (
                    'Setting password...'
                  ) : (
                    <>
                      Activate account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
