import { useMemo, useState } from 'react';
import { Banknote, Download, FileSpreadsheet, Landmark, Plus, Settings as SettingsIcon, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useEmployees } from '@/features/employees/api';
import {
  downloadPayrollRegister,
  useCreatePayGroup,
  useCreatePayrollComponent,
  useCreatePayrollInput,
  useCreatePayrollLoan,
  useCreatePayrollRun,
  usePayGroups,
  usePayrollComponents,
  usePayrollInputs,
  usePayrollLoans,
  usePayrollReportSummary,
  usePayrollRuns,
  usePayrollSettings,
  usePayrollStatutoryReport,
  useUpdatePayGroup,
  useUpdatePayrollComponent,
  useUpdatePayrollSettings,
  type CreatePayrollRunPayload,
  type PayGroupPayload,
  type PayrollComponentPayload,
  type PayrollInputPayload,
  type PayrollLoanPayload,
} from '@/features/payroll/api';
import { PayrollRunDetailModal } from '@/features/payroll/PayrollRunDetailModal';
import { useCurrencyFormatter } from '@/features/payroll/useCurrencyFormatter';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { EmployeeLoan, PayFrequency, PayGroup, PayrollComponent, PayrollInput } from '@/types/api';

type Tab = 'settings' | 'runs' | 'inputs' | 'reports';

const TAB_OPTIONS: Array<{ value: Tab; label: string }> = [
  { value: 'settings', label: 'Settings' },
  { value: 'runs', label: 'Runs' },
  { value: 'inputs', label: 'Inputs & loans' },
  { value: 'reports', label: 'Reports' },
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function TabSwitcher({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border border-border p-1">
      {TAB_OPTIONS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            value === tab.value ? 'bg-teal text-white' : 'text-muted hover:text-strong'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('payroll.settings.update');
  const settingsQuery = usePayrollSettings();
  const updateMutation = useUpdatePayrollSettings();
  const payGroupsQuery = usePayGroups();
  const componentsQuery = usePayrollComponents();

  const [payGroupModal, setPayGroupModal] = useState<PayGroup | 'new' | null>(null);
  const [componentModal, setComponentModal] = useState<PayrollComponent | 'new' | null>(null);

  const settings = settingsQuery.data;

  async function handleSettingsChange(patch: Parameters<typeof updateMutation.mutateAsync>[0]) {
    try {
      await updateMutation.mutateAsync(patch);
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Could not update settings', actionError(error, 'Could not update payroll settings.'));
    }
  }

  if (settingsQuery.isLoading) return <LoadingState label="Loading payroll settings…" />;
  if (settingsQuery.isError || !settings) return <ErrorState error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Currency</span>
            <Input
              value={settings.currency}
              disabled={!canUpdate}
              onChange={(e) => handleSettingsChange({ currency: e.target.value.toUpperCase() })}
              maxLength={3}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Default pay frequency</span>
            <SelectMenu
              value={settings.default_pay_frequency}
              onChange={(value) => handleSettingsChange({ default_pay_frequency: value as PayFrequency })}
              options={FREQUENCY_OPTIONS}
              disabled={!canUpdate}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Pay day (day of month)</span>
            <Input
              type="number"
              min={1}
              max={31}
              value={settings.pay_day}
              disabled={!canUpdate}
              onChange={(e) => handleSettingsChange({ pay_day: Number(e.target.value) })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Proration basis</span>
            <SelectMenu
              value={settings.proration_basis}
              onChange={(value) => handleSettingsChange({ proration_basis: value as 'calendar_days' | 'working_days' })}
              options={[
                { value: 'calendar_days', label: 'Calendar days' },
                { value: 'working_days', label: 'Working days' },
              ]}
              disabled={!canUpdate}
            />
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statutory rules</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-strong">Pension</p>
              <p className="mt-1 text-xs text-muted">
                {settings.statutory_rules.pension.enabled
                  ? `${settings.statutory_rules.pension.employee_rate}% employee / ${settings.statutory_rules.pension.employer_rate}% employer`
                  : 'Disabled'}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-strong">PAYE</p>
              <p className="mt-1 text-xs text-muted">{settings.statutory_rules.paye.enabled ? 'Enabled' : 'Disabled — configure brackets to enable'}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-strong">NHF</p>
              <p className="mt-1 text-xs text-muted">{settings.statutory_rules.nhf.enabled ? `${settings.statutory_rules.nhf.employee_rate}%` : 'Disabled'}</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            Statutory rates are organization-wide defaults. Individual employees only have pension/PAYE/NHF deducted once
            enabled on their own statutory profile, from the employee's Payroll tab.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay groups</CardTitle>
          {canUpdate && (
            <Button type="button" size="sm" onClick={() => setPayGroupModal('new')}>
              <Plus className="h-3.5 w-3.5" /> Add pay group
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {payGroupsQuery.isLoading && <LoadingState label="Loading pay groups…" />}
          {payGroupsQuery.data && payGroupsQuery.data.length === 0 && (
            <EmptyState title="No pay groups yet" description="Pay groups let you process weekly, biweekly, and monthly staff separately." />
          )}
          {payGroupsQuery.data && payGroupsQuery.data.length > 0 && (
            <ul className="divide-y divide-border">
              {payGroupsQuery.data.map((group) => (
                <li key={group.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">{group.name}</p>
                    <p className="text-xs text-muted">
                      {group.code} · {group.frequency} · pays on day {group.pay_day}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={group.is_active ? 'active' : 'inactive'} />
                    {canUpdate && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setPayGroupModal(group)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          {canUpdate && (
            <Button type="button" size="sm" onClick={() => setComponentModal('new')}>
              <Plus className="h-3.5 w-3.5" /> Add component
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {componentsQuery.isLoading && <LoadingState label="Loading components…" />}
          {componentsQuery.data && componentsQuery.data.length === 0 && (
            <EmptyState title="No components yet" description="Components are the reusable earnings, deductions, and employer contributions attached to compensation." />
          )}
          {componentsQuery.data && componentsQuery.data.length > 0 && (
            <ul className="divide-y divide-border">
              {componentsQuery.data.map((component) => (
                <li key={component.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">{component.name}</p>
                    <p className="text-xs text-muted">
                      {component.code} · {component.type.replace('_', ' ')} ·{' '}
                      {component.calculation_type === 'percentage' ? `${component.default_value}%` : component.default_value}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={component.is_active ? 'active' : 'inactive'} />
                    {canUpdate && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setComponentModal(component)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <PayGroupModal payGroup={payGroupModal} onClose={() => setPayGroupModal(null)} />
      <PayrollComponentModal
        component={componentModal}
        components={componentsQuery.data ?? []}
        onClose={() => setComponentModal(null)}
      />
    </div>
  );
}

function PayGroupModal({ payGroup, onClose }: { payGroup: PayGroup | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const isNew = payGroup === 'new';
  const createMutation = useCreatePayGroup();
  const updateMutation = useUpdatePayGroup(payGroup && payGroup !== 'new' ? payGroup.id : 0);
  const mutation = isNew ? createMutation : updateMutation;

  const [name, setName] = useState(payGroup && payGroup !== 'new' ? payGroup.name : '');
  const [code, setCode] = useState(payGroup && payGroup !== 'new' ? payGroup.code : '');
  const [frequency, setFrequency] = useState<string>(payGroup && payGroup !== 'new' ? payGroup.frequency : 'monthly');
  const [payDay, setPayDay] = useState(payGroup && payGroup !== 'new' ? String(payGroup.pay_day) : '25');

  async function handleSubmit() {
    if (!name.trim() || (isNew && !code.trim()) || !payDay) return;
    const payload: PayGroupPayload = { name: name.trim(), frequency, pay_day: Number(payDay) };
    if (isNew) payload.code = code.trim();
    try {
      await mutation.mutateAsync(payload);
      toast.success(isNew ? 'Pay group created' : 'Pay group updated');
      onClose();
    } catch (error) {
      toast.error('Could not save pay group', actionError(error, 'Could not save this pay group.'));
    }
  }

  return (
    <Modal
      open={payGroup !== null}
      onClose={onClose}
      title={isNew ? 'Add pay group' : 'Edit pay group'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Save" isLoading={mutation.isPending} disabled={!name.trim()} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly payroll" />
        </label>
        {isNew && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Code</span>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. MONTHLY" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Frequency</span>
            <SelectMenu value={frequency} onChange={setFrequency} options={FREQUENCY_OPTIONS} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Pay day</span>
            <Input type="number" min={1} max={31} value={payDay} onChange={(e) => setPayDay(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}

const COMPONENT_TYPE_OPTIONS = [
  { value: 'earning', label: 'Earning' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'employer_contribution', label: 'Employer contribution' },
];

function PayrollComponentModal({
  component,
  components,
  onClose,
}: {
  component: PayrollComponent | 'new' | null;
  components: PayrollComponent[];
  onClose: () => void;
}) {
  const toast = useToast();
  const isNew = component === 'new';
  const createMutation = useCreatePayrollComponent();
  const updateMutation = useUpdatePayrollComponent(component && component !== 'new' ? component.id : 0);
  const mutation = isNew ? createMutation : updateMutation;

  const [name, setName] = useState(component && component !== 'new' ? component.name : '');
  const [code, setCode] = useState(component && component !== 'new' ? component.code : '');
  const [type, setType] = useState<string>(component && component !== 'new' ? component.type : 'earning');
  const [calculationType, setCalculationType] = useState<string>(component && component !== 'new' ? component.calculation_type : 'fixed');
  const [defaultValue, setDefaultValue] = useState(component && component !== 'new' ? component.default_value : '0');
  const [isTaxable, setIsTaxable] = useState(component && component !== 'new' ? component.is_taxable : false);

  const percentageBaseOptions = [
    { value: '', label: 'No base (flat)' },
    ...components.filter((c) => component === 'new' || c.id !== component?.id).map((c) => ({ value: String(c.id), label: c.name })),
  ];
  const [percentageBase, setPercentageBase] = useState(
    component && component !== 'new' && component.percentage_of_component_id ? String(component.percentage_of_component_id) : '',
  );

  async function handleSubmit() {
    if (!name.trim() || (isNew && !code.trim()) || !defaultValue) return;
    const payload: PayrollComponentPayload = {
      name: name.trim(),
      type,
      calculation_type: calculationType,
      default_value: Number(defaultValue),
      percentage_of_component_id: percentageBase ? Number(percentageBase) : null,
      is_taxable: isTaxable,
    };
    if (isNew) payload.code = code.trim();
    try {
      await mutation.mutateAsync(payload);
      toast.success(isNew ? 'Component created' : 'Component updated');
      onClose();
    } catch (error) {
      toast.error('Could not save component', actionError(error, 'Could not save this component.'));
    }
  }

  return (
    <Modal
      open={component !== null}
      onClose={onClose}
      title={isNew ? 'Add component' : 'Edit component'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Save" isLoading={mutation.isPending} disabled={!name.trim()} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Housing allowance" />
        </label>
        {isNew && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Code</span>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. HOUSING" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Type</span>
            <SelectMenu value={type} onChange={setType} options={COMPONENT_TYPE_OPTIONS} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Calculation</span>
            <SelectMenu
              value={calculationType}
              onChange={setCalculationType}
              options={[
                { value: 'fixed', label: 'Fixed amount' },
                { value: 'percentage', label: 'Percentage' },
              ]}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">{calculationType === 'percentage' ? 'Default rate (%)' : 'Default amount'}</span>
            <Input type="number" min={0} value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
          </label>
          {calculationType === 'percentage' && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Percentage of</span>
              <SelectMenu value={percentageBase} onChange={setPercentageBase} options={percentageBaseOptions} />
            </label>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} className="h-4 w-4 rounded border-border" />
          <span className="text-muted">Taxable</span>
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Runs tab
// ---------------------------------------------------------------------------

function RunsTab() {
  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('payroll.runs.manage');
  const runsQuery = usePayrollRuns();
  const payGroupsQuery = usePayGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [openRunId, setOpenRunId] = useState<number | null>(null);

  const runs = runsQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {canManage && (
          <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Create run
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {runsQuery.isLoading && <LoadingState label="Loading payroll runs…" />}
          {runsQuery.isError && <ErrorState error={runsQuery.error} onRetry={() => runsQuery.refetch()} />}
          {runsQuery.data && runs.length === 0 && (
            <EmptyState title="No payroll runs yet" description="Create a run for a pay period to start processing payroll." />
          )}
          {runs.length > 0 && (
            <ul className="divide-y divide-border">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-surface-soft"
                  onClick={() => setOpenRunId(run.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{run.name}</p>
                    <p className="text-xs text-muted">
                      {run.reference} · {formatDate(run.period_start)} → {formatDate(run.period_end)} · {run.employee_count} employee(s)
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-strong">{formatCurrency(run.total_net, run.currency)}</span>
                    <StatusBadge status={run.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <CreateRunModal open={createOpen} payGroups={payGroupsQuery.data ?? []} onClose={() => setCreateOpen(false)} />
      <PayrollRunDetailModal runId={openRunId} onClose={() => setOpenRunId(null)} />
    </div>
  );
}

function CreateRunModal({ open, payGroups, onClose }: { open: boolean; payGroups: PayGroup[]; onClose: () => void }) {
  const toast = useToast();
  const createMutation = useCreatePayrollRun();
  const settingsQuery = usePayrollSettings();

  const [form, setForm] = useState({ pay_group_id: '', reference: '', name: '', period_start: '', period_end: '', payment_date: '' });

  async function handleSubmit() {
    if (!form.reference.trim() || !form.name.trim() || !form.period_start || !form.period_end || !form.payment_date) return;
    const payload: CreatePayrollRunPayload = {
      pay_group_id: form.pay_group_id ? Number(form.pay_group_id) : null,
      reference: form.reference.trim(),
      name: form.name.trim(),
      period_start: form.period_start,
      period_end: form.period_end,
      payment_date: form.payment_date,
      currency: settingsQuery.data?.currency ?? 'NGN',
    };
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Payroll run created');
      setForm({ pay_group_id: '', reference: '', name: '', period_start: '', period_end: '', payment_date: '' });
      onClose();
    } catch (error) {
      toast.error('Could not create run', actionError(error, 'Could not create this payroll run.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create payroll run"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction
            title="Create"
            isLoading={createMutation.isPending}
            disabled={!form.reference.trim() || !form.name.trim() || !form.period_start || !form.period_end || !form.payment_date}
            onClick={handleSubmit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. August 2026 payroll" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Reference</span>
          <Input value={form.reference} onChange={(e) => setForm((c) => ({ ...c, reference: e.target.value }))} placeholder="e.g. PAY-2026-08" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Pay group (optional — all employees if blank)</span>
          <SelectMenu
            value={form.pay_group_id}
            onChange={(value) => setForm((c) => ({ ...c, pay_group_id: value }))}
            options={[{ value: '', label: 'All employees' }, ...payGroups.map((g) => ({ value: String(g.id), label: g.name }))]}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Period start</span>
            <DatePicker value={form.period_start} onChange={(value) => setForm((c) => ({ ...c, period_start: value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Period end</span>
            <DatePicker value={form.period_end} onChange={(value) => setForm((c) => ({ ...c, period_end: value }))} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Payment date</span>
          <DatePicker value={form.payment_date} onChange={(value) => setForm((c) => ({ ...c, payment_date: value }))} />
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Inputs & loans tab
// ---------------------------------------------------------------------------

const INPUT_TYPE_OPTIONS = [
  { value: 'bonus', label: 'Bonus' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'adjustment', label: 'Adjustment' },
];

function InputsTab() {
  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('payroll.runs.manage');
  const canManageLoans = hasPermission('payroll.compensation.manage');
  const inputsQuery = usePayrollInputs();
  const loansQuery = usePayrollLoans();
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);

  const inputs = inputsQuery.data?.data ?? [];
  const loans = loansQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>One-off inputs</CardTitle>
          {canManage && (
            <Button type="button" size="sm" onClick={() => setInputModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add input
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {inputsQuery.isLoading && <LoadingState label="Loading inputs…" />}
          {inputsQuery.data && inputs.length === 0 && (
            <EmptyState title="No one-off inputs yet" description="Bonuses, allowances, and one-off deductions applied to a specific period." />
          )}
          {inputs.length > 0 && (
            <ul className="divide-y divide-border">
              {inputs.map((input: PayrollInput) => (
                <li key={input.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">
                      {input.employee ? `${input.employee.first_name} ${input.employee.last_name}` : `Employee #${input.employee_id}`} · {input.description}
                    </p>
                    <p className="text-xs text-muted">
                      {input.type} · effective {formatDate(input.effective_date)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="font-medium text-strong">{formatCurrency(input.amount)}</span>
                    <StatusBadge status={input.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
          {canManageLoans && (
            <Button type="button" size="sm" onClick={() => setLoanModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add loan
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {loansQuery.isLoading && <LoadingState label="Loading loans…" />}
          {loansQuery.data && loans.length === 0 && (
            <EmptyState title="No loans yet" description="Active loans project their installment automatically during payroll calculation." />
          )}
          {loans.length > 0 && (
            <ul className="divide-y divide-border">
              {loans.map((loan: EmployeeLoan) => (
                <li key={loan.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">
                      {loan.employee ? `${loan.employee.first_name} ${loan.employee.last_name}` : `Employee #${loan.employee_id}`} · {loan.name}
                    </p>
                    <p className="text-xs text-muted">
                      {loan.reference} · installment {formatCurrency(loan.installment_amount)} · outstanding {formatCurrency(loan.outstanding_balance)}
                    </p>
                  </div>
                  <StatusBadge status={loan.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <PayrollInputModal open={inputModalOpen} onClose={() => setInputModalOpen(false)} />
      <PayrollLoanModal open={loanModalOpen} onClose={() => setLoanModalOpen(false)} />
    </div>
  );
}

function PayrollInputModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createMutation = useCreatePayrollInput();
  const employeesQuery = useEmployees({ status: 'active', per_page: 100 }, open);
  const componentsQuery = usePayrollComponents();

  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState('bonus');
  const [componentId, setComponentId] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [amount, setAmount] = useState('');

  async function handleSubmit() {
    if (!employeeId || !description.trim() || !effectiveDate || !amount) return;
    const payload: PayrollInputPayload = {
      employee_id: Number(employeeId),
      type,
      description: description.trim(),
      effective_date: effectiveDate,
      amount: Number(amount),
      payroll_component_id: componentId ? Number(componentId) : null,
    };
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Input added');
      setEmployeeId('');
      setDescription('');
      setEffectiveDate('');
      setAmount('');
      setComponentId('');
      onClose();
    } catch (error) {
      toast.error('Could not add input', actionError(error, 'Could not add this input.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add one-off input"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction
            title="Add"
            isLoading={createMutation.isPending}
            disabled={!employeeId || !description.trim() || !effectiveDate || !amount}
            onClick={handleSubmit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
          <SelectMenu
            value={employeeId}
            onChange={setEmployeeId}
            searchable
            options={(employeesQuery.data?.data ?? []).map((e) => ({ value: String(e.id), label: `${e.first_name} ${e.last_name} · ${e.employee_number}` }))}
            placeholder="Select an employee"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Type</span>
            <SelectMenu value={type} onChange={setType} options={INPUT_TYPE_OPTIONS} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Component (optional)</span>
            <SelectMenu
              value={componentId}
              onChange={setComponentId}
              options={[{ value: '', label: 'None' }, ...(componentsQuery.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Description</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Performance bonus" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Effective date</span>
            <DatePicker value={effectiveDate} onChange={setEffectiveDate} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Amount</span>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}

function PayrollLoanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createMutation = useCreatePayrollLoan();
  const employeesQuery = useEmployees({ status: 'active', per_page: 100 }, open);

  const [employeeId, setEmployeeId] = useState('');
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [installment, setInstallment] = useState('');
  const [startsOn, setStartsOn] = useState('');

  async function handleSubmit() {
    if (!employeeId || !name.trim() || !principal || !installment || !startsOn) return;
    const payload: PayrollLoanPayload = {
      employee_id: Number(employeeId),
      reference: reference.trim() || `LOAN-${Date.now()}`,
      name: name.trim(),
      principal: Number(principal),
      installment_amount: Number(installment),
      starts_on: startsOn,
    };
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Loan added');
      setEmployeeId('');
      setReference('');
      setName('');
      setPrincipal('');
      setInstallment('');
      setStartsOn('');
      onClose();
    } catch (error) {
      toast.error('Could not add loan', actionError(error, 'Could not add this loan.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add loan"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction
            title="Add"
            isLoading={createMutation.isPending}
            disabled={!employeeId || !name.trim() || !principal || !installment || !startsOn}
            onClick={handleSubmit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
          <SelectMenu
            value={employeeId}
            onChange={setEmployeeId}
            searchable
            options={(employeesQuery.data?.data ?? []).map((e) => ({ value: String(e.id), label: `${e.first_name} ${e.last_name} · ${e.employee_number}` }))}
            placeholder="Select an employee"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Loan name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary advance" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Reference (optional)</span>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto-generated if left blank" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Principal</span>
            <Input type="number" min={0} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Monthly installment</span>
            <Input type="number" min={0} value={installment} onChange={(e) => setInstallment(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Starts on</span>
          <DatePicker value={startsOn} onChange={setStartsOn} />
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reports tab
// ---------------------------------------------------------------------------

function ReportsTab() {
  const toast = useToast();
  const { formatCurrency } = useCurrencyFormatter();
  const summaryQuery = usePayrollReportSummary();
  const statutoryQuery = usePayrollStatutoryReport();
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadPayrollRegister();
      toast.success('Register exported');
    } catch (error) {
      toast.error('Could not export register', actionError(error, 'Could not export the payroll register.'));
    } finally {
      setIsExporting(false);
    }
  }

  const summary = summaryQuery.data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Totals across all payroll runs.</p>
        <Button type="button" variant="secondary" isLoading={isExporting} onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Export register (CSV)
        </Button>
      </div>

      {summaryQuery.isLoading && <LoadingState label="Loading reports…" />}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Runs" value={summary.run_count} icon={FileSpreadsheet} />
          <StatTile label="Employee payments" value={summary.employee_payments} icon={Wallet} />
          <StatTile label="Gross" value={formatCurrency(summary.gross)} icon={Banknote} />
          <StatTile label="Deductions" value={formatCurrency(summary.deductions)} icon={Banknote} />
          <StatTile label="Net" value={formatCurrency(summary.net)} icon={Banknote} tone="success" />
          <StatTile label="Employer contributions" value={formatCurrency(summary.employer_contributions)} icon={Landmark} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Statutory breakdown</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {statutoryQuery.isLoading && <LoadingState label="Loading statutory report…" />}
          {statutoryQuery.data && statutoryQuery.data.length === 0 && (
            <EmptyState title="No statutory deductions recorded" description="Statutory totals appear here once payroll has been calculated with pension, PAYE, or NHF enabled." />
          )}
          {statutoryQuery.data && statutoryQuery.data.length > 0 && (
            <ul className="divide-y divide-border">
              {statutoryQuery.data.map((row) => (
                <li key={row.component_code} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">{row.component_name}</p>
                    <p className="text-xs text-muted">
                      {row.type.replace('_', ' ')} · {row.employee_count} employee(s)
                    </p>
                  </div>
                  <span className="font-medium text-strong">{formatCurrency(row.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

function PayrollControlContent() {
  const [tab, setTab] = useState<Tab>('settings');
  const content = useMemo(() => {
    switch (tab) {
      case 'settings':
        return <SettingsTab />;
      case 'runs':
        return <RunsTab />;
      case 'inputs':
        return <InputsTab />;
      case 'reports':
        return <ReportsTab />;
      default:
        return null;
    }
  }, [tab]);

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Compensation, payroll runs, statutory deductions, and payslips."
        actions={<SettingsIcon className="h-4 w-4 text-muted" />}
      />
      <div className="mb-5">
        <TabSwitcher value={tab} onChange={setTab} />
      </div>
      {content}
    </div>
  );
}

export function PayrollControlPage() {
  return (
    <RequirePermission permission="payroll.view" moduleKey="payroll">
      <PayrollControlContent />
    </RequirePermission>
  );
}
