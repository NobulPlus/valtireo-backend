import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Palette, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useSetupChecklist, useWorkspace } from '@/features/workspace/api';
import { api, ApiError } from '@/lib/apiClient';
import type { WorkspaceSettings } from '@/types/api';
import { cn } from '@/lib/cn';
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
    welcome_message: string;
    support_email: string;
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
  } | null>(null);

  useEffect(() => {
    const workspace = workspaceQuery.data?.workspace;
    if (workspace && !form) {
      setForm({
        welcome_message: workspace.identity.welcome_message,
        support_email: workspace.identity.support_email ?? '',
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
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch<{ workspace: WorkspaceSettings }>('/workspace/settings', {
        identity: {
          welcome_message: form?.welcome_message,
          support_email: form?.support_email || null,
        },
        theme: {
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

  if (workspaceQuery.isLoading) return <LoadingState label="Loading workspace…" />;
  if (workspaceQuery.isError) return <ErrorState error={workspaceQuery.error} onRetry={() => workspaceQuery.refetch()} />;

  const workspace = workspaceQuery.data?.workspace;
  if (!workspace || !form) return null;

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
              <Field label="Welcome message" className="sm:col-span-2">
                <Input
                  value={form.welcome_message}
                  onChange={(event) => setForm({ ...form, welcome_message: event.target.value })}
                />
              </Field>
              <Field label="Support email">
                <Input
                  type="email"
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
                <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
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
                  <select
                    value={form.font_family}
                    onChange={(event) => setForm({ ...form, font_family: event.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/15"
                  >
                    {['Inter', 'Roboto', 'Lato', 'Montserrat', 'Open Sans', 'Source Sans 3'].map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Density">
                  <select
                    value={form.density}
                    onChange={(event) => setForm({ ...form, density: event.target.value })}
                    className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/15"
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </Field>
              </div>

              <div className="rounded-md border border-border bg-surface-soft p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</p>
                <div className="overflow-hidden rounded-md border border-border bg-white">
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
          <CardBody className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <SettingRow label="Employee directory" enabled={workspace.employee_experience.allow_employee_directory} />
            <SettingRow label="Org chart" enabled={workspace.employee_experience.show_org_chart} />
            <SettingRow
              label="Profile self-corrections"
              enabled={workspace.employee_experience.allow_profile_corrections}
            />
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

function SettingRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-strong">{label}</span>
      <span className={cn('text-xs font-medium', enabled ? 'text-success' : 'text-muted')}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
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
