import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  UserCog,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dropdown, DropdownMenuItem } from '@/components/ui/Dropdown';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction, ModalSendAction } from '@/components/ui/ModalActions';
import { AsyncSelect, type AsyncOption } from '@/components/ui/AsyncSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useAuth } from '@/context/AuthContext';
import { isValidEmail } from '@/lib/validation';
import {
  downloadEmployeeProfileCsv,
  searchEmployees,
  useApproveOnboarding,
  useChangeEmployeeManager,
  useChangeEmployeeStatus,
  useEmployee,
  useRequestEmployeeCorrection,
  useUpdateEmployee,
} from '@/features/employees/api';
import { useSetupLookups } from '@/features/workspace/api';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/apiClient';
import type { Employee } from '@/types/api';

type Tab = 'overview' | 'biodata' | 'documents' | 'status' | 'reporting' | 'activity';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'biodata', label: 'Biodata' },
  { key: 'documents', label: 'Documents' },
  { key: 'status', label: 'Status history' },
  { key: 'reporting', label: 'Reporting history' },
  { key: 'activity', label: 'Activity' },
];

const EMPLOYEE_STATUS_OPTIONS = ['draft', 'invited', 'onboarding', 'active', 'probation', 'confirmed', 'suspended', 'exited'];
const ACTIVE_LIFECYCLE_STATUSES = ['active', 'probation', 'confirmed', 'suspended', 'exited'];
const GENDER_OPTIONS: SelectMenuOption[] = [
  { value: '', label: 'Not specified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const CORRECTION_SECTION_OPTIONS: SelectMenuOption[] = ['Overview', 'Biodata', 'Contact', 'Documents', 'Status', 'Reporting'].map((section) => ({
  value: section,
  label: section,
}));

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function today(): string {
  return localDateString(new Date());
}

function employeeInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000000)?Z?)?$/);
  if (dateOnly) return dateOnly[1];

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = localDateString(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, '')
    .toLowerCase();

  return `${day} ${time}`;
}

function formatText(value: string | null | undefined): string {
  if (!value) return '-';

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function lookupOptions<T extends { id: number; name: string }>(items: T[] | undefined, placeholder: string): SelectMenuOption[] {
  return [
    { value: '', label: placeholder },
    ...(items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

function statusOptionsFor(employee: Employee): SelectMenuOption[] {
  const currentStatus = employee.status;
  const allowed = ACTIVE_LIFECYCLE_STATUSES.includes(currentStatus)
    ? ACTIVE_LIFECYCLE_STATUSES
    : EMPLOYEE_STATUS_OPTIONS;

  return allowed.map((status) => ({
    value: status,
    label: formatText(status),
    description: status === 'invited' && currentStatus === 'draft' ? 'Creates and sends an employee invitation.' : undefined,
    disabled: status === currentStatus || (status === 'invited' && currentStatus === 'draft' && !employee.work_email),
  }));
}

function calculateAge(value: string | null | undefined): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';

  const todayDate = new Date();
  let age = todayDate.getFullYear() - date.getFullYear();
  const monthDelta = todayDate.getMonth() - date.getMonth();
  const hasBirthdayPassed = monthDelta > 0 || (monthDelta === 0 && todayDate.getDate() >= date.getDate());
  if (!hasBirthdayPassed) age -= 1;

  return age >= 0 ? `${age} years` : '-';
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function GenderIcon({ gender }: { gender?: string | null }) {
  const tone =
    gender === 'female'
      ? 'bg-pending-bg text-pending'
      : gender === 'male'
        ? 'bg-info-bg text-info'
        : 'bg-teal/10 text-teal';

  return (
    <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', tone)}>
      <UserRound className="h-3.5 w-3.5" />
    </span>
  );
}

function GenderBadge({ gender }: { gender?: string | null }) {
  if (!gender) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-medium text-strong">
      <GenderIcon gender={gender} />
      {formatText(gender)}
    </span>
  );
}

function EmployeeDetailContent({ employee }: { employee: Employee }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const lookups = useSetupLookups();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    work_email: '',
    phone: '',
    department_id: '',
    designation_id: '',
    employment_type_id: '',
    organization_location_id: '',
    start_date: '',
    date_of_birth: '',
    gender: '',
    personal_email: '',
    residential_address: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [correctionSection, setCorrectionSection] = useState('Overview');
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusEffectiveDate, setStatusEffectiveDate] = useState(today());
  const [statusReason, setStatusReason] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [newManager, setNewManager] = useState<AsyncOption | null>(null);
  const [managerEffectiveDate, setManagerEffectiveDate] = useState(today());
  const [managerReason, setManagerReason] = useState('');
  const [managerNote, setManagerNote] = useState('');
  const approveMutation = useApproveOnboarding(employee.id);
  const updateEmployeeMutation = useUpdateEmployee(employee.id);
  const statusMutation = useChangeEmployeeStatus(employee.id);
  const managerMutation = useChangeEmployeeManager(employee.id);
  const correctionMutation = useRequestEmployeeCorrection(employee.id);

  const currentStatus = employee.status;
  const canApprove = hasPermission('employees.update') && employee.status === 'onboarding';
  const profileReadyForApproval = ['submitted', 'approved'].includes(employee.profile?.completion_status ?? '');
  const canConfirmApprove = canApprove && profileReadyForApproval;
  const canViewEmployee = hasPermission('employees.view');
  const canUpdateEmployee = hasPermission('employees.update');

  function openEditModal(employeeToEdit: Employee) {
    setEditForm({
      first_name: employeeToEdit.first_name,
      middle_name: employeeToEdit.middle_name ?? '',
      last_name: employeeToEdit.last_name,
      work_email: employeeToEdit.work_email,
      phone: employeeToEdit.phone ?? '',
      department_id: employeeToEdit.department_id ? String(employeeToEdit.department_id) : '',
      designation_id: employeeToEdit.designation_id ? String(employeeToEdit.designation_id) : '',
      employment_type_id: employeeToEdit.employment_type_id ? String(employeeToEdit.employment_type_id) : '',
      organization_location_id: employeeToEdit.organization_location_id ? String(employeeToEdit.organization_location_id) : '',
      start_date: employeeToEdit.start_date ? employeeToEdit.start_date.slice(0, 10) : '',
      date_of_birth: employeeToEdit.profile?.date_of_birth ? employeeToEdit.profile.date_of_birth.slice(0, 10) : '',
      gender: employeeToEdit.profile?.gender ?? '',
      personal_email: employeeToEdit.profile?.personal_email ?? '',
      residential_address: employeeToEdit.profile?.residential_address ?? '',
      next_of_kin_name: employeeToEdit.profile?.next_of_kin_name ?? '',
      next_of_kin_phone: employeeToEdit.profile?.next_of_kin_phone ?? '',
      emergency_contact_name: employeeToEdit.profile?.emergency_contact_name ?? '',
      emergency_contact_phone: employeeToEdit.profile?.emergency_contact_phone ?? '',
    });
    setEditModalOpen(true);
  }

  async function handleUpdateEmployee() {
    try {
      await updateEmployeeMutation.mutateAsync({
        first_name: editForm.first_name,
        middle_name: editForm.middle_name || null,
        last_name: editForm.last_name,
        work_email: editForm.work_email,
        phone: editForm.phone || null,
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        designation_id: editForm.designation_id ? Number(editForm.designation_id) : null,
        employment_type_id: editForm.employment_type_id ? Number(editForm.employment_type_id) : null,
        organization_location_id: editForm.organization_location_id ? Number(editForm.organization_location_id) : null,
        start_date: editForm.start_date || null,
        profile: {
          date_of_birth: editForm.date_of_birth || null,
          gender: editForm.gender || null,
          personal_email: editForm.personal_email || null,
          residential_address: editForm.residential_address || null,
          next_of_kin_name: editForm.next_of_kin_name || null,
          next_of_kin_phone: editForm.next_of_kin_phone || null,
          emergency_contact_name: editForm.emergency_contact_name || null,
          emergency_contact_phone: editForm.emergency_contact_phone || null,
        },
      });
      setEditModalOpen(false);
      toast.success('Employee updated', `${employee?.full_name ?? 'The employee'}'s profile was saved.`);
    } catch (error) {
      toast.error('Could not update employee', actionError(error, 'Could not update employee.'));
    }
  }

  async function handleRequestCorrection() {
    try {
      await correctionMutation.mutateAsync({
        section: correctionSection,
        message: correctionMessage,
      });
      setCorrectionModalOpen(false);
      setCorrectionMessage('');
      setTab('activity');
      toast.success('Correction requested', 'The request has been recorded on the employee activity timeline.');
    } catch (error) {
      toast.error('Could not request correction', actionError(error, 'Could not request correction.'));
    }
  }

  async function handleChangeStatus() {
    try {
      await statusMutation.mutateAsync({
        new_status: newStatus || currentStatus,
        effective_date: statusEffectiveDate,
        reason: statusReason || undefined,
        note: statusNote || undefined,
      });
      setStatusModalOpen(false);
      setStatusReason('');
      setStatusNote('');
      setTab('status');
      toast.success('Status updated', 'The employee lifecycle history has been updated.');
    } catch (error) {
      toast.error('Could not change status', actionError(error, 'Could not change status.'));
    }
  }

  async function handleChangeManager() {
    try {
      await managerMutation.mutateAsync({
        new_manager_id: newManager?.value ?? null,
        effective_date: managerEffectiveDate,
        reason: managerReason || undefined,
        note: managerNote || undefined,
      });
      setManagerModalOpen(false);
      setNewManager(null);
      setManagerReason('');
      setManagerNote('');
      setTab('reporting');
      toast.success('Manager updated', 'The reporting history has been updated.');
    } catch (error) {
      toast.error('Could not change manager', actionError(error, 'Could not change manager.'));
    }
  }

  return (
    <div>
      <PageHeader
        title={employee.full_name}
        breadcrumbs={[{ label: 'Employees', to: '/employees' }, { label: employee.full_name }]}
        status={
          <>
            <StatusBadge status={employee.status} />
            <GenderBadge gender={employee.profile?.gender} />
          </>
        }
        subtitle={`${employee.employee_number} · ${employee.designation?.name ?? 'No designation'} · ${
          employee.department?.name ?? 'No department'
        }`}
        actions={
          <>
            {canApprove && (
              <Button variant="primary" onClick={() => setConfirmApprove(true)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve onboarding
              </Button>
            )}
            {canViewEmployee && (
              <Dropdown
                align="right"
                panelClassName="w-56"
                trigger={({ toggle }) => (
                  <Button variant="secondary" size="sm" onClick={toggle} aria-label="Employee actions">
                    <MoreHorizontal className="h-4 w-4" />
                    Actions
                  </Button>
                )}
              >
                {canUpdateEmployee && (
                  <DropdownMenuItem icon={Edit3} onClick={() => openEditModal(employee)}>
                    Edit profile
                  </DropdownMenuItem>
                )}
                {canApprove && (
                  <DropdownMenuItem icon={CheckCircle2} onClick={() => setConfirmApprove(true)}>
                    Approve onboarding
                  </DropdownMenuItem>
                )}
                {canUpdateEmployee && (
                  <DropdownMenuItem
                    icon={UserRoundCheck}
                    onClick={() => {
                      setNewStatus(currentStatus);
                      setStatusEffectiveDate(today());
                      setStatusModalOpen(true);
                    }}
                  >
                    Change status
                  </DropdownMenuItem>
                )}
                {canUpdateEmployee && (
                  <DropdownMenuItem
                    icon={UserCog}
                    onClick={() => {
                      setManagerEffectiveDate(today());
                      setManagerModalOpen(true);
                    }}
                  >
                    Change manager
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem icon={FileText} onClick={() => setTab('documents')}>
                  View documents
                </DropdownMenuItem>
                {canUpdateEmployee && (
                  <DropdownMenuItem icon={AlertTriangle} onClick={() => setCorrectionModalOpen(true)}>
                    Request correction
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  icon={Download}
                  onClick={() => {
                    void downloadEmployeeProfileCsv(employee)
                      .then(() => toast.success('Profile exported', 'The employee profile CSV has been downloaded.'))
                      .catch((error) => {
                        toast.error('Could not export profile', actionError(error, 'Could not export employee profile.'));
                      });
                  }}
                >
                  Export profile
                </DropdownMenuItem>
              </Dropdown>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2.5 text-sm">
            <div className="mb-3 flex items-center gap-3 border-b border-border pb-4">
              {employee.profile?.passport_photo_url ? (
                <img
                  src={employee.profile.passport_photo_url}
                  alt={`${employee.full_name} passport`}
                  className="h-16 w-16 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-teal/10 font-display text-lg font-semibold text-teal">
                  {employeeInitials(employee.full_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-strong">{employee.full_name}</p>
                <p className="text-xs text-muted">{employee.employee_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-strong">
              <Mail className="h-3.5 w-3.5 text-muted" />
              <a href={`mailto:${employee.work_email}`} className="hover:text-teal hover:underline">
                {employee.work_email}
              </a>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2 text-strong">
                <Phone className="h-3.5 w-3.5 text-muted" />
                <a href={phoneHref(employee.phone)} className="hover:text-teal hover:underline">
                  {employee.phone}
                </a>
              </div>
            )}
            {employee.location && (
              <div className="flex items-center gap-2 text-strong">
                <MapPin className="h-3.5 w-3.5 text-muted" /> {employee.location.name}
              </div>
            )}
            {employee.profile && (
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-muted">Profile</span>
                <StatusBadge status={employee.profile.completion_status} />
              </div>
            )}
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-1 border-b border-border">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={cn(
                  'border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors',
                  tab === tabItem.key
                    ? 'border-pine text-pine'
                    : 'border-transparent text-muted hover:text-strong',
                )}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <Card>
              <CardBody className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <OverviewRow label="Employee number" value={employee.employee_number} />
                <OverviewRow label="Status" value={<StatusBadge status={employee.status} />} />
                <OverviewRow label="Department" value={employee.department?.name ?? '—'} />
                <OverviewRow label="Unit" value={employee.unit?.name ?? '—'} />
                <OverviewRow label="Designation" value={employee.designation?.name ?? '—'} />
                <OverviewRow label="Grade level" value={employee.grade_level?.name ?? '—'} />
                <OverviewRow label="Employment type" value={employee.employment_type?.name ?? '—'} />
                <OverviewRow label="Location" value={employee.location?.name ?? '—'} />
                <OverviewRow label="Start date" value={formatDate(employee.start_date)} />
                <OverviewRow label="Invited" value={employee.invited_at ? formatDate(employee.invited_at) : 'Not invited'} />
                <OverviewRow label="Onboarding completed" value={formatDate(employee.onboarding_completed_at)} />
                <OverviewRow label="Activated" value={formatDate(employee.activated_at)} />
              </CardBody>
            </Card>
          )}

          {tab === 'biodata' && (
            <Card>
              {employee.profile ? (
                <CardBody className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <OverviewRow label="Date of birth" value={formatDate(employee.profile.date_of_birth)} />
                  <OverviewRow label="Age" value={calculateAge(employee.profile.date_of_birth)} />
                  <OverviewRow label="Gender" value={formatText(employee.profile.gender)} />
                  <OverviewRow label="Personal email" value={employee.profile.personal_email ?? '-'} />
                  <div className="md:col-span-2">
                    <OverviewRow label="Residential address" value={employee.profile.residential_address ?? '-'} />
                  </div>
                  <OverviewRow label="Next of kin" value={employee.profile.next_of_kin_name ?? '-'} />
                  <OverviewRow label="Next of kin phone" value={employee.profile.next_of_kin_phone ?? '-'} />
                  <OverviewRow label="Emergency contact" value={employee.profile.emergency_contact_name ?? '-'} />
                  <OverviewRow label="Emergency contact phone" value={employee.profile.emergency_contact_phone ?? '-'} />
                </CardBody>
              ) : (
                <CardBody>
                  <EmptyState title="No biodata yet" description="The employee has not submitted their profile information." />
                </CardBody>
              )}
            </Card>
          )}

          {tab === 'documents' && (
            <Card>
              <CardBody className="p-0">
                {employee.documents && employee.documents.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <div>
                          <p className="font-medium text-strong">{doc.title}</p>
                          <p className="text-xs text-muted">{doc.document_type?.name}</p>
                        </div>
                        <StatusBadge status={doc.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No documents yet" description="Documents submitted for this employee will appear here." />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'status' && (
            <Card>
              <CardBody className="p-0">
                {employee.status_history && employee.status_history.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.status_history.map((entry) => (
                      <li key={entry.id} className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={entry.new_status} />
                          <span className="text-xs text-muted">{formatDate(entry.effective_date)}</span>
                        </div>
                        {entry.reason && <p className="mt-1 text-strong">{entry.reason}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No status changes yet" />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'reporting' && (
            <Card>
              <CardBody className="p-0">
                {employee.reporting_history && employee.reporting_history.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.reporting_history.map((entry) => (
                      <li key={entry.id} className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-strong">
                            {entry.previous_manager?.full_name ?? 'Unassigned'} →{' '}
                            {entry.new_manager?.full_name ?? 'Unassigned'}
                          </span>
                          <span className="text-xs text-muted">{formatDate(entry.effective_date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No reporting changes yet" />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'activity' && (
            <Card>
              <CardBody className="p-0">
                {employee.activities && employee.activities.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.activities.map((activity) => (
                      <li key={activity.id} className="px-5 py-3 text-sm">
                        <p className="font-medium text-strong">{activity.title}</p>
                        {activity.description && <p className="text-muted">{activity.description}</p>}
                        <p className="mt-1 text-xs text-muted">
                          {activity.actor?.name ?? 'System'} · {formatDate(activity.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No activity recorded yet" />
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        title="Approve onboarding"
        footer={
          <>
            <ModalCancelAction onClick={() => setConfirmApprove(false)} />
            <ModalConfirmAction
              title="Approve onboarding"
              isLoading={approveMutation.isPending}
              disabled={!canConfirmApprove}
              onClick={async () => {
                try {
                  await approveMutation.mutateAsync();
                  setConfirmApprove(false);
                  toast.success('Onboarding approved', `${employee?.full_name ?? 'The employee'} is now active.`);
                } catch (error) {
                  toast.error('Could not approve onboarding', actionError(error, 'Could not approve onboarding.'));
                }
              }}
            />
          </>
        }
      >
        <p>
          This confirms {employee.full_name}'s onboarding is complete and activates their record. This action is
          recorded to the audit trail.
        </p>
        <div className="mt-4 space-y-2 rounded-md border border-border bg-surface-soft p-3">
          <ApprovalCheck
            complete={employee.status === 'onboarding'}
            label="Employee is in onboarding"
            value={formatText(employee.status)}
          />
          <ApprovalCheck
            complete={profileReadyForApproval}
            label="Profile is ready"
            value={formatText(employee.profile?.completion_status)}
          />
        </div>
        {!profileReadyForApproval && (
          <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            This employee cannot be approved yet. Ask the employee to complete and submit their profile, or use
            Edit employee record if HR needs to fill missing biodata before submission.
          </p>
        )}
      </Modal>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit employee profile"
        size="lg"
        footer={
          <>
            <ModalCancelAction onClick={() => setEditModalOpen(false)} />
            <ModalSaveAction
              isLoading={updateEmployeeMutation.isPending}
              disabled={
                !isValidEmail(editForm.work_email) ||
                (Boolean(editForm.personal_email) && !isValidEmail(editForm.personal_email))
              }
              onClick={handleUpdateEmployee}
            />
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-strong">Work details</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ActionField label="First name">
            <Input value={editForm.first_name} onChange={(event) => setEditForm((current) => ({ ...current, first_name: event.target.value }))} />
          </ActionField>
          <ActionField label="Last name">
            <Input value={editForm.last_name} onChange={(event) => setEditForm((current) => ({ ...current, last_name: event.target.value }))} />
          </ActionField>
          <ActionField label="Middle name">
            <Input value={editForm.middle_name} onChange={(event) => setEditForm((current) => ({ ...current, middle_name: event.target.value }))} />
          </ActionField>
          <ActionField label="Work email" error={editForm.work_email && !isValidEmail(editForm.work_email) ? 'Enter a valid email address' : undefined}>
            <Input
              type="email"
              invalid={Boolean(editForm.work_email) && !isValidEmail(editForm.work_email)}
              value={editForm.work_email}
              onChange={(event) => setEditForm((current) => ({ ...current, work_email: event.target.value }))}
            />
          </ActionField>
          <ActionField label="Phone">
            <PhoneInput value={editForm.phone} onChange={(value) => setEditForm((current) => ({ ...current, phone: value }))} />
          </ActionField>
          <ActionField label="Start date">
            <DatePicker value={editForm.start_date} onChange={(value) => setEditForm((current) => ({ ...current, start_date: value }))} />
          </ActionField>
          <ActionField label="Department">
            <SelectMenu
              value={editForm.department_id}
              onChange={(value) => setEditForm((current) => ({ ...current, department_id: value }))}
              options={lookupOptions(lookups.data?.departments, 'Unassigned')}
            />
          </ActionField>
          <ActionField label="Designation">
            <SelectMenu
              value={editForm.designation_id}
              onChange={(value) => setEditForm((current) => ({ ...current, designation_id: value }))}
              options={lookupOptions(lookups.data?.designations, 'Unassigned')}
            />
          </ActionField>
          <ActionField label="Employment type">
            <SelectMenu
              value={editForm.employment_type_id}
              onChange={(value) => setEditForm((current) => ({ ...current, employment_type_id: value }))}
              options={lookupOptions(lookups.data?.employment_types, 'Unassigned')}
            />
          </ActionField>
          <ActionField label="Location">
            <SelectMenu
              value={editForm.organization_location_id}
              onChange={(value) => setEditForm((current) => ({ ...current, organization_location_id: value }))}
              options={lookupOptions(lookups.data?.locations, 'Unassigned')}
            />
          </ActionField>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-strong">Biodata</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ActionField label="Date of birth">
                <DatePicker value={editForm.date_of_birth} onChange={(value) => setEditForm((current) => ({ ...current, date_of_birth: value }))} />
              </ActionField>
              <ActionField label="Gender">
                <SelectMenu
                  value={editForm.gender}
                  onChange={(value) => setEditForm((current) => ({ ...current, gender: value }))}
                  options={GENDER_OPTIONS}
                />
              </ActionField>
              <ActionField label="Personal email" error={editForm.personal_email && !isValidEmail(editForm.personal_email) ? 'Enter a valid email address' : undefined}>
                <Input
                  type="email"
                  invalid={Boolean(editForm.personal_email) && !isValidEmail(editForm.personal_email)}
                  value={editForm.personal_email}
                  onChange={(event) => setEditForm((current) => ({ ...current, personal_email: event.target.value }))}
                />
              </ActionField>
              <ActionField label="Next of kin name">
                <Input value={editForm.next_of_kin_name} onChange={(event) => setEditForm((current) => ({ ...current, next_of_kin_name: event.target.value }))} />
              </ActionField>
              <ActionField label="Next of kin phone">
                <PhoneInput value={editForm.next_of_kin_phone} onChange={(value) => setEditForm((current) => ({ ...current, next_of_kin_phone: value }))} />
              </ActionField>
              <ActionField label="Emergency contact name">
                <Input value={editForm.emergency_contact_name} onChange={(event) => setEditForm((current) => ({ ...current, emergency_contact_name: event.target.value }))} />
              </ActionField>
              <ActionField label="Emergency contact phone">
                <PhoneInput value={editForm.emergency_contact_phone} onChange={(value) => setEditForm((current) => ({ ...current, emergency_contact_phone: value }))} />
              </ActionField>
              <div className="md:col-span-2">
                <ActionField label="Residential address">
                  <Textarea value={editForm.residential_address} onChange={(event) => setEditForm((current) => ({ ...current, residential_address: event.target.value }))} />
                </ActionField>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Request correction"
        footer={
          <>
            <ModalCancelAction onClick={() => setCorrectionModalOpen(false)} />
            <ModalSendAction
              title="Submit request"
              isLoading={correctionMutation.isPending}
              disabled={!correctionMessage.trim()}
              onClick={handleRequestCorrection}
            />
          </>
        }
      >
        <div className="space-y-3">
          <ActionField label="Section">
            <SelectMenu value={correctionSection} onChange={setCorrectionSection} options={CORRECTION_SECTION_OPTIONS} />
          </ActionField>
          <ActionField label="Correction details">
            <Textarea
              value={correctionMessage}
              onChange={(event) => setCorrectionMessage(event.target.value)}
              placeholder="Describe what needs to be corrected."
            />
          </ActionField>
        </div>
      </Modal>

      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Change employee status"
        footer={
          <>
            <ModalCancelAction onClick={() => setStatusModalOpen(false)} />
            <ModalSaveAction title="Save status" isLoading={statusMutation.isPending} onClick={handleChangeStatus} />
          </>
        }
      >
        <div className="space-y-3">
          <ActionField label="New status">
            <SelectMenu value={newStatus || employee.status} onChange={setNewStatus} options={statusOptionsFor(employee)} />
            {employee.status === 'draft' && !employee.work_email && (
              <p className="mt-1 text-xs text-warning">Add a work email before inviting this employee.</p>
            )}
          </ActionField>
          <ActionField label="Effective date">
            <DatePicker value={statusEffectiveDate} onChange={setStatusEffectiveDate} />
          </ActionField>
          <ActionField label="Reason">
            <Input value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Optional reason" />
          </ActionField>
          <ActionField label="Note">
            <Textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Optional internal note" />
          </ActionField>
        </div>
      </Modal>

      <Modal
        open={managerModalOpen}
        onClose={() => setManagerModalOpen(false)}
        title="Change reporting manager"
        footer={
          <>
            <ModalCancelAction onClick={() => setManagerModalOpen(false)} />
            <ModalSaveAction title="Save manager" isLoading={managerMutation.isPending} onClick={handleChangeManager} />
          </>
        }
      >
        <div className="space-y-3">
          <ActionField label="New manager">
            <AsyncSelect
              value={newManager}
              onChange={setNewManager}
              placeholder="Search employees..."
              loadOptions={async (query) => {
                if (!employee.department_id) return [];
                const results = await searchEmployees(query, {
                  department_id: employee.department_id ?? undefined,
                  manager_roles_only: true,
                  per_page: 20,
                });
                return results
                  .filter((result) => result.id !== employee.id)
                  .map((result) => ({
                    value: result.id,
                    label: result.full_name,
                    description: result.employee_number,
                  }));
              }}
            />
            <p className="mt-1 text-xs text-muted">Leave empty to remove the reporting manager.</p>
          </ActionField>
          <ActionField label="Effective date">
            <DatePicker value={managerEffectiveDate} onChange={setManagerEffectiveDate} />
          </ActionField>
          <ActionField label="Reason">
            <Input value={managerReason} onChange={(event) => setManagerReason(event.target.value)} placeholder="Optional reason" />
          </ActionField>
          <ActionField label="Note">
            <Textarea value={managerNote} onChange={(event) => setManagerNote(event.target.value)} placeholder="Optional internal note" />
          </ActionField>
        </div>
      </Modal>
    </div>
  );
}

function ActionField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function OverviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-surface-soft px-3 py-2.5">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <span className="mt-1 block min-w-0 font-medium text-strong">{value}</span>
    </div>
  );
}

function ApprovalCheck({ complete, label, value }: { complete: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={cn('font-medium', complete ? 'text-success' : 'text-warning')}>{label}</span>
      <span className="text-muted">{value}</span>
    </div>
  );
}

function EmployeeDetailShell() {
  const { id } = useParams<{ id: string }>();
  const { data: employee, isLoading, isError, error, refetch } = useEmployee(id);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Employee" breadcrumbs={[{ label: 'Employees', to: '/employees' }]} />
        <LoadingState label="Loading employee…" fill />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader title="Employee" breadcrumbs={[{ label: 'Employees', to: '/employees' }]} />
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!employee) return null;

  return <EmployeeDetailContent employee={employee} />;
}

export function EmployeeDetailPage() {
  return (
    <RequirePermission permission="employees.view">
      <EmployeeDetailShell />
    </RequirePermission>
  );
}
