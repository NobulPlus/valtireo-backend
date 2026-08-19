import { useState, type FormEvent } from 'react';
import { CheckCircle2, ListChecks, MoreHorizontal, Pencil, Plus, X, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown, DropdownMenuItem } from '@/components/ui/Dropdown';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { ApiError } from '@/lib/apiClient';
import type { EmployeeCustomFieldDefinition, EmployeeCustomFieldType } from '@/types/api';
import {
  useCreateCustomField,
  useCustomFields,
  useSetCustomFieldActive,
  useUpdateCustomField,
  type CustomFieldPayload,
} from '@/features/settings/customFieldsApi';

const FIELD_TYPES: { value: EmployeeCustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Single select' },
  { value: 'multi_select', label: 'Multi select' },
];

const TYPE_LABEL = new Map(FIELD_TYPES.map((type) => [type.value, type.label]));

function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function fieldColumns({
  onEdit,
  onToggleActive,
}: {
  onEdit: (field: EmployeeCustomFieldDefinition) => void;
  onToggleActive: (field: EmployeeCustomFieldDefinition) => void;
}): Column<EmployeeCustomFieldDefinition>[] {
  return [
    {
      key: 'name',
      header: 'Field',
      render: (field) => (
        <div>
          <p className="font-medium text-strong">{field.name}</p>
          <p className="text-xs text-muted">{field.key}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (field) => TYPE_LABEL.get(field.type) ?? field.type,
    },
    {
      key: 'required',
      header: 'Required',
      render: (field) => (field.is_required ? 'Yes' : '—'),
    },
    {
      key: 'visibility',
      header: 'Employee visibility',
      render: (field) => (field.visible_to_employee ? (field.editable_by_employee ? 'Visible, editable' : 'Visible, read-only') : 'Hidden'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (field) => <StatusBadge status={field.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (field) => (
        <Dropdown
          align="right"
          trigger={({ toggle }) => (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                toggle();
              }}
              aria-label={`Actions for ${field.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        >
          <DropdownMenuItem icon={Pencil} onClick={() => onEdit(field)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem icon={field.is_active ? XCircle : CheckCircle2} onClick={() => onToggleActive(field)}>
            {field.is_active ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
        </Dropdown>
      ),
    },
  ];
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function addOption() {
    const value = draft.trim();
    if (!value || options.includes(value)) return;
    onChange([...options, value]);
    setDraft('');
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addOption();
            }
          }}
          placeholder="Add an option and press Enter"
        />
        <Button type="button" variant="secondary" onClick={addOption}>
          Add
        </Button>
      </div>
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((option) => (
            <span
              key={option}
              className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-xs text-strong"
            >
              {option}
              <button
                type="button"
                onClick={() => onChange(options.filter((existing) => existing !== option))}
                className="text-muted hover:text-danger"
                aria-label={`Remove ${option}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldFormState {
  name: string;
  key: string;
  keyTouched: boolean;
  type: EmployeeCustomFieldType;
  options: string[];
  isRequired: boolean;
  visibleToEmployee: boolean;
  editableByEmployee: boolean;
}

function CustomFieldEditorModal({ onClose, field }: { onClose: () => void; field: EmployeeCustomFieldDefinition | null }) {
  const toast = useToast();
  const isEditing = field !== null;
  const [form, setForm] = useState<FieldFormState>(() =>
    field
      ? {
          name: field.name,
          key: field.key,
          keyTouched: true,
          type: field.type,
          options: field.options ?? [],
          isRequired: field.is_required,
          visibleToEmployee: field.visible_to_employee,
          editableByEmployee: field.editable_by_employee,
        }
      : {
          name: '',
          key: '',
          keyTouched: false,
          type: 'text',
          options: [],
          isRequired: false,
          visibleToEmployee: true,
          editableByEmployee: false,
        },
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const createMutation = useCreateCustomField();
  const updateMutation = useUpdateCustomField(field?.id ?? 0);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const usesOptions = form.type === 'select' || form.type === 'multi_select';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNameError(null);
    setKeyError(null);

    const name = form.name.trim();
    const key = form.key.trim();

    if (!name) {
      setNameError('Field name is required.');
      return;
    }
    if (!key) {
      setKeyError('Field key is required.');
      return;
    }

    const payload: CustomFieldPayload = {
      name,
      key,
      type: form.type,
      options: usesOptions ? form.options : [],
      is_required: form.isRequired,
      visible_to_employee: form.visibleToEmployee,
      editable_by_employee: form.editableByEmployee,
    };

    try {
      if (isEditing && field) {
        await updateMutation.mutateAsync(payload);
        toast.success('Field updated', `${name} has been saved.`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Field created', `${name} is now available on employee profiles.`);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const nameMessage = error.fieldError('name');
        const keyMessage = error.fieldError('key');
        if (nameMessage) setNameError(nameMessage);
        if (keyMessage) setKeyError(keyMessage);
        if (!nameMessage && !keyMessage) {
          toast.error(isEditing ? 'Could not update field' : 'Could not create field', error.message);
        }
      } else {
        toast.error(isEditing ? 'Could not update field' : 'Could not create field', 'Something went wrong. Please try again.');
      }
    }
  }

  const formId = 'custom-field-editor-form';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? `Edit ${field.name}` : 'New custom field'}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={onClose} disabled={isSaving} />
          <ModalSaveAction form={formId} isLoading={isSaving} />
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Field name" htmlFor="field-name" error={nameError ?? undefined} required>
            <Input
              id="field-name"
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  key: current.keyTouched ? current.key : slugifyKey(name),
                }));
              }}
              invalid={Boolean(nameError)}
            />
          </Field>
          <Field label="Key" htmlFor="field-key" error={keyError ?? undefined} required>
            <Input
              id="field-key"
              value={form.key}
              onChange={(event) =>
                setForm((current) => ({ ...current, key: slugifyKey(event.target.value), keyTouched: true }))
              }
              invalid={Boolean(keyError)}
            />
          </Field>
        </div>

        <Field label="Type" htmlFor="field-type">
          <SelectMenu
            value={form.type}
            onChange={(value) => setForm((current) => ({ ...current, type: value as EmployeeCustomFieldType }))}
            options={FIELD_TYPES}
          />
        </Field>

        {usesOptions && (
          <Field label="Options">
            <OptionsEditor options={form.options} onChange={(options) => setForm((current) => ({ ...current, options }))} />
          </Field>
        )}

        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-sm text-strong">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border"
              checked={form.isRequired}
              onChange={(event) => setForm((current) => ({ ...current, isRequired: event.target.checked }))}
            />
            Required
          </label>
          <label className="flex items-center gap-2.5 text-sm text-strong">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border"
              checked={form.visibleToEmployee}
              onChange={(event) => setForm((current) => ({ ...current, visibleToEmployee: event.target.checked }))}
            />
            Visible to the employee on their own profile
          </label>
          <label className="flex items-center gap-2.5 text-sm text-strong">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border"
              checked={form.editableByEmployee}
              disabled={!form.visibleToEmployee}
              onChange={(event) => setForm((current) => ({ ...current, editableByEmployee: event.target.checked }))}
            />
            Employee can edit it themselves
          </label>
        </div>
      </form>
    </Modal>
  );
}

function CustomFieldsContent() {
  const fieldsQuery = useCustomFields();
  const toast = useToast();
  const [editorState, setEditorState] = useState<{ field: EmployeeCustomFieldDefinition | null; nonce: number } | null>(
    null,
  );

  const toggleActiveMutation = useSetCustomFieldActive();

  function openCreate() {
    setEditorState((current) => ({ field: null, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function openEdit(field: EmployeeCustomFieldDefinition) {
    setEditorState((current) => ({ field, nonce: (current?.nonce ?? 0) + 1 }));
  }

  async function toggleActive(field: EmployeeCustomFieldDefinition) {
    try {
      await toggleActiveMutation.mutateAsync({ fieldId: field.id, isActive: !field.is_active });
      toast.success(
        field.is_active ? 'Field deactivated' : 'Field activated',
        `${field.name} is now ${field.is_active ? 'inactive' : 'active'}.`,
      );
    } catch (error) {
      toast.error('Could not update field', error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  if (fieldsQuery.isLoading) return <LoadingState label="Loading custom fields..." fill />;
  if (fieldsQuery.isError) return <ErrorState error={fieldsQuery.error} onRetry={() => fieldsQuery.refetch()} />;

  const fields = fieldsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {fields.length} custom field{fields.length === 1 ? '' : 's'} defined for employee profiles.
        </p>
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          New field
        </Button>
      </div>

      {fields.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title="No custom fields yet"
          description="Add fields like pension number or T-shirt size to capture beyond the standard profile."
        />
      ) : (
        <Card>
          <DataTable
            columns={fieldColumns({ onEdit: openEdit, onToggleActive: toggleActive })}
            rows={fields}
            rowKey={(row) => row.id}
          />
        </Card>
      )}

      {editorState && (
        <CustomFieldEditorModal
          key={`${editorState.nonce}-${editorState.field?.id ?? 'new'}`}
          onClose={() => setEditorState(null)}
          field={editorState.field}
        />
      )}
    </div>
  );
}

export function CustomFieldsPage() {
  return (
    <div>
      <PageHeader
        title="Custom fields"
        subtitle="Capture information beyond the standard employee profile."
        breadcrumbs={[{ label: 'Control center', to: '/settings/control-center' }, { label: 'Custom fields' }]}
      />
      <RequirePermission permission="employees.view">
        <CustomFieldsContent />
      </RequirePermission>
    </div>
  );
}
