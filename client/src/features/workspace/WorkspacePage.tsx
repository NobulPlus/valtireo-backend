import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Palette, Save, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logomark } from '@/components/ui/Logomark';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useSetupChecklist, useUploadWorkspaceLogo, useRemoveWorkspaceLogo, useWorkspace } from '@/features/workspace/api';
import { api, ApiError } from '@/lib/apiClient';
import type { WorkspaceSettings } from '@/types/api';
import { cn } from '@/lib/cn';
import { isValidEmail } from '@/lib/validation';
import { useAuth } from '@/context/AuthContext';

function setupControlRoute(actionUrl?: string): string | null {
  if (!actionUrl) return null;
  if (actionUrl.startsWith('/workspace')) return '/workspace';
  if (actionUrl.startsWith('/setup')) return '/settings/structure';
  if (actionUrl.startsWith('/employees')) return '/employees';
  if (actionUrl.startsWith('/employee-profile/custom-fields')) return '/employees';
  if (actionUrl.startsWith('/documents')) return '/documents';
  if (actionUrl.startsWith('/approval-workflows')) return '/approvals';
  if (actionUrl.startsWith('/leave')) return '/leave';
  if (actionUrl.startsWith('/attendance')) return '/attendance';
  if (actionUrl.startsWith('/reports')) return '/reports';
  if (actionUrl.startsWith('/users')) return '/settings/control-center';
  return null;
}

function WorkspaceContent() {
  const workspaceQuery = useWorkspace();
  const checklistQuery = useSetupChecklist();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();

  const [form, setForm] = useState<{
    name: string;
    short_name: string;
    welcome_message: string;
    support_email: string;
    mode: string;
    primary_color: string;
    accent_color: string;
    sidebar_color: string;
    button_color: string;
    font_family: string;
    radius: string;
    density: string;
    timezone: string;
    date_format: string;
    currency: string;
    allow_employee_directory: boolean;
    show_org_chart: boolean;
    allow_profile_corrections: boolean;
  } | null>(null);

  useEffect(() => {
    const workspace = workspaceQuery.data?.workspace;
    if (workspace && !form) {
      setForm({
        name: workspace.workspace_name,
        short_name: workspace.identity.short_name ?? '',
        welcome_message: workspace.identity.welcome_message,
        support_email: workspace.identity.support_email ?? '',
        mode: workspace.theme.mode,
        primary_color: workspace.theme.primary_color,
        accent_color: workspace.theme.accent_color,
        sidebar_color: workspace.theme.sidebar_color,
        button_color: workspace.theme.button_color,
        font_family: workspace.theme.font_family,
        radius: workspace.theme.radius,
        density: workspace.theme.density,
        timezone: workspace.localization.timezone,
        date_format: workspace.localization.date_format,
        currency: workspace.localization.currency,
        allow_employee_directory: workspace.employee_experience.allow_employee_directory,
        show_org_chart: workspace.employee_experience.show_org_chart,
        allow_profile_corrections: workspace.employee_experience.allow_profile_corrections,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch<{ workspace: WorkspaceSettings }>('/workspace/settings', {
        name: form?.name,
        identity: {
          short_name: form?.short_name || null,
          welcome_message: form?.welcome_message,
          support_email: form?.support_email || null,
        },
        theme: {
          mode: form?.mode,
          primary_color: form?.primary_color,
          accent_color: form?.accent_color,
          sidebar_color: form?.sidebar_color,
          button_color: form?.button_color,
          font_family: form?.font_family,
          radius: form?.radius,
          density: form?.density,
        },
        localization: {
          timezone: form?.timezone,
          date_format: form?.date_format,
          currency: form?.currency,
        },
        employee_experience: {
          allow_employee_directory: form?.allow_employee_directory,
          show_org_chart: form?.show_org_chart,
          allow_profile_corrections: form?.allow_profile_corrections,
        },
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await refresh();
      toast.success('Workspace saved', 'Changes were saved to the audit trail.');
    },
    onError: (error) => {
      toast.error(
        'Could not save workspace',
        error instanceof ApiError ? error.message : 'Could not save changes.',
      );
    },
  });

  if (workspaceQuery.isLoading) return <LoadingState label="Loading workspace…" fill />;
  if (workspaceQuery.isError) return <ErrorState error={workspaceQuery.error} onRetry={() => workspaceQuery.refetch()} />;

  const workspace = workspaceQuery.data?.workspace;
  if (!workspace || !form) return null;

  const supportEmailError =
    form.support_email && !isValidEmail(form.support_email) ? 'Enter a valid email address' : undefined;
  const nameError = form.name.trim().length === 0 ? 'Organization name is required' : undefined;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization identity</CardTitle>
          </CardHeader>
          <CardBody>
            <form
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateMutation.mutate();
              }}
            >
              <OrgLogoField logoUrl={workspace.identity.logo_url} />
              <Field label="Organization name" error={nameError}>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Short name" hint="Shown next to the logo in the sidebar instead of the full name.">
                <Input
                  value={form.short_name}
                  onChange={(event) => setForm({ ...form, short_name: event.target.value })}
                  placeholder={form.name || 'e.g. Valtireo'}
                  maxLength={40}
                />
              </Field>
              <Field label="Welcome message" className="sm:col-span-2">
                <Input
                  value={form.welcome_message}
                  onChange={(event) => setForm({ ...form, welcome_message: event.target.value })}
                />
              </Field>
              <Field label="Support email" error={supportEmailError}>
                <Input
                  type="email"
                  invalid={Boolean(supportEmailError)}
                  value={form.support_email}
                  onChange={(event) => setForm({ ...form, support_email: event.target.value })}
                  placeholder="support@yourorg.com"
                />
              </Field>
              <Field label="Timezone">
                <Input
                  value={form.timezone}
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                />
              </Field>
              <Field label="Date format">
                <Input
                  value={form.date_format}
                  onChange={(event) => setForm({ ...form, date_format: event.target.value })}
                />
              </Field>
              <Field label="Currency">
                <Input
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                />
              </Field>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" variant="primary" isLoading={updateMutation.isPending} disabled={Boolean(supportEmailError) || Boolean(nameError)}>
                  <Save className="h-3.5 w-3.5" />
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-teal" />
              Workspace design system
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Default theme"
                  hint="Applies to anyone in this organization who hasn't chosen a personal light/dark preference of their own."
                  className="sm:col-span-2"
                >
                  <SelectMenu
                    value={form.mode}
                    onChange={(value) => setForm({ ...form, mode: value })}
                    options={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'system', label: "Match each person's device" },
                    ]}
                  />
                </Field>
                <ColorField
                  label="Primary color"
                  value={form.primary_color}
                  onChange={(value) => setForm({ ...form, primary_color: value })}
                />
                <ColorField
                  label="Accent color"
                  value={form.accent_color}
                  onChange={(value) => setForm({ ...form, accent_color: value })}
                />
                <ColorField
                  label="Sidebar color"
                  value={form.sidebar_color}
                  onChange={(value) => setForm({ ...form, sidebar_color: value })}
                />
                <ColorField
                  label="Button color"
                  value={form.button_color}
                  onChange={(value) => setForm({ ...form, button_color: value })}
                />
                <Field label="Font family">
                  <SelectMenu
                    value={form.font_family}
                    onChange={(value) => setForm({ ...form, font_family: value })}
                    options={['Inter', 'Roboto', 'Lato', 'Montserrat', 'Open Sans', 'Source Sans 3'].map((font) => ({
                      value: font,
                      label: font,
                    }))}
                  />
                </Field>
                <Field label="Density">
                  <SelectMenu
                    value={form.density}
                    onChange={(value) => setForm({ ...form, density: value })}
                    options={[
                      { value: 'compact', label: 'Compact' },
                      { value: 'comfortable', label: 'Comfortable' },
                      { value: 'spacious', label: 'Spacious' },
                    ]}
                  />
                </Field>
                <Field label="Corner radius">
                  <SelectMenu
                    value={form.radius}
                    onChange={(value) => setForm({ ...form, radius: value })}
                    options={[
                      { value: 'sharp', label: 'Sharp' },
                      { value: 'soft', label: 'Soft' },
                      { value: 'rounded', label: 'Rounded' },
                    ]}
                  />
                </Field>
              </div>

              <div className="rounded-md border border-border bg-surface-soft p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</p>
                <div className="overflow-hidden rounded-md border border-border bg-surface">
                  <div className="flex min-h-36">
                    <div className="w-20 p-3 text-white" style={{ background: form.sidebar_color }}>
                      <div className="mb-4 h-5 w-8 rounded-sm bg-white/25" />
                      <div className="space-y-2">
                        <div className="h-2 rounded-full bg-white/45" />
                        <div className="h-2 rounded-full bg-white/25" />
                        <div className="h-2 rounded-full bg-white/25" />
                      </div>
                    </div>
                    <div className="flex-1 p-4" style={{ fontFamily: form.font_family }}>
                      <p className="text-sm font-semibold text-strong">{workspace.workspace_name}</p>
                      <p className="mt-1 text-xs text-muted">{form.welcome_message}</p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-surface-soft p-2">
                          <div className="h-2 w-10 rounded-full" style={{ background: form.primary_color }} />
                          <div className="mt-2 h-2 w-16 rounded-full bg-border" />
                        </div>
                        <div className="rounded-md bg-surface-soft p-2">
                          <div className="h-2 w-8 rounded-full" style={{ background: form.accent_color }} />
                          <div className="mt-2 h-2 w-14 rounded-full bg-border" />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-4 h-8 rounded-md px-3 text-xs font-semibold text-white"
                        style={{ background: form.button_color }}
                      >
                        Primary action
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Button type="button" variant="primary" isLoading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                <Save className="h-3.5 w-3.5" />
                Save design system
              </Button>
              <p className="text-xs text-muted">Saved colors apply to the app shell and primary actions after session refresh.</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee experience</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <SettingToggle
                label="Employee directory"
                checked={form.allow_employee_directory}
                onChange={(checked) => setForm({ ...form, allow_employee_directory: checked })}
              />
              <SettingToggle
                label="Org chart"
                checked={form.show_org_chart}
                onChange={(checked) => setForm({ ...form, show_org_chart: checked })}
              />
              <SettingToggle
                label="Profile self-corrections"
                checked={form.allow_profile_corrections}
                onChange={(checked) => setForm({ ...form, allow_profile_corrections: checked })}
              />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Button type="button" variant="primary" isLoading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                <Save className="h-3.5 w-3.5" />
                Save employee experience
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Setup checklist</CardTitle>
          </CardHeader>
          <CardBody>
            {checklistQuery.isLoading && <LoadingState label="Loading checklist..." />}
            {checklistQuery.isError && (
              <p className="text-sm text-muted">Checklist unavailable for your role.</p>
            )}
            {checklistQuery.data && (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span>Required progress</span>
                    <span>{checklistQuery.data.summary.required_percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full bg-teal"
                      style={{ width: `${checklistQuery.data.summary.required_percentage}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-md bg-surface-soft px-3 py-2 text-xs text-muted">
                  {checklistQuery.data.summary.total_completed} of {checklistQuery.data.summary.total_items} setup
                  items complete.
                </div>
                <div className="flex flex-col gap-3">
                  {checklistQuery.data.sections.map((section) => (
                    <div key={section.key} className="rounded-md border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-strong">{section.label}</p>
                        <span className="text-xs text-muted">
                          {section.completed}/{section.total}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-2">
                        {section.items.map((item) => (
                          <li key={item.key} className="flex items-start gap-2 text-sm">
                            {item.completed ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
                            )}
                            {setupControlRoute(item.action?.url) ? (
                              <Link
                                to={setupControlRoute(item.action?.url) ?? '/settings/control-center'}
                                className={cn(
                                  'hover:text-teal',
                                  item.completed ? 'text-muted line-through' : 'text-strong',
                                )}
                              >
                                {item.label}
                              </Link>
                            ) : (
                              <span className={cn(item.completed ? 'text-muted line-through' : 'text-strong')}>
                                {item.label}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-strong">{label}</span>
      <span className="flex items-center gap-2">
        <span className={cn('text-xs font-medium', checked ? 'text-success' : 'text-muted')}>
          {checked ? 'Enabled' : 'Disabled'}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
      </span>
    </label>
  );
}

function OrgLogoField({ logoUrl }: { logoUrl: string | null }) {
  const uploadMutation = useUploadWorkspaceLogo();
  const removeMutation = useRemoveWorkspaceLogo();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      await uploadMutation.mutateAsync(file);
      setImageFailed(false);
      toast.success('Logo updated', 'Your organization logo now appears in the sidebar.');
    } catch (error) {
      toast.error('Could not upload logo', error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  async function handleRemove() {
    try {
      await removeMutation.mutateAsync();
      toast.success('Logo removed', 'Switched back to the Valtireo mark.');
    } catch (error) {
      toast.error('Could not remove logo', error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const showImage = Boolean(logoUrl) && !imageFailed;

  return (
    <Field label="Organization logo" className="sm:col-span-2" hint="PNG, JPG, or WEBP, up to 2MB. Shown in your sidebar after login.">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-soft">
          {showImage ? (
            <img
              src={logoUrl ?? undefined}
              alt="Organization logo"
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Logomark size={24} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="secondary"
            isLoading={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload logo
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" isLoading={removeMutation.isPending} onClick={handleRemove}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 rounded-md border border-border"
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </Field>
  );
}

export function WorkspacePage() {
  return (
    <div>
      <PageHeader
        title="Workspace"
        subtitle="Organization identity, theme, localization, and setup progress."
      />
      <RequirePermission permission="workspace_settings.view">
        <WorkspaceContent />
      </RequirePermission>
    </div>
  );
}
