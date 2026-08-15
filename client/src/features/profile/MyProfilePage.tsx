import { useRef, useState, type ReactNode } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSendAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import {
  useCreateDependent,
  useCreateEmergencyContact,
  useDeleteDependent,
  useDeleteEmergencyContact,
  useMyDocumentTypes,
  useMyProfileOverview,
  useSubmitMyDocument,
  useUpdateDependent,
  useUpdateEmergencyContact,
  useUpdateMyCustomFieldValues,
  useUpdateMyProfile,
} from '@/features/profile/api';
import { ApiError } from '@/lib/apiClient';
import { isValidEmail } from '@/lib/validation';
import { cn } from '@/lib/cn';
import type {
  Dependent,
  EmergencyContact,
  EmployeeCustomFieldValue,
  EmployeeProfileOverview,
} from '@/types/api';

type Tab = 'overview' | 'biodata' | 'contacts' | 'dependents' | 'documents' | 'custom_fields';

const GENDER_OPTIONS: SelectMenuOption[] = [
  { value: '', label: 'Not specified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000000)?Z?)?$/);
  if (dateOnly) return dateOnly[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatText(value: string | null | undefined): string {
  if (!value) return '-';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function employeeInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function OverviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-surface-soft px-3 py-2.5">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <span className="mt-1 block min-w-0 font-medium text-strong">{value}</span>
    </div>
  );
}

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function MyProfileContent({ overview, onRefetch }: { overview: EmployeeProfileOverview; onRefetch: () => void }) {
  const toast = useToast();
  const { employee, profile, emergency_contacts, dependents, documents, custom_fields, activities } = overview;
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'biodata', label: 'Biodata' },
    { key: 'contacts', label: 'Emergency contacts' },
    { key: 'dependents', label: 'Dependents' },
    { key: 'documents', label: 'Documents' },
    ...(custom_fields.length > 0 ? [{ key: 'custom_fields' as Tab, label: 'More details' }] : []),
  ];

  // Biodata form
  const [biodata, setBiodata] = useState({
    date_of_birth: profile?.date_of_birth ? profile.date_of_birth.slice(0, 10) : '',
    gender: profile?.gender ?? '',
    personal_email: profile?.personal_email ?? '',
    residential_address: profile?.residential_address ?? '',
    next_of_kin_name: profile?.next_of_kin_name ?? '',
    next_of_kin_phone: profile?.next_of_kin_phone ?? '',
    emergency_contact_name: profile?.emergency_contact_name ?? '',
    emergency_contact_phone: profile?.emergency_contact_phone ?? '',
  });
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const updateProfileMutation = useUpdateMyProfile();
  const personalEmailError = biodata.personal_email && !isValidEmail(biodata.personal_email) ? 'Enter a valid email address' : undefined;

  async function handleSaveBiodata() {
    try {
      await updateProfileMutation.mutateAsync({
        ...biodata,
        date_of_birth: biodata.date_of_birth || null,
        gender: biodata.gender || null,
        personal_email: biodata.personal_email || null,
        residential_address: biodata.residential_address || null,
        next_of_kin_name: biodata.next_of_kin_name || null,
        next_of_kin_phone: biodata.next_of_kin_phone || null,
        emergency_contact_name: biodata.emergency_contact_name || null,
        emergency_contact_phone: biodata.emergency_contact_phone || null,
        passport_photo: passportPhoto,
      });
      setPassportPhoto(null);
      toast.success('Profile saved', 'Your biodata has been updated.');
      onRefetch();
    } catch (error) {
      toast.error('Could not save profile', actionError(error, 'Could not save your biodata.'));
    }
  }

  // Emergency contacts
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', alternate_phone: '', email: '', address: '', is_primary: false });
  const createContactMutation = useCreateEmergencyContact();
  const updateContactMutation = useUpdateEmergencyContact(editingContact?.id ?? 0);
  const deleteContactMutation = useDeleteEmergencyContact();

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
      toast.success('Emergency contact saved');
      onRefetch();
    } catch (error) {
      toast.error('Could not save contact', actionError(error, 'Could not save this emergency contact.'));
    }
  }

  async function handleDeleteContact(contact: EmergencyContact) {
    try {
      await deleteContactMutation.mutateAsync(contact.id);
      toast.success('Emergency contact removed');
      onRefetch();
    } catch (error) {
      toast.error('Could not remove contact', actionError(error, 'Could not remove this emergency contact.'));
    }
  }

  // Dependents
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
  const createDependentMutation = useCreateDependent();
  const updateDependentMutation = useUpdateDependent(editingDependent?.id ?? 0);
  const deleteDependentMutation = useDeleteDependent();

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
      toast.success('Dependent saved');
      onRefetch();
    } catch (error) {
      toast.error('Could not save dependent', actionError(error, 'Could not save this dependent.'));
    }
  }

  async function handleDeleteDependent(dependent: Dependent) {
    try {
      await deleteDependentMutation.mutateAsync(dependent.id);
      toast.success('Dependent removed');
      onRefetch();
    } catch (error) {
      toast.error('Could not remove dependent', actionError(error, 'Could not remove this dependent.'));
    }
  }

  // Documents
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState({ document_type_id: '', title: '', issued_at: '', expires_at: '', notes: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentTypesQuery = useMyDocumentTypes();
  const submitDocumentMutation = useSubmitMyDocument();

  async function handleSubmitDocument() {
    if (!documentFile || !documentForm.document_type_id) return;
    try {
      await submitDocumentMutation.mutateAsync({
        document_type_id: Number(documentForm.document_type_id),
        title: documentForm.title,
        file: documentFile,
        issued_at: documentForm.issued_at || undefined,
        expires_at: documentForm.expires_at || undefined,
        notes: documentForm.notes || undefined,
      });
      setDocumentModalOpen(false);
      setDocumentForm({ document_type_id: '', title: '', issued_at: '', expires_at: '', notes: '' });
      setDocumentFile(null);
      toast.success('Document submitted', 'It will appear here once HR reviews it.');
      onRefetch();
    } catch (error) {
      toast.error('Could not submit document', actionError(error, 'Could not submit this document.'));
    }
  }

  // Custom fields
  const editableFields = custom_fields.filter((entry) => entry.field.editable_by_employee);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(
    Object.fromEntries(custom_fields.map((entry) => [entry.field.key, entry.value])),
  );
  const updateCustomFieldsMutation = useUpdateMyCustomFieldValues();

  async function handleSaveCustomFields() {
    try {
      await updateCustomFieldsMutation.mutateAsync(
        editableFields.map((entry) => ({ key: entry.field.key, value: customFieldValues[entry.field.key] ?? null })),
      );
      toast.success('Details saved');
      onRefetch();
    } catch (error) {
      toast.error('Could not save details', actionError(error, 'Could not save these details.'));
    }
  }

  return (
    <div>
      <PageHeader
        title="My profile"
        subtitle={`${employee.employee_number} · ${employee.designation?.name ?? 'No designation'} · ${employee.department?.name ?? 'No department'}`}
        status={profile ? <StatusBadge status={profile.completion_status} /> : undefined}
      />

      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={cn(
              'border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors',
              tab === tabItem.key ? 'border-pine text-pine' : 'border-transparent text-muted hover:text-strong',
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
            <OverviewRow label="Designation" value={employee.designation?.name ?? '—'} />
            <OverviewRow label="Employment type" value={employee.employment_type?.name ?? '—'} />
            <OverviewRow label="Location" value={employee.location?.name ?? '—'} />
            <OverviewRow label="Start date" value={formatDate(employee.start_date)} />
            <OverviewRow label="Profile status" value={profile ? <StatusBadge status={profile.completion_status} /> : '—'} />
            <div className="md:col-span-2">
              <p className="mb-2 text-xs font-medium text-muted">Recent activity</p>
              {activities.length === 0 ? (
                <p className="text-sm text-muted">No activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {activities.slice(0, 5).map((activity) => (
                    <li key={activity.id} className="px-4 py-2.5 text-sm">
                      <p className="font-medium text-strong">{activity.title}</p>
                      {activity.description && <p className="text-muted">{activity.description}</p>}
                      <p className="mt-1 text-xs text-muted">{formatDate(activity.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'biodata' && (
        <Card>
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-teal/10">
                {passportPreview || profile?.passport_photo_url ? (
                  <img
                    src={passportPreview ?? profile?.passport_photo_url ?? ''}
                    alt={`${employee.full_name} passport`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-lg font-semibold text-teal">{employeeInitials(employee.full_name)}</span>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setPassportPhoto(file);
                  setPassportPreview(URL.createObjectURL(file));
                }}
              />
              <Button type="button" variant="secondary" onClick={() => photoInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                Upload photo
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField label="Date of birth">
                <DatePicker value={biodata.date_of_birth} onChange={(value) => setBiodata((current) => ({ ...current, date_of_birth: value }))} />
              </ProfileField>
              <ProfileField label="Gender">
                <SelectMenu value={biodata.gender} onChange={(value) => setBiodata((current) => ({ ...current, gender: value }))} options={GENDER_OPTIONS} />
              </ProfileField>
              <ProfileField label="Personal email">
                <Input
                  type="email"
                  invalid={Boolean(personalEmailError)}
                  value={biodata.personal_email}
                  onChange={(event) => setBiodata((current) => ({ ...current, personal_email: event.target.value }))}
                />
                {personalEmailError && <span className="mt-1 block text-xs text-danger">{personalEmailError}</span>}
              </ProfileField>
              <ProfileField label="Next of kin name">
                <Input value={biodata.next_of_kin_name} onChange={(event) => setBiodata((current) => ({ ...current, next_of_kin_name: event.target.value }))} />
              </ProfileField>
              <ProfileField label="Next of kin phone">
                <PhoneInput value={biodata.next_of_kin_phone} onChange={(value) => setBiodata((current) => ({ ...current, next_of_kin_phone: value }))} />
              </ProfileField>
              <ProfileField label="Emergency contact name">
                <Input
                  value={biodata.emergency_contact_name}
                  onChange={(event) => setBiodata((current) => ({ ...current, emergency_contact_name: event.target.value }))}
                />
              </ProfileField>
              <ProfileField label="Emergency contact phone">
                <PhoneInput
                  value={biodata.emergency_contact_phone}
                  onChange={(value) => setBiodata((current) => ({ ...current, emergency_contact_phone: value }))}
                />
              </ProfileField>
              <div className="sm:col-span-2">
                <ProfileField label="Residential address">
                  <Textarea
                    value={biodata.residential_address}
                    onChange={(event) => setBiodata((current) => ({ ...current, residential_address: event.target.value }))}
                  />
                </ProfileField>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              isLoading={updateProfileMutation.isPending}
              disabled={Boolean(personalEmailError)}
              onClick={handleSaveBiodata}
            >
              Save changes
            </Button>
          </CardBody>
        </Card>
      )}

      {tab === 'contacts' && (
        <Card>
          <CardHeader>
            <CardTitle>Emergency contacts</CardTitle>
            <Button type="button" size="sm" onClick={() => openContactModal(null)}>
              <Plus className="h-3.5 w-3.5" /> Add contact
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {emergency_contacts.length === 0 ? (
              <EmptyState title="No emergency contacts yet" description="Add someone we can reach in an emergency." />
            ) : (
              <ul className="divide-y divide-border">
                {emergency_contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-strong">
                        {contact.name} {contact.is_primary && <span className="ml-1 text-xs text-teal">Primary</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {formatText(contact.relationship)} · {contact.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openContactModal(contact)}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove contact" onClick={() => handleDeleteContact(contact)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'dependents' && (
        <Card>
          <CardHeader>
            <CardTitle>Dependents</CardTitle>
            <Button type="button" size="sm" onClick={() => openDependentModal(null)}>
              <Plus className="h-3.5 w-3.5" /> Add dependent
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {dependents.length === 0 ? (
              <EmptyState title="No dependents yet" />
            ) : (
              <ul className="divide-y divide-border">
                {dependents.map((dependent) => (
                  <li key={dependent.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-strong">
                        {dependent.name} {dependent.is_beneficiary && <span className="ml-1 text-xs text-teal">Beneficiary</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {formatText(dependent.relationship)} · {formatDate(dependent.date_of_birth)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openDependentModal(dependent)}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove dependent" onClick={() => handleDeleteDependent(dependent)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <Button type="button" size="sm" onClick={() => setDocumentModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Submit document
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {documents.length === 0 ? (
              <EmptyState title="No documents yet" description="Documents you submit will appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-strong">{doc.title}</p>
                      <p className="text-xs text-muted">{doc.document_type?.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.status} />
                      {doc.download_url && (
                        <a href={doc.download_url} className="text-muted hover:text-teal" title="Download" aria-label="Download">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'custom_fields' && (
        <Card>
          <CardBody className="space-y-4">
            {custom_fields.map((entry) => (
              <CustomFieldRow
                key={entry.id}
                entry={entry}
                value={customFieldValues[entry.field.key]}
                onChange={(value) => setCustomFieldValues((current) => ({ ...current, [entry.field.key]: value }))}
              />
            ))}
            {editableFields.length > 0 && (
              <Button type="button" variant="primary" isLoading={updateCustomFieldsMutation.isPending} onClick={handleSaveCustomFields}>
                Save changes
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={editingContact ? 'Edit emergency contact' : 'Add emergency contact'}
        footer={
          <>
            <ModalCancelAction onClick={() => setContactModalOpen(false)} />
            <ModalSendAction
              title="Save"
              isLoading={createContactMutation.isPending || updateContactMutation.isPending}
              disabled={!contactForm.name.trim() || !contactForm.phone.trim()}
              onClick={handleSaveContact}
            />
          </>
        }
      >
        <div className="space-y-4">
          <ProfileField label="Name">
            <Input value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} />
          </ProfileField>
          <ProfileField label="Relationship">
            <Input value={contactForm.relationship} onChange={(event) => setContactForm((current) => ({ ...current, relationship: event.target.value }))} />
          </ProfileField>
          <ProfileField label="Phone">
            <PhoneInput value={contactForm.phone} onChange={(value) => setContactForm((current) => ({ ...current, phone: value }))} />
          </ProfileField>
          <ProfileField label="Alternate phone">
            <PhoneInput value={contactForm.alternate_phone} onChange={(value) => setContactForm((current) => ({ ...current, alternate_phone: value }))} />
          </ProfileField>
          <ProfileField label="Email">
            <Input type="email" value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} />
          </ProfileField>
          <ProfileField label="Address">
            <Textarea value={contactForm.address} onChange={(event) => setContactForm((current) => ({ ...current, address: event.target.value }))} />
          </ProfileField>
          <label className="flex items-center gap-2 text-sm text-strong">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={contactForm.is_primary}
              onChange={(event) => setContactForm((current) => ({ ...current, is_primary: event.target.checked }))}
            />
            Primary contact
          </label>
        </div>
      </Modal>

      <Modal
        open={dependentModalOpen}
        onClose={() => setDependentModalOpen(false)}
        title={editingDependent ? 'Edit dependent' : 'Add dependent'}
        footer={
          <>
            <ModalCancelAction onClick={() => setDependentModalOpen(false)} />
            <ModalSendAction
              title="Save"
              isLoading={createDependentMutation.isPending || updateDependentMutation.isPending}
              disabled={!dependentForm.name.trim() || !dependentForm.relationship.trim()}
              onClick={handleSaveDependent}
            />
          </>
        }
      >
        <div className="space-y-4">
          <ProfileField label="Name">
            <Input value={dependentForm.name} onChange={(event) => setDependentForm((current) => ({ ...current, name: event.target.value }))} />
          </ProfileField>
          <ProfileField label="Relationship">
            <Input value={dependentForm.relationship} onChange={(event) => setDependentForm((current) => ({ ...current, relationship: event.target.value }))} />
          </ProfileField>
          <ProfileField label="Date of birth">
            <DatePicker value={dependentForm.date_of_birth} onChange={(value) => setDependentForm((current) => ({ ...current, date_of_birth: value }))} />
          </ProfileField>
          <ProfileField label="Gender">
            <SelectMenu value={dependentForm.gender} onChange={(value) => setDependentForm((current) => ({ ...current, gender: value }))} options={GENDER_OPTIONS} />
          </ProfileField>
          <ProfileField label="Phone">
            <PhoneInput value={dependentForm.phone} onChange={(value) => setDependentForm((current) => ({ ...current, phone: value }))} />
          </ProfileField>
          <ProfileField label="Email">
            <Input type="email" value={dependentForm.email} onChange={(event) => setDependentForm((current) => ({ ...current, email: event.target.value }))} />
          </ProfileField>
          <ProfileField label="Address">
            <Textarea value={dependentForm.address} onChange={(event) => setDependentForm((current) => ({ ...current, address: event.target.value }))} />
          </ProfileField>
          <label className="flex items-center gap-2 text-sm text-strong">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={dependentForm.is_beneficiary}
              onChange={(event) => setDependentForm((current) => ({ ...current, is_beneficiary: event.target.checked }))}
            />
            Beneficiary
          </label>
        </div>
      </Modal>

      <Modal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        title="Submit document"
        footer={
          <>
            <ModalCancelAction onClick={() => setDocumentModalOpen(false)} />
            <ModalSendAction
              title="Submit"
              isLoading={submitDocumentMutation.isPending}
              disabled={!documentFile || !documentForm.document_type_id || !documentForm.title.trim()}
              onClick={handleSubmitDocument}
            />
          </>
        }
      >
        <div className="space-y-4">
          <ProfileField label="Document type">
            <SelectMenu
              value={documentForm.document_type_id}
              onChange={(value) => setDocumentForm((current) => ({ ...current, document_type_id: value }))}
              options={(documentTypesQuery.data?.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))}
              placeholder="Select document type"
            />
          </ProfileField>
          <ProfileField label="Title">
            <Input value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} />
          </ProfileField>
          <ProfileField label="File">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-strong file:mr-3 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong hover:file:bg-surface-soft"
            />
          </ProfileField>
          <ProfileField label="Issued on">
            <DatePicker value={documentForm.issued_at} onChange={(value) => setDocumentForm((current) => ({ ...current, issued_at: value }))} />
          </ProfileField>
          <ProfileField label="Expires on">
            <DatePicker value={documentForm.expires_at} onChange={(value) => setDocumentForm((current) => ({ ...current, expires_at: value }))} />
          </ProfileField>
          <ProfileField label="Notes">
            <Textarea value={documentForm.notes} onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))} />
          </ProfileField>
        </div>
      </Modal>
    </div>
  );
}

function CustomFieldRow({
  entry,
  value,
  onChange,
}: {
  entry: EmployeeCustomFieldValue;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { field } = entry;

  if (!field.editable_by_employee) {
    return (
      <OverviewRow label={field.name} value={String(entry.value ?? '—')} />
    );
  }

  return (
    <ProfileField label={field.name}>
      {field.type === 'textarea' ? (
        <Textarea value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === 'boolean' ? (
        <label className="flex items-center gap-2 text-sm text-strong">
          <input type="checkbox" className="h-4 w-4 rounded border-border" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
          {field.name}
        </label>
      ) : field.type === 'date' ? (
        <DatePicker value={value ? String(value).slice(0, 10) : ''} onChange={onChange} />
      ) : field.type === 'select' ? (
        <SelectMenu
          value={String(value ?? '')}
          onChange={onChange}
          options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        />
      ) : (
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </ProfileField>
  );
}

function MyProfileShell() {
  const overviewQuery = useMyProfileOverview();

  if (overviewQuery.isLoading) {
    return (
      <div>
        <PageHeader title="My profile" subtitle="Your biodata, contacts, dependents, and documents." />
        <LoadingState label="Loading your profile…" fill />
      </div>
    );
  }

  if (overviewQuery.isError) {
    if (overviewQuery.error instanceof ApiError && overviewQuery.error.status === 404) {
      return (
        <div>
          <PageHeader title="My profile" subtitle="Your biodata, contacts, dependents, and documents." />
          <EmptyState title="No employee record is linked to your account yet" description="Ask your workspace admin to link your account to an employee record." />
        </div>
      );
    }
    return (
      <div>
        <PageHeader title="My profile" subtitle="Your biodata, contacts, dependents, and documents." />
        <ErrorState error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />
      </div>
    );
  }

  if (!overviewQuery.data) return null;

  return <MyProfileContent overview={overviewQuery.data} onRefetch={() => overviewQuery.refetch()} />;
}

export function MyProfilePage() {
  return <MyProfileShell />;
}
