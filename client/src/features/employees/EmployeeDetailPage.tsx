import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  Plus,
  Trash2,
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
import { ModalCancelAction, ModalSaveAction, ModalSendAction } from '@/components/ui/ModalActions';
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
  useChangeEmployeeManager,
  useCreateEmployeeDependent,
  useCreateEmployeeEmergencyContact,
  useDeleteEmployeeDependent,
  useDeleteEmployeeEmergencyContact,
  useDocumentRequirementsForType,
  useDocumentTypesForUpload,
  useEmployee,
  useRequestEmployeeCorrection,
  useUpdateEmployeeDependent,
  useUpdateEmployeeEmergencyContact,
  useUpdateEmployee,
  useUploadEmployeeDocument,
} from '@/features/employees/api';
import { ApproveOnboardingModal } from '@/features/employees/ApproveOnboardingModal';
import { ChangeStatusModal } from '@/features/employees/ChangeStatusModal';
import { useSetupLookups } from '@/features/workspace/api';
import { cn } from '@/lib/cn';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { Dependent, EmergencyContact, Employee } from '@/types/api';

type Tab = 'overview' | 'biodata' | 'contacts' | 'documents' | 'status' | 'reporting' | 'activity';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'biodata', label: 'Biodata' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'documents', label: 'Documents' },
  { key: 'status', label: 'Status history' },
  { key: 'reporting', label: 'Reporting history' },
  { key: 'activity', label: 'Activity' },
];

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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-strong">
      <GenderIcon gender={gender} />
      {formatText(gender)}
    </span>
  );
}

function EmployeeDetailContent({ employee }: { employee: Employee }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const { formatDate, formatDateTime } = useDateFormatter();
  const lookups = useSetupLookups();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState({ document_type_id: '', document_requirement_id: '', title: '', issued_at: '', expires_at: '', notes: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    relationship: '',
    phone: '',
    alternate_phone: '',
    email: '',
    address: '',
    is_primary: false,
  });
  const [dependentModalOpen, setDependentModalOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [dependentForm, setDependentForm] = useState({
    name: '',
    relationship: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    is_beneficiary: false,
  });
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    work_email: '',
    phone: '',
    department_id: '',
    unit_id: '',
    cluster_id: '',
    designation_id: '',
    employment_type_id: '',
    organization_location_id: '',
    start_date: '',
    pending_role_id: '',
    date_of_birth: '',
    gender: '',
    personal_email: '',
    residential_address: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
  });
  const editFormUnits = useMemo(
    () =>
      (lookups.data?.units ?? []).filter(
        (unit) => !editForm.department_id || String(unit.department_id) === editForm.department_id,
      ),
    [lookups.data?.units, editForm.department_id],
  );
  const editFormClusters = useMemo(
    () =>
      (lookups.data?.clusters ?? []).filter(
        (cluster) => !editForm.department_id || String(cluster.department_id) === editForm.department_id,
      ),
    [lookups.data?.clusters, editForm.department_id],
  );
  const [correctionSection, setCorrectionSection] = useState('Overview');
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [newManager, setNewManager] = useState<AsyncOption | null>(null);
  const [managerEffectiveDate, setManagerEffectiveDate] = useState(today());
  const [managerReason, setManagerReason] = useState('');
  const [managerNote, setManagerNote] = useState('');
  const updateEmployeeMutation = useUpdateEmployee(employee.id);
  const managerMutation = useChangeEmployeeManager(employee.id);
  const correctionMutation = useRequestEmployeeCorrection(employee.id);
  const documentTypesQuery = useDocumentTypesForUpload();
  const documentRequirementsQuery = useDocumentRequirementsForType(
    documentForm.document_type_id ? Number(documentForm.document_type_id) : undefined,
  );
  const uploadDocumentMutation = useUploadEmployeeDocument();
  const createContactMutation = useCreateEmployeeEmergencyContact(employee.id);
  const updateContactMutation = useUpdateEmployeeEmergencyContact(editingContact?.id);
  const deleteContactMutation = useDeleteEmployeeEmergencyContact();
  const createDependentMutation = useCreateEmployeeDependent(employee.id);
  const updateDependentMutation = useUpdateEmployeeDependent(editingDependent?.id);
  const deleteDependentMutation = useDeleteEmployeeDependent();

  // Most document types only have a single active requirement — default to
  // it rather than making HR notice and pick it, since leaving it unlinked
  // means it won't count toward the employee's compliance checklist.
  useEffect(() => {
    const requirements = documentRequirementsQuery.data?.data ?? [];
    if (requirements.length === 1 && !documentForm.document_requirement_id) {
      setDocumentForm((current) => ({ ...current, document_requirement_id: String(requirements[0].id) }));
    }
  }, [documentRequirementsQuery.data, documentForm.document_requirement_id]);

  const canApprove = hasPermission('employees.update') && employee.status === 'onboarding';
  const canViewEmployee = hasPermission('employees.view');
  const canUpdateEmployee = hasPermission('employees.update');
  const canUploadDocuments = hasPermission('employee_documents.create');

  async function handleUploadDocument() {
    if (!documentFile || !documentForm.document_type_id || !documentForm.title.trim()) return;
    try {
      await uploadDocumentMutation.mutateAsync({
        employee_id: employee.id,
        document_type_id: Number(documentForm.document_type_id),
        document_requirement_id: documentForm.document_requirement_id ? Number(documentForm.document_requirement_id) : undefined,
        title: documentForm.title,
        file: documentFile,
        issued_at: documentForm.issued_at || undefined,
        expires_at: documentForm.expires_at || undefined,
        notes: documentForm.notes || undefined,
      });
      setDocumentModalOpen(false);
      setDocumentForm({ document_type_id: '', document_requirement_id: '', title: '', issued_at: '', expires_at: '', notes: '' });
      setDocumentFile(null);
      toast.success('Document uploaded', 'It now appears in the employee’s documents.');
    } catch (error) {
      toast.error('Could not upload document', error instanceof ApiError ? error.message : 'Could not upload this document.');
    }
  }

  function openEditModal(employeeToEdit: Employee) {
    setEditForm({
      first_name: employeeToEdit.first_name,
      middle_name: employeeToEdit.middle_name ?? '',
      last_name: employeeToEdit.last_name,
      work_email: employeeToEdit.work_email,
      phone: employeeToEdit.phone ?? '',
      department_id: employeeToEdit.department_id ? String(employeeToEdit.department_id) : '',
      unit_id: employeeToEdit.unit_id ? String(employeeToEdit.unit_id) : '',
      cluster_id: employeeToEdit.cluster_id ? String(employeeToEdit.cluster_id) : '',
      designation_id: employeeToEdit.designation_id ? String(employeeToEdit.designation_id) : '',
      employment_type_id: employeeToEdit.employment_type_id ? String(employeeToEdit.employment_type_id) : '',
      organization_location_id: employeeToEdit.organization_location_id ? String(employeeToEdit.organization_location_id) : '',
      start_date: employeeToEdit.start_date ? employeeToEdit.start_date.slice(0, 10) : '',
      pending_role_id: employeeToEdit.pending_role_id ? String(employeeToEdit.pending_role_id) : '',
      date_of_birth: employeeToEdit.profile?.date_of_birth ? employeeToEdit.profile.date_of_birth.slice(0, 10) : '',
      gender: employeeToEdit.profile?.gender ?? '',
      personal_email: employeeToEdit.profile?.personal_email ?? '',
      residential_address: employeeToEdit.profile?.residential_address ?? '',
      next_of_kin_name: employeeToEdit.profile?.next_of_kin_name ?? '',
      next_of_kin_phone: employeeToEdit.profile?.next_of_kin_phone ?? '',
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
        unit_id: editForm.unit_id ? Number(editForm.unit_id) : null,
        cluster_id: editForm.cluster_id ? Number(editForm.cluster_id) : null,
        designation_id: editForm.designation_id ? Number(editForm.designation_id) : null,
        employment_type_id: editForm.employment_type_id ? Number(editForm.employment_type_id) : null,
        organization_location_id: editForm.organization_location_id ? Number(editForm.organization_location_id) : null,
        start_date: editForm.start_date || null,
        ...(hasPermission('employees.assign_role')
          ? { pending_role_id: editForm.pending_role_id ? Number(editForm.pending_role_id) : null }
          : {}),
        profile: {
          date_of_birth: editForm.date_of_birth || null,
          gender: editForm.gender || null,
          personal_email: editForm.personal_email || null,
          residential_address: editForm.residential_address || null,
          next_of_kin_name: editForm.next_of_kin_name || null,
          next_of_kin_phone: editForm.next_of_kin_phone || null,
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

  function openContactModal(contact: EmergencyContact | null) {
    setEditingContact(contact);
    setContactForm({
      name: contact?.name ?? '',
      relationship: contact?.relationship ?? '',
      phone: contact?.phone ?? '',
      alternate_phone: contact?.alternate_phone ?? '',
      email: contact?.email ?? '',
      address: contact?.address ?? '',
      is_primary: contact?.is_primary ?? false,
    });
    setContactModalOpen(true);
  }

  async function handleSaveContact() {
    const payload = {
      name: contactForm.name,
      relationship: contactForm.relationship || null,
      phone: contactForm.phone,
      alternate_phone: contactForm.alternate_phone || null,
      email: contactForm.email || null,
      address: contactForm.address || null,
      is_primary: contactForm.is_primary,
    };

    try {
      if (editingContact) {
        await updateContactMutation.mutateAsync(payload);
      } else {
        await createContactMutation.mutateAsync(payload);
      }
      setContactModalOpen(false);
      toast.success('Emergency contact saved', 'The employee record now has the updated contact details.');
    } catch (error) {
      toast.error('Could not save contact', actionError(error, 'Could not save this emergency contact.'));
    }
  }

  async function handleDeleteContact(contact: EmergencyContact) {
    try {
      await deleteContactMutation.mutateAsync(contact.id);
      toast.success('Emergency contact removed', 'The employee record has been updated.');
    } catch (error) {
      toast.error('Could not remove contact', actionError(error, 'Could not remove this emergency contact.'));
    }
  }

  function openDependentModal(dependent: Dependent | null) {
    setEditingDependent(dependent);
    setDependentForm({
      name: dependent?.name ?? '',
      relationship: dependent?.relationship ?? '',
      date_of_birth: dependent?.date_of_birth ? dependent.date_of_birth.slice(0, 10) : '',
      gender: dependent?.gender ?? '',
      phone: dependent?.phone ?? '',
      email: dependent?.email ?? '',
      address: dependent?.address ?? '',
      is_beneficiary: dependent?.is_beneficiary ?? false,
    });
    setDependentModalOpen(true);
  }

  async function handleSaveDependent() {
    const payload = {
      name: dependentForm.name,
      relationship: dependentForm.relationship,
      date_of_birth: dependentForm.date_of_birth || null,
      gender: dependentForm.gender || null,
      phone: dependentForm.phone || null,
      email: dependentForm.email || null,
      address: dependentForm.address || null,
      is_beneficiary: dependentForm.is_beneficiary,
    };

    try {
      if (editingDependent) {
        await updateDependentMutation.mutateAsync(payload);
      } else {
        await createDependentMutation.mutateAsync(payload);
      }
      setDependentModalOpen(false);
      toast.success('Dependent saved', 'The employee record now has the updated dependent details.');
    } catch (error) {
      toast.error('Could not save dependent', actionError(error, 'Could not save this dependent.'));
    }
  }

  async function handleDeleteDependent(dependent: Dependent) {
    try {
      await deleteDependentMutation.mutateAsync(dependent.id);
      toast.success('Dependent removed', 'The employee record has been updated.');
    } catch (error) {
      toast.error('Could not remove dependent', actionError(error, 'Could not remove this dependent.'));
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
            {employee.confirmation_status !== 'not_applicable' && <StatusBadge status={employee.confirmation_status} />}
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
                  <DropdownMenuItem icon={UserRoundCheck} onClick={() => setStatusModalOpen(true)}>
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
                <OverviewRow label="Confirmation status" value={<StatusBadge status={employee.confirmation_status} />} />
                <OverviewRow label="Department" value={employee.department?.name ?? '—'} />
                <OverviewRow label="Unit" value={employee.unit?.name ?? '—'} />
                <OverviewRow label="Cluster" value={employee.cluster?.name ?? '—'} />
                <OverviewRow label="Designation" value={employee.designation?.name ?? '—'} />
                <OverviewRow label="Grade level" value={employee.grade_level?.name ?? '—'} />
                <OverviewRow label="Employment type" value={employee.employment_type?.name ?? '—'} />
                <OverviewRow label="Location" value={employee.location?.name ?? '—'} />
                <OverviewRow label="Start date" value={formatDate(employee.start_date)} />
                <OverviewRow label="Invited" value={employee.invited_at ? formatDateTime(employee.invited_at) : 'Not invited'} />
                <OverviewRow label="Onboarding completed" value={formatDateTime(employee.onboarding_completed_at)} />
                <OverviewRow label="Activated" value={formatDateTime(employee.activated_at)} />
                {employee.probation_ends_at && (
                  <OverviewRow
                    label="Probation ends"
                    value={
                      <span className={new Date(employee.probation_ends_at) < new Date() ? 'text-warning' : undefined}>
                        {formatDate(employee.probation_ends_at)}
                      </span>
                    }
                  />
                )}
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
                </CardBody>
              ) : (
                <CardBody>
                  <EmptyState title="No biodata yet" description="The employee has not submitted their profile information." />
                </CardBody>
              )}
            </Card>
          )}

          {tab === 'contacts' && (
            <Card>
              <CardHeader>
                <CardTitle>Emergency contacts</CardTitle>
                {canUpdateEmployee && (
                  <Button type="button" size="icon" title="Add emergency contact" aria-label="Add emergency contact" onClick={() => openContactModal(null)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardBody className="p-0">
                {employee.emergency_contacts && employee.emergency_contacts.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.emergency_contacts.map((contact) => (
                      <li key={contact.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-strong">
                            {contact.name}
                            {contact.is_primary && (
                              <span className="rounded-full bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
                                Primary
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted">{formatText(contact.relationship)}</p>
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="mt-1 block truncate text-xs text-muted hover:text-teal hover:underline">
                              {contact.email}
                            </a>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <a href={phoneHref(contact.phone)} className="flex items-center gap-1.5 text-strong hover:text-teal hover:underline">
                            <Phone className="h-3.5 w-3.5 text-muted" />
                            {contact.phone}
                          </a>
                          {canUpdateEmployee && (
                            <>
                              <Button type="button" variant="ghost" size="icon" aria-label="Edit emergency contact" title="Edit" onClick={() => openContactModal(contact)}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" aria-label="Remove emergency contact" title="Remove" onClick={() => handleDeleteContact(contact)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No emergency contacts" description="The employee has not added any emergency contacts yet." />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'contacts' && (
            <Card className="mt-5">
              <CardHeader>
                <CardTitle>Dependents</CardTitle>
                {canUpdateEmployee && (
                  <Button type="button" size="icon" title="Add dependent" aria-label="Add dependent" onClick={() => openDependentModal(null)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardBody className="p-0">
                {employee.dependents && employee.dependents.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.dependents.map((dependent) => (
                      <li key={dependent.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-strong">
                            {dependent.name}
                            {dependent.is_beneficiary && (
                              <span className="rounded-full bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
                                Beneficiary
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {formatText(dependent.relationship)} · {formatDate(dependent.date_of_birth)}
                          </p>
                          {dependent.email && (
                            <a href={`mailto:${dependent.email}`} className="mt-1 block truncate text-xs text-muted hover:text-teal hover:underline">
                              {dependent.email}
                            </a>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {dependent.phone && (
                            <a href={phoneHref(dependent.phone)} className="flex items-center gap-1.5 text-strong hover:text-teal hover:underline">
                              <Phone className="h-3.5 w-3.5 text-muted" />
                              {dependent.phone}
                            </a>
                          )}
                          {canUpdateEmployee && (
                            <>
                              <Button type="button" variant="ghost" size="icon" aria-label="Edit dependent" title="Edit" onClick={() => openDependentModal(dependent)}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" aria-label="Remove dependent" title="Remove" onClick={() => handleDeleteDependent(dependent)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No dependents" description="Dependents added for this employee will appear here." />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'documents' && (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                {canUploadDocuments && (
                  <Button type="button" size="sm" onClick={() => setDocumentModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Upload document
                  </Button>
                )}
              </CardHeader>
              <CardBody className="p-0">
                {employee.documents && employee.documents.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {employee.documents.map((doc) => {
                      const needsAcknowledgment = doc.document_type?.signature_method === 'acknowledge' && !doc.acknowledged_at;
                      return (
                        <li key={doc.id} className="flex items-center justify-between px-5 py-3 text-sm">
                          <div>
                            <p className="font-medium text-strong">{doc.title}</p>
                            <p className="text-xs text-muted">{doc.document_type?.name}</p>
                          </div>
                          <StatusBadge status={needsAcknowledgment ? 'pending_acknowledgment' : doc.status} />
                        </li>
                      );
                    })}
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={entry.new_status} />
                            {entry.new_confirmation_status && entry.new_confirmation_status !== entry.previous_confirmation_status && (
                              <StatusBadge status={entry.new_confirmation_status} />
                            )}
                          </div>
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
                          {activity.actor?.name ?? 'System'} · {formatDateTime(activity.created_at)}
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

      {confirmApprove && (
        <ApproveOnboardingModal employee={employee} open onClose={() => setConfirmApprove(false)} />
      )}

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
              onChange={(value) =>
                setEditForm((current) => ({ ...current, department_id: value, unit_id: '', cluster_id: '' }))
              }
              options={lookupOptions(lookups.data?.departments, 'Unassigned')}
            />
          </ActionField>
          <ActionField label="Unit">
            <SelectMenu
              value={editForm.unit_id}
              onChange={(value) => setEditForm((current) => ({ ...current, unit_id: value }))}
              options={lookupOptions(editFormUnits, 'Unassigned')}
            />
          </ActionField>
          <ActionField label="Cluster">
            <SelectMenu
              value={editForm.cluster_id}
              onChange={(value) => setEditForm((current) => ({ ...current, cluster_id: value }))}
              options={lookupOptions(editFormClusters, 'Unassigned')}
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
            <h3 className="text-sm font-semibold text-strong">System access</h3>
            <p className="mt-1 text-xs text-muted">
              Separate from designation — controls what this employee can access in Valtireo.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(lookups.data?.assignable_roles ?? []).length > 0 ? (
                <ActionField label="System role">
                  <SelectMenu
                    value={editForm.pending_role_id}
                    onChange={(value) => setEditForm((current) => ({ ...current, pending_role_id: value }))}
                    options={[{ value: '', label: 'Employee (default)' }, ...(lookups.data?.assignable_roles ?? [])]}
                  />
                </ActionField>
              ) : (
                <ActionField label="System role">
                  <p className="py-1.5 text-sm text-muted">
                    {employee.user?.roles && employee.user.roles.length > 0 ? employee.user.roles.join(', ') : 'Employee'}
                  </p>
                </ActionField>
              )}
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

      {statusModalOpen && (
        <ChangeStatusModal
          employee={employee}
          open
          onClose={() => setStatusModalOpen(false)}
          onChanged={() => setTab('status')}
        />
      )}

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

      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={editingContact ? 'Edit emergency contact' : 'Add emergency contact'}
        footer={
          <>
            <ModalCancelAction onClick={() => setContactModalOpen(false)} />
            <ModalSaveAction
              isLoading={createContactMutation.isPending || updateContactMutation.isPending}
              disabled={
                !contactForm.name.trim() ||
                !contactForm.phone.trim() ||
                (Boolean(contactForm.email) && !isValidEmail(contactForm.email))
              }
              onClick={handleSaveContact}
            />
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ActionField label="Name">
            <Input value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} />
          </ActionField>
          <ActionField label="Relationship">
            <Input value={contactForm.relationship} onChange={(event) => setContactForm((current) => ({ ...current, relationship: event.target.value }))} />
          </ActionField>
          <ActionField label="Phone">
            <PhoneInput value={contactForm.phone} onChange={(value) => setContactForm((current) => ({ ...current, phone: value }))} />
          </ActionField>
          <ActionField label="Alternate phone">
            <PhoneInput value={contactForm.alternate_phone} onChange={(value) => setContactForm((current) => ({ ...current, alternate_phone: value }))} />
          </ActionField>
          <ActionField label="Email" error={contactForm.email && !isValidEmail(contactForm.email) ? 'Enter a valid email address' : undefined}>
            <Input
              type="email"
              invalid={Boolean(contactForm.email) && !isValidEmail(contactForm.email)}
              value={contactForm.email}
              onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
            />
          </ActionField>
          <label className="mt-6 flex items-center gap-2 text-sm text-strong">
            <input
              type="checkbox"
              checked={contactForm.is_primary}
              onChange={(event) => setContactForm((current) => ({ ...current, is_primary: event.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Primary contact
          </label>
          <div className="md:col-span-2">
            <ActionField label="Address">
              <Textarea value={contactForm.address} onChange={(event) => setContactForm((current) => ({ ...current, address: event.target.value }))} />
            </ActionField>
          </div>
        </div>
      </Modal>

      <Modal
        open={dependentModalOpen}
        onClose={() => setDependentModalOpen(false)}
        title={editingDependent ? 'Edit dependent' : 'Add dependent'}
        footer={
          <>
            <ModalCancelAction onClick={() => setDependentModalOpen(false)} />
            <ModalSaveAction
              isLoading={createDependentMutation.isPending || updateDependentMutation.isPending}
              disabled={
                !dependentForm.name.trim() ||
                !dependentForm.relationship.trim() ||
                (Boolean(dependentForm.email) && !isValidEmail(dependentForm.email))
              }
              onClick={handleSaveDependent}
            />
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ActionField label="Name">
            <Input value={dependentForm.name} onChange={(event) => setDependentForm((current) => ({ ...current, name: event.target.value }))} />
          </ActionField>
          <ActionField label="Relationship">
            <Input value={dependentForm.relationship} onChange={(event) => setDependentForm((current) => ({ ...current, relationship: event.target.value }))} />
          </ActionField>
          <ActionField label="Date of birth">
            <DatePicker value={dependentForm.date_of_birth} onChange={(value) => setDependentForm((current) => ({ ...current, date_of_birth: value }))} />
          </ActionField>
          <ActionField label="Gender">
            <SelectMenu value={dependentForm.gender} onChange={(value) => setDependentForm((current) => ({ ...current, gender: value }))} options={GENDER_OPTIONS} />
          </ActionField>
          <ActionField label="Phone">
            <PhoneInput value={dependentForm.phone} onChange={(value) => setDependentForm((current) => ({ ...current, phone: value }))} />
          </ActionField>
          <ActionField label="Email" error={dependentForm.email && !isValidEmail(dependentForm.email) ? 'Enter a valid email address' : undefined}>
            <Input
              type="email"
              invalid={Boolean(dependentForm.email) && !isValidEmail(dependentForm.email)}
              value={dependentForm.email}
              onChange={(event) => setDependentForm((current) => ({ ...current, email: event.target.value }))}
            />
          </ActionField>
          <label className="flex items-center gap-2 text-sm text-strong">
            <input
              type="checkbox"
              checked={dependentForm.is_beneficiary}
              onChange={(event) => setDependentForm((current) => ({ ...current, is_beneficiary: event.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Beneficiary
          </label>
          <div className="md:col-span-2">
            <ActionField label="Address">
              <Textarea value={dependentForm.address} onChange={(event) => setDependentForm((current) => ({ ...current, address: event.target.value }))} />
            </ActionField>
          </div>
        </div>
      </Modal>

      <Modal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        title="Upload document"
        footer={
          <>
            <ModalCancelAction onClick={() => setDocumentModalOpen(false)} />
            <ModalSendAction
              title="Upload"
              isLoading={uploadDocumentMutation.isPending}
              disabled={!documentFile || !documentForm.document_type_id || !documentForm.title.trim()}
              onClick={handleUploadDocument}
            />
          </>
        }
      >
        <div className="space-y-3">
          <ActionField label="Document type">
            <SelectMenu
              value={documentForm.document_type_id}
              onChange={(value) => {
                const selectedType = documentTypesQuery.data?.data.find((type) => String(type.id) === value);
                setDocumentForm((current) => ({
                  ...current,
                  document_type_id: value,
                  document_requirement_id: '',
                  title: current.title || selectedType?.name || current.title,
                }));
              }}
              options={(documentTypesQuery.data?.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))}
              placeholder="Select document type"
            />
          </ActionField>
          {(documentRequirementsQuery.data?.data?.length ?? 0) > 0 && (
            <ActionField label="Satisfies requirement">
              <SelectMenu
                value={documentForm.document_requirement_id}
                onChange={(value) => setDocumentForm((current) => ({ ...current, document_requirement_id: value }))}
                options={[
                  { value: '', label: 'Not tied to a specific requirement' },
                  ...(documentRequirementsQuery.data?.data ?? []).map((requirement) => ({
                    value: String(requirement.id),
                    label: requirement.name,
                  })),
                ]}
              />
            </ActionField>
          )}
          <ActionField label="Title">
            <Input
              value={documentForm.title}
              onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Employment Contract"
            />
          </ActionField>
          <ActionField label="File">
            <input
              type="file"
              onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong"
            />
          </ActionField>
          <ActionField label="Issued on (optional)">
            <DatePicker value={documentForm.issued_at} onChange={(value) => setDocumentForm((current) => ({ ...current, issued_at: value }))} />
          </ActionField>
          <ActionField label="Expires on (optional)">
            <DatePicker value={documentForm.expires_at} onChange={(value) => setDocumentForm((current) => ({ ...current, expires_at: value }))} />
          </ActionField>
          <ActionField label="Notes">
            <Textarea value={documentForm.notes} onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))} />
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
