import { useEffect, useState } from 'react';
import { Landmark, Pencil, Plus, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateBankAccount,
  useCreateCompensation,
  useEmployeePayrollRecord,
  usePayGroups,
  usePayrollComponents,
  usePayrollSettings,
  useStatutoryProfile,
  useUpdateStatutoryProfile,
  useUpdateBankAccount,
  type BankAccountPayload,
  type CompensationPayload,
  type StatutoryProfilePayload,
} from '@/features/payroll/api';
import { useCurrencyFormatter } from '@/features/payroll/useCurrencyFormatter';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { EmployeeBankAccount, EmployeeCompensation } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function CompensationModal({
  employeeId,
  currentCompensation,
  open,
  onClose,
}: {
  employeeId: number;
  currentCompensation: EmployeeCompensation | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const settingsQuery = usePayrollSettings();
  const payGroupsQuery = usePayGroups();
  const componentsQuery = usePayrollComponents();
  const createMutation = useCreateCompensation(employeeId);

  const [payGroupId, setPayGroupId] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [payFrequency, setPayFrequency] = useState('monthly');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [componentValues, setComponentValues] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    if (currentCompensation) {
      setPayGroupId(currentCompensation.pay_group_id ? String(currentCompensation.pay_group_id) : '');
      setBaseSalary(currentCompensation.base_salary);
      setPayFrequency(currentCompensation.pay_frequency);
      setComponentValues(
        Object.fromEntries((currentCompensation.recurring_components ?? []).map((c) => [c.component_id, c.value !== null ? String(c.value) : ''])),
      );
    } else {
      setPayGroupId('');
      setBaseSalary('');
      setPayFrequency('monthly');
      setComponentValues({});
    }
    setEffectiveFrom('');
  }, [open, currentCompensation]);

  const recurringComponents = (componentsQuery.data ?? []).filter((component) => component.is_recurring);

  async function handleSubmit() {
    if (!baseSalary || !effectiveFrom) return;
    const payload: CompensationPayload = {
      pay_group_id: payGroupId ? Number(payGroupId) : null,
      base_salary: Number(baseSalary),
      currency: settingsQuery.data?.currency ?? 'NGN',
      pay_frequency: payFrequency,
      effective_from: effectiveFrom,
      recurring_components: Object.entries(componentValues)
        .filter(([, value]) => value !== '')
        .map(([componentId, value]) => ({ component_id: Number(componentId), value: Number(value) })),
    };
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Compensation updated');
      onClose();
    } catch (error) {
      toast.error('Could not update compensation', actionError(error, 'Could not update this compensation.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentCompensation ? 'Update compensation' : 'Set compensation'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction title="Save" isLoading={createMutation.isPending} disabled={!baseSalary || !effectiveFrom} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        {currentCompensation && (
          <p className="text-xs text-muted">
            This creates a new, effective-dated compensation record and supersedes the current one — it doesn't overwrite history.
          </p>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Pay group (optional)</span>
          <SelectMenu
            value={payGroupId}
            onChange={setPayGroupId}
            options={[{ value: '', label: 'None' }, ...(payGroupsQuery.data ?? []).map((group) => ({ value: String(group.id), label: group.name }))]}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Base salary</span>
            <Input type="number" min={0} value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Pay frequency</span>
            <SelectMenu
              value={payFrequency}
              onChange={setPayFrequency}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Effective from</span>
          <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} />
        </label>
        {recurringComponents.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Recurring components (leave blank to use the default value)</p>
            <div className="space-y-2">
              {recurringComponents.map((component) => (
                <div key={component.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-strong">{component.name}</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-32"
                    placeholder={component.default_value}
                    value={componentValues[component.id] ?? ''}
                    onChange={(e) => setComponentValues((current) => ({ ...current, [component.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function BankAccountModal({ employeeId, open, onClose }: { employeeId: number; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createMutation = useCreateBankAccount(employeeId);
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  async function handleSubmit() {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) return;
    const payload: BankAccountPayload = {
      bank_name: bankName.trim(),
      bank_code: bankCode.trim() || null,
      account_number: accountNumber.trim(),
      account_name: accountName.trim(),
      is_primary: isPrimary,
    };
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Bank account added');
      setBankName('');
      setBankCode('');
      setAccountNumber('');
      setAccountName('');
      setIsPrimary(true);
      onClose();
    } catch (error) {
      toast.error('Could not add bank account', actionError(error, 'Could not add this bank account.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add bank account"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalConfirmAction
            title="Save"
            isLoading={createMutation.isPending}
            disabled={!bankName.trim() || !accountNumber.trim() || !accountName.trim()}
            onClick={handleSubmit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Bank name</span>
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Bank code (optional)</span>
          <Input value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Account number</span>
          <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={20} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Account name</span>
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="h-4 w-4 rounded border-border" />
          <span className="text-muted">Primary account</span>
        </label>
      </div>
    </Modal>
  );
}

function ManageBankAccountModal({ employeeId, account, onClose }: { employeeId: number; account: EmployeeBankAccount | null; onClose: () => void }) {
  const toast = useToast();
  const mutation = useUpdateBankAccount(employeeId);
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('unverified');

  useEffect(() => {
    if (!account) return;
    setBankName(account.bank_name);
    setBankCode(account.bank_code ?? '');
    setAccountName(account.account_name);
    setIsPrimary(account.is_primary);
    setVerificationStatus(account.verification_status);
  }, [account]);

  async function handleSave() {
    if (!account || !bankName.trim() || !accountName.trim()) return;
    try {
      await mutation.mutateAsync({ id: account.id, bank_name: bankName.trim(), bank_code: bankCode.trim() || null, account_name: accountName.trim(), is_primary: isPrimary, verification_status: verificationStatus });
      toast.success('Bank account updated');
      onClose();
    } catch (error) {
      toast.error('Could not update bank account', actionError(error, 'Could not update this bank account.'));
    }
  }

  return (
    <Modal open={account !== null} onClose={onClose} title="Manage bank account" footer={<><ModalCancelAction onClick={onClose} /><ModalConfirmAction title="Save" isLoading={mutation.isPending} onClick={handleSave} /></>}>
      <div className="space-y-4">
        <Input value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Bank name" />
        <Input value={bankCode} onChange={(event) => setBankCode(event.target.value)} placeholder="Bank code" />
        <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Account name" />
        <SelectMenu value={verificationStatus} onChange={setVerificationStatus} options={[{ value: 'unverified', label: 'Unverified' }, { value: 'verified', label: 'Verified' }, { value: 'rejected', label: 'Rejected' }]} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /><span>Primary payment account</span></label>
        <p className="text-xs text-muted">Account number ending {account?.account_number_last_four}. Entering a replacement account number requires a fresh verification.</p>
      </div>
    </Modal>
  );
}

function StatutoryProfileForm({ employeeId, canManage }: { employeeId: number; canManage: boolean }) {
  const toast = useToast();
  const profileQuery = useStatutoryProfile(employeeId);
  const updateMutation = useUpdateStatutoryProfile(employeeId);
  const profile = profileQuery.data;

  const [payeEnabled, setPayeEnabled] = useState(false);
  const [taxState, setTaxState] = useState('');
  const [taxId, setTaxId] = useState('');
  const [pensionEnabled, setPensionEnabled] = useState(true);
  const [pfaName, setPfaName] = useState('');
  const [rsaPin, setRsaPin] = useState('');
  const [nhfEnabled, setNhfEnabled] = useState(false);
  const [nhfNumber, setNhfNumber] = useState('');
  const [reliefs, setReliefs] = useState<Array<{ name: string; annual_amount: number }>>([]);

  useEffect(() => {
    if (!profile) return;
    setPayeEnabled(profile.paye_enabled);
    setTaxState(profile.tax_state ?? '');
    setPensionEnabled(profile.pension_enabled);
    setPfaName(profile.pfa_name ?? '');
    setNhfEnabled(profile.nhf_enabled);
    setReliefs(profile.reliefs ?? []);
    setTaxId('');
    setRsaPin('');
    setNhfNumber('');
  }, [profile, employeeId]);

  function addRelief() {
    setReliefs((current) => [...current, { name: '', annual_amount: 0 }]);
  }

  function updateRelief(index: number, patch: Partial<{ name: string; annual_amount: number }>) {
    setReliefs((current) => current.map((relief, i) => (i === index ? { ...relief, ...patch } : relief)));
  }

  function removeRelief(index: number) {
    setReliefs((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const payload: StatutoryProfilePayload = {
      paye_enabled: payeEnabled,
      tax_state: taxState.trim() || null,
      pension_enabled: pensionEnabled,
      pfa_name: pfaName.trim() || null,
      nhf_enabled: nhfEnabled,
      reliefs: reliefs.filter((relief) => relief.name.trim()),
    };
    if (taxId.trim()) payload.tax_id = taxId.trim();
    if (rsaPin.trim()) payload.rsa_pin = rsaPin.trim();
    if (nhfNumber.trim()) payload.nhf_number = nhfNumber.trim();
    try {
      await updateMutation.mutateAsync(payload);
      toast.success('Statutory profile updated');
    } catch (error) {
      toast.error('Could not update statutory profile', actionError(error, 'Could not update this statutory profile.'));
    }
  }

  if (profileQuery.isLoading) return <LoadingState label="Loading statutory profile…" />;
  if (profileQuery.isError) return <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-strong">
            <input type="checkbox" checked={pensionEnabled} disabled={!canManage} onChange={(e) => setPensionEnabled(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Pension
          </label>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block text-muted">PFA name</span>
            <Input value={pfaName} disabled={!canManage} onChange={(e) => setPfaName(e.target.value)} />
          </label>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block text-muted">RSA PIN {profile?.rsa_pin_last_four ? `(on file, ending ${profile.rsa_pin_last_four})` : ''}</span>
            <Input value={rsaPin} disabled={!canManage} onChange={(e) => setRsaPin(e.target.value)} placeholder="Enter to replace" />
          </label>
        </div>
        <div className="rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-strong">
            <input type="checkbox" checked={payeEnabled} disabled={!canManage} onChange={(e) => setPayeEnabled(e.target.checked)} className="h-4 w-4 rounded border-border" />
            PAYE
          </label>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block text-muted">Tax state</span>
            <Input value={taxState} disabled={!canManage} onChange={(e) => setTaxState(e.target.value)} />
          </label>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block text-muted">Tax ID {profile?.tax_id_last_four ? `(on file, ending ${profile.tax_id_last_four})` : ''}</span>
            <Input value={taxId} disabled={!canManage} onChange={(e) => setTaxId(e.target.value)} placeholder="Enter to replace" />
          </label>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Tax reliefs</span>
              {canManage && (
                <Button type="button" size="sm" variant="secondary" onClick={addRelief}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </div>
            {reliefs.length === 0 && <p className="mt-1 text-xs text-muted">No reliefs added.</p>}
            {reliefs.length > 0 && (
              <div className="mt-2 space-y-2">
                {reliefs.map((relief, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Relief name"
                      value={relief.name}
                      disabled={!canManage}
                      onChange={(e) => updateRelief(index, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={0}
                      className="w-32 flex-shrink-0"
                      placeholder="Annual amount"
                      value={relief.annual_amount}
                      disabled={!canManage}
                      onChange={(e) => updateRelief(index, { annual_amount: Number(e.target.value) })}
                    />
                    {canManage && (
                      <Button type="button" size="icon" variant="ghost" title="Remove relief" aria-label="Remove relief" onClick={() => removeRelief(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-strong">
            <input type="checkbox" checked={nhfEnabled} disabled={!canManage} onChange={(e) => setNhfEnabled(e.target.checked)} className="h-4 w-4 rounded border-border" />
            NHF
          </label>
          <label className="mt-2 block text-xs">
            <span className="mb-1 block text-muted">NHF number {profile?.nhf_number_last_four ? `(on file, ending ${profile.nhf_number_last_four})` : ''}</span>
            <Input value={nhfNumber} disabled={!canManage} onChange={(e) => setNhfNumber(e.target.value)} placeholder="Enter to replace" />
          </label>
        </div>
      </div>
      {canManage && (
        <Button type="button" size="sm" variant="primary" isLoading={updateMutation.isPending} onClick={handleSave}>
          Save statutory profile
        </Button>
      )}
    </div>
  );
}

export function EmployeePayrollTab({ employeeId }: { employeeId: number }) {
  const { hasPermission } = useAuth();
  const { formatDate } = useDateFormatter();
  const { formatCurrency } = useCurrencyFormatter();
  const canManageCompensation = hasPermission('payroll.compensation.manage');
  const canManageBankAccounts = hasPermission('payroll.bank_accounts.manage');

  const recordQuery = useEmployeePayrollRecord(employeeId);
  const componentsQuery = usePayrollComponents();
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [managedBankAccount, setManagedBankAccount] = useState<EmployeeBankAccount | null>(null);

  if (recordQuery.isLoading) return <LoadingState label="Loading payroll record…" />;
  if (recordQuery.isError) return <ErrorState error={recordQuery.error} onRetry={() => recordQuery.refetch()} />;

  const record = recordQuery.data;
  const compensations = record?.compensations ?? [];
  const bankAccounts = record?.bank_accounts ?? [];
  const currentCompensation = compensations.find((comp) => comp.status === 'active') ?? null;
  const componentNameById = new Map((componentsQuery.data ?? []).map((component) => [component.id, component.name]));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Compensation history</CardTitle>
          {canManageCompensation && (
            <Button type="button" size="sm" onClick={() => setCompensationModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {currentCompensation ? 'Update compensation' : 'Set compensation'}
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {compensations.length === 0 && <EmptyState icon={<Wallet className="h-6 w-6" />} title="No compensation set" description="This employee will show as an exception on any payroll run until compensation is set." />}
          {compensations.length > 0 && (
            <ul className="divide-y divide-border">
              {compensations.map((comp) => {
                const recurring = (comp.recurring_components ?? [])
                  .map((c) => `${componentNameById.get(c.component_id) ?? `Component #${c.component_id}`}${c.value !== null ? `: ${formatCurrency(c.value, comp.currency)}` : ''}`)
                  .join(', ');
                return (
                  <li key={comp.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-strong">{formatCurrency(comp.base_salary, comp.currency)} · {comp.pay_frequency}</p>
                      <p className="text-xs text-muted">
                        {comp.pay_group?.name ?? 'No pay group'} · effective {formatDate(comp.effective_from)}
                        {comp.effective_to ? ` → ${formatDate(comp.effective_to)}` : ''}
                      </p>
                      {recurring && <p className="mt-0.5 text-xs text-muted">{recurring}</p>}
                    </div>
                    <StatusBadge status={comp.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank accounts</CardTitle>
          {canManageBankAccounts && (
            <Button type="button" size="sm" onClick={() => setBankModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add account
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {bankAccounts.length === 0 && <EmptyState icon={<Landmark className="h-6 w-6" />} title="No bank account on file" description="Add one so this employee can be included in payment exports." />}
          {bankAccounts.length > 0 && (
            <ul className="divide-y divide-border">
              {bankAccounts.map((account) => (
                <li key={account.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-strong">
                      {account.bank_name} · ****{account.account_number_last_four}
                    </p>
                    <p className="text-xs text-muted">{account.account_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.is_primary && <StatusBadge status="primary" />}
                    <StatusBadge status={account.verification_status} />
                    {canManageBankAccounts && <Button type="button" size="icon" variant="ghost" title="Manage bank account" aria-label="Manage bank account" onClick={() => setManagedBankAccount(account)}><Pencil className="h-3.5 w-3.5" /></Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Statutory profile
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <StatutoryProfileForm employeeId={employeeId} canManage={canManageCompensation} />
        </CardBody>
      </Card>

      <CompensationModal
        employeeId={employeeId}
        currentCompensation={currentCompensation}
        open={compensationModalOpen}
        onClose={() => setCompensationModalOpen(false)}
      />
      <BankAccountModal employeeId={employeeId} open={bankModalOpen} onClose={() => setBankModalOpen(false)} />
      <ManageBankAccountModal employeeId={employeeId} account={managedBankAccount} onClose={() => setManagedBankAccount(null)} />
    </div>
  );
}
