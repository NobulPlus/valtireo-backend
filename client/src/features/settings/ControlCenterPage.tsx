import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileStack,
  PanelTop,
  Settings,
  UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useSetupChecklist } from '@/features/workspace/api';
import { cn } from '@/lib/cn';

const DOMAINS = [
  {
    key: 'core',
    name: 'Workspace',
    line: 'Brand, locale, employee experience',
    detail: 'Where the company shapes how the product feels to its people.',
    to: '/workspace',
    cta: 'Tune workspace',
    icon: Settings,
    tone: 'teal',
  },
  {
    key: 'structure',
    name: 'Structure',
    line: 'Locations, teams, jobs, grades',
    detail: 'The backbone every employee, workflow, and report depends on.',
    to: '/settings/structure',
    cta: 'Shape structure',
    icon: Building2,
    tone: 'blue',
  },
  {
    key: 'employees',
    name: 'People records',
    line: 'Profiles, onboarding, custom fields',
    detail: 'Create and govern employee records from draft to active.',
    to: '/employees',
    cta: 'Manage people',
    icon: UsersRound,
    tone: 'teal',
  },
  {
    key: 'documents',
    name: 'Documents',
    line: 'Types, requirements, reviews',
    detail: 'Define what employees submit and how compliance is proven.',
    to: '/documents',
    cta: 'Control documents',
    icon: FileStack,
    tone: 'gold',
  },
  {
    key: 'approvals',
    name: 'Approvals',
    line: 'Rules, steps, decisions',
    detail: 'Route decisions through the people who own them.',
    to: '/approvals',
    cta: 'Build routes',
    icon: ClipboardCheck,
    tone: 'gold',
  },
  {
    key: 'leave',
    name: 'Leave',
    line: 'Types, periods, holidays',
    detail: 'Set the company calendar and time-away policy.',
    to: '/leave',
    cta: 'Set leave rules',
    icon: CalendarClock,
    tone: 'blue',
  },
  {
    key: 'attendance',
    name: 'Attendance',
    line: 'Policy, shifts, corrections',
    detail: 'Define the working rhythm and exception process.',
    to: '/attendance',
    cta: 'Set attendance',
    icon: BadgeCheck,
    tone: 'teal',
  },
  {
    key: 'reports',
    name: 'Reports',
    line: 'Exports and operating evidence',
    detail: 'Pull trusted snapshots from this organization’s records.',
    to: '/reports',
    cta: 'Open reports',
    icon: BarChart3,
    tone: 'blue',
  },
];

const FUTURE_SPACES = [
  { name: 'Connect', line: 'Employee communication, announcements, and shared channels' },
  { name: 'Community', line: 'Company culture, recognition, circles, and internal belonging' },
  { name: 'Learning', line: 'Training paths, policy acknowledgements, and role readiness' },
  { name: 'Assets', line: 'Equipment assignment, recovery, and lifecycle evidence' },
];

const toneClasses = {
  teal: 'bg-teal-light text-teal border-teal/20',
  blue: 'bg-info-bg text-info border-info/20',
  gold: 'bg-warning-bg text-warning border-warning/20',
};

function ControlCenterContent() {
  const checklistQuery = useSetupChecklist();

  if (checklistQuery.isLoading) return <LoadingState label="Loading workspace controls..." />;
  if (checklistQuery.isError) {
    return <ErrorState error={checklistQuery.error} onRetry={() => checklistQuery.refetch()} />;
  }
  if (!checklistQuery.data) return null;

  const checklist = checklistQuery.data;
  const sectionByKey = new Map(checklist.sections.map((section) => [section.key, section]));
  const requiredProgress = checklist.summary.required_percentage;
  const remaining = checklist.next_actions;
  const ready = checklist.status === 'ready';

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-lg border border-border bg-pine text-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_340px]">
          <div className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10">
                <PanelTop className="h-5 w-5 text-white/85" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Workspace command</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-white">
                  {checklist.organization.name}
                </h2>
              </div>
            </div>

            <div className="max-w-3xl">
              <p className="text-sm leading-6 text-white/72">
                This is where the organization’s operating model is shaped: who belongs where, what documents matter,
                how approvals move, and how time is governed.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PulseMetric label="Required" value={`${requiredProgress}%`} />
              <PulseMetric label="Completed" value={`${checklist.summary.total_completed}/${checklist.summary.total_items}`} />
              <PulseMetric label="Modules" value={String(checklist.modules.length)} />
              <PulseMetric label="Status" value={ready ? 'Ready' : 'Open'} />
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.04] p-6 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between text-xs text-white/55">
              <span>Setup runway</span>
              <span>{requiredProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full bg-bridge-teal" style={{ width: `${requiredProgress}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {remaining.length === 0 ? (
                <div className="rounded-md border border-white/10 bg-white/[0.08] p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <CheckCircle2 className="h-4 w-4 text-bridge-teal" />
                    Setup is complete
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    The workspace is configured enough for daily HR operations.
                  </p>
                </div>
              ) : (
                remaining.slice(0, 3).map((item) => (
                  <div key={item.key} className="rounded-md border border-white/10 bg-white/[0.08] p-3">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    {item.description && <p className="mt-1 text-xs leading-5 text-white/55">{item.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {DOMAINS.map((domain) => {
          const section = sectionByKey.get(domain.key);
          const Icon = domain.icon;
          const completed = section?.completed ?? (domain.key === 'core' ? checklist.summary.required_completed : 0);
          const total = section?.total ?? (domain.key === 'core' ? checklist.summary.required_total : 0);
          const isComplete = total > 0 ? completed >= total : ready;
          const progress = total > 0 ? Math.round((completed / total) * 100) : requiredProgress;

          return (
            <Link
              key={domain.key}
              to={domain.to}
              className="group rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_8px_18px_rgba(16,24,40,0.08)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-md border', toneClasses[domain.tone as keyof typeof toneClasses])}>
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    isComplete ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning',
                  )}
                >
                  {isComplete ? 'Set' : 'Open'}
                </span>
              </div>

              <p className="font-display text-base font-semibold text-strong">{domain.name}</p>
              <p className="mt-1 text-xs font-medium text-muted">{domain.line}</p>
              <p className="mt-3 min-h-12 text-sm leading-5 text-muted">{domain.detail}</p>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                  <span>{completed}/{total || checklist.summary.total_items}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm font-medium text-pine">
                <span>{domain.cta}</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-strong">Product expansion shelf</p>
            <p className="mt-1 text-sm text-muted">
              These spaces are part of the Valtireo direction, but they stay outside the main navigation until their
              workflows are implemented.
            </p>
          </div>
          <span className="w-fit rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted">Roadmap</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {FUTURE_SPACES.map((space) => (
            <div key={space.name} className="rounded-md border border-dashed border-border bg-canvas px-4 py-3">
              <p className="text-sm font-semibold text-strong">{space.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{space.line}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PulseMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.08] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function ControlCenterPage() {
  return (
    <div>
      <PageHeader
        title="Control center"
        subtitle="The operating console for this company’s structure, rules, approvals, compliance, time, and reports."
      />
      <RequirePermission permission="workspace_settings.update">
        <ControlCenterContent />
      </RequirePermission>
    </div>
  );
}
