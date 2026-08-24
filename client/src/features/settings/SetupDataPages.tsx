import { Fragment, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  Pencil,
  Plus,
  Power,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction, ModalSendAction } from '@/components/ui/ModalActions';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useAuth } from '@/context/AuthContext';
import {
  useActOnApprovalRequest,
  useApprovalRequest,
  useApprovalRequests,
  useApprovalWorkflows,
  useCreateApprovalWorkflow,
  useUpdateApprovalWorkflow,
  type ApprovalDecisionAction,
  type ApprovalWorkflowPayload,
} from '@/features/approvals/api';
import { useEmployees } from '@/features/employees/api';
import { usePermissionCatalog, useRoles } from '@/features/settings/rolesApi';
import { useSetupLookups } from '@/features/workspace/api';
import { api, apiClient, ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { AllSetupLookups, ApprovalRequest, ApprovalWorkflow, ApproverType, ClusterLookup, LocationLookup, Paginated } from '@/types/api';

type Row = Record<string, unknown>;

interface PanelConfig {
  title: string;
  description?: string;
  endpoint: string;
  responseKey?: string;
  columns: Array<{ key: string; label: string }>;
  action?: ActionConfig;
  edit?: RowActionConfig;
  deactivate?: RowActionConfig;
  delete?: RowActionConfig;
}

type FieldType = 'text' | 'number' | 'date' | 'time' | 'email' | 'textarea' | 'checkbox' | 'select';

interface ActionField {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: string | number | boolean | null;
  options?: Array<{ label: string; value: string | number | boolean }>;
}

interface ActionConfig {
  label: string;
  endpoint: string;
  method?: 'post' | 'patch';
  successMessage: string;
  fields: ActionField[];
  invalidateKeys?: Array<unknown[]>;
}

interface RowActionConfig extends Omit<ActionConfig, 'endpoint'> {
  endpoint: (row: Row) => string;
}

function valueAt(row: Row, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Row)[part];
  }, row);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') {
    const record = value as Row;
    return String(record.name ?? record.label ?? record.title ?? record.code ?? '-');
  }
  return String(value);
}

function describeRow(row: Row): string {
  return formatValue(row.name ?? row.title ?? row.full_name ?? valueAt(row, 'employee.full_name') ?? row.code);
}

function rowsFromResponse(response: unknown, responseKey?: string): Row[] {
  if (Array.isArray(response)) return response as Row[];
  if (!response || typeof response !== 'object') return [];

  const record = response as Row;
  if (responseKey && Array.isArray(record[responseKey])) return record[responseKey] as Row[];
  if (responseKey && record[responseKey] && typeof record[responseKey] === 'object') {
    return [record[responseKey] as Row];
  }
  if (Array.isArray(record.data)) return record.data as Row[];

  const paginated = response as Paginated<Row>;
  if (Array.isArray(paginated.data)) return paginated.data;

  return [record];
}

function initialForm(fields: ActionField[]): Record<string, string | boolean> {
  return fields.reduce<Record<string, string | boolean>>((form, field) => {
    if (field.type === 'checkbox') {
      form[field.name] = Boolean(field.defaultValue);
    } else {
      form[field.name] = field.defaultValue == null ? '' : String(field.defaultValue);
    }
    return form;
  }, {});
}

function initialFormFromRow(fields: ActionField[], row: Row): Record<string, string | boolean> {
  return fields.reduce<Record<string, string | boolean>>((form, field) => {
    const value = valueAt(row, field.name);
    if (field.type === 'checkbox') {
      form[field.name] = Boolean(value ?? field.defaultValue);
    } else {
      form[field.name] = value == null ? (field.defaultValue == null ? '' : String(field.defaultValue)) : String(value);
    }
    return form;
  }, {});
}

function payloadFromForm(fields: ActionField[], form: Record<string, string | boolean>): Row {
  return fields.reduce<Row>((payload, field) => {
    const value = form[field.name];
    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value);
      return payload;
    }
    if (value === '') {
      payload[field.name] = null;
      return payload;
    }
    if (field.type === 'number') {
      payload[field.name] = Number(value);
      return payload;
    }
    payload[field.name] = value;
    return payload;
  }, {});
}

function ActionFields({
  fields,
  form,
  setForm,
}: {
  fields: ActionField[];
  form: Record<string, string | boolean>;
  setForm: (updater: (current: Record<string, string | boolean>) => Record<string, string | boolean>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <Field key={field.name} label={field.label}>
          {field.type === 'textarea' ? (
            <>
              <Textarea
                value={String(form[field.name] ?? '')}
                onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                required={field.required}
                placeholder={field.placeholder}
              />
              {field.help && <p className="mt-1 text-xs leading-5 text-muted">{field.help}</p>}
            </>
          ) : field.type === 'checkbox' ? (
            <>
              <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-strong">
                <input
                  type="checkbox"
                  checked={Boolean(form[field.name])}
                  onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))}
                />
                Enabled
              </label>
              {field.help && <p className="mt-1 text-xs leading-5 text-muted">{field.help}</p>}
            </>
          ) : field.type === 'select' ? (
            <>
              <SelectMenu
                value={String(form[field.name] ?? '')}
                onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
                options={[
                  ...(field.options?.some((option) => String(option.value) === '')
                    ? []
                    : [{ value: '', label: 'Select...' }]),
                  ...(field.options ?? []).map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  })),
                ]}
              />
              {field.help && <p className="mt-1 text-xs leading-5 text-muted">{field.help}</p>}
            </>
          ) : (
            <>
              <Input
                type={field.type ?? 'text'}
                value={String(form[field.name] ?? '')}
                onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                required={field.required}
                placeholder={field.placeholder}
              />
              {field.help && <p className="mt-1 text-xs leading-5 text-muted">{field.help}</p>}
            </>
          )}
        </Field>
      ))}
    </div>
  );
}

function ActionForm({
  action,
  onDone,
  initialValues,
}: {
  action: ActionConfig;
  onDone?: () => void;
  initialValues?: Record<string, string | boolean>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(() => initialValues ?? initialForm(action.fields));
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => {
      const body = payloadFromForm(action.fields, form);
      return action.method === 'patch' ? api.patch(action.endpoint, body) : api.post(action.endpoint, body);
    },
    onSuccess: () => {
      toast.success(action.successMessage);
      setForm(initialValues ?? initialForm(action.fields));
      setIsOpen(false);
      action.invalidateKeys?.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      onDone?.();
    },
    onError: (error) => {
      toast.error('Action failed', error instanceof ApiError ? error.message : 'Could not complete this action.');
    },
  });

  if (!isOpen) {
    return (
      <Button type="button" size="sm" variant="primary" onClick={() => setIsOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        {action.label}
      </Button>
    );
  }

  const formId = `action-${action.label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title={action.label}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={() => setIsOpen(false)} />
          <ModalSaveAction form={formId} isLoading={mutation.isPending} title="Save" />
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
          <p className="text-sm font-medium text-strong">Organization-scoped control</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Saved records stay inside this organization&apos;s workspace and become available to the relevant workflows.
          </p>
        </div>
        <ActionFields fields={action.fields} form={form} setForm={setForm} />
      </form>
    </Modal>
  );
}

function InlineRowAction({
  row,
  config,
  variant = 'edit',
  onDone,
}: {
  row: Row;
  config: RowActionConfig;
  variant?: 'edit' | 'deactivate' | 'delete';
  onDone?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(() => initialFormFromRow(config.fields, row));
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => {
      if (variant === 'delete') {
        return api.delete(config.endpoint(row));
      }
      return api.patch(
        config.endpoint(row),
        payloadFromForm(config.fields, variant === 'deactivate' ? initialForm(config.fields) : form),
      );
    },
    onSuccess: () => {
      toast.success(config.successMessage);
      config.invalidateKeys?.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      setIsOpen(false);
      onDone?.();
    },
    onError: (error) => {
      toast.error('Action failed', error instanceof ApiError ? error.message : 'Could not complete this action.');
    },
  });

  if (!isOpen && (variant === 'deactivate' || variant === 'delete')) {
    const label = variant === 'delete' ? 'Delete' : 'Deactivate';
    return (
      <Button type="button" size="sm" variant="danger" onClick={() => setIsOpen(true)} title={label} aria-label={label}>
        {variant === 'delete' ? <Trash2 className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)} title="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    );
  }

  if (variant === 'deactivate' || variant === 'delete') {
    const label = variant === 'delete' ? 'Delete' : 'Deactivate';
    return (
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={config.label}
        footer={
          <>
            <ModalCancelAction onClick={() => setIsOpen(false)} />
            <ModalConfirmAction
              title={label}
              variant="danger"
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate()}
              icon={variant === 'delete' ? Trash2 : Power}
            />
          </>
        }
      >
        <div className="rounded-md border border-danger-bg bg-danger-bg/40 p-4">
          <p className="text-sm font-semibold text-strong">{describeRow(row)}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {variant === 'delete'
              ? 'This permanently removes the record. This cannot be undone.'
              : 'For now this safely deactivates the record instead of hard deleting it, so historical employees, documents, attendance, and reports do not lose their references.'}
          </p>
        </div>
      </Modal>
    );
  }

  const formId = `row-action-${config.label.replace(/\s+/g, '-').toLowerCase()}-${String(row.id ?? 'record')}`;

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title={config.label}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={() => setIsOpen(false)} />
          <ModalSaveAction form={formId} isLoading={mutation.isPending} />
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
          <p className="text-sm font-medium text-strong">{describeRow(row)}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Update this record without leaving the control surface. Changes remain scoped to this organization.
          </p>
        </div>
        <ActionFields fields={config.fields} form={form} setForm={setForm} />
      </form>
    </Modal>
  );
}

function DataPanel({ config, extraActions }: { config: PanelConfig; extraActions?: ReactNode }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const query = useQuery({
    queryKey: ['control-panel', config.endpoint],
    queryFn: () => api.get<unknown>(config.endpoint),
  });

  if (query.isLoading) return <LoadingState label={`Loading ${config.title.toLowerCase()}...`} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const rows = rowsFromResponse(query.data, config.responseKey);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-start">
        <div>
          <CardTitle>{config.title}</CardTitle>
          {config.description && <p className="mt-1 max-w-xl text-xs leading-5 text-muted">{config.description}</p>}
        </div>
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted">
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardBody>
        {(config.action || extraActions) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {config.action && <ActionForm action={config.action} onDone={() => query.refetch()} />}
            {extraActions}
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState title="No records yet" description="This control area has no organization data yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  {config.columns.map((column) => (
                    <th key={column.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Fragment key={String(row.id ?? `${config.title}-${index}`)}>
                    <tr
                      className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-surface-soft"
                      onClick={() => setSelectedRow(row)}
                    >
                      {config.columns.map((column) => (
                        <td key={column.key} className="max-w-[260px] whitespace-nowrap px-3 py-2 text-strong">
                          <span className="block truncate">{formatValue(valueAt(row, column.key))}</span>
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <RecordDetailModal
          title={config.title}
          row={selectedRow}
          columns={config.columns}
          edit={config.edit}
          deactivate={config.deactivate}
          deleteAction={config.delete}
          onClose={() => setSelectedRow(null)}
          onDone={() => query.refetch()}
        />
      </CardBody>
    </Card>
  );
}

function RecordDetailModal({
  title,
  row,
  columns,
  edit,
  deactivate,
  deleteAction,
  onClose,
  onDone,
}: {
  title: string;
  row: Row | null;
  columns: Array<{ key: string; label: string }>;
  edit?: RowActionConfig;
  deactivate?: RowActionConfig;
  deleteAction?: RowActionConfig;
  onClose: () => void;
  onDone?: () => void;
}) {
  if (!row) return null;

  const heading = describeRow(row) === '-' ? title : describeRow(row);

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title={heading}
      size="lg"
      footer={
        <>
          {edit && <InlineRowAction row={row} config={edit} onDone={onDone} />}
          {deactivate && <InlineRowAction row={row} config={deactivate} variant="deactivate" onDone={onDone} />}
          {deleteAction && (
            <InlineRowAction
              row={row}
              config={deleteAction}
              variant="delete"
              onDone={() => {
                onDone?.();
                onClose();
              }}
            />
          )}
        </>
      }
    >
      <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
        <p className="text-sm font-medium text-strong">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          Review the record first. Editing and deletion controls are kept here so the table stays clean.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {columns.map((column) => (
          <div key={column.key} className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{column.label}</p>
            <p className="mt-1 text-sm font-medium text-strong">{formatValue(valueAt(row, column.key))}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function AreaShell({
  title,
  subtitle,
  permission,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  permission: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[
          { label: 'Control center', to: '/settings/control-center' },
          { label: title },
        ]}
        actions={actions}
      />
      <RequirePermission permission={permission}>{children}</RequirePermission>
    </div>
  );
}

function ControlNote({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border-strong bg-surface">
      <CardBody className="flex items-start gap-3">
        <div className="rounded-md bg-teal-light p-2 text-teal">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-strong">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function LookupPanel({
  title,
  rows,
  columns,
  action,
  edit,
  deactivate,
}: {
  title: string;
  rows: Row[];
  columns: Array<{ key: string; label: string }>;
  action?: ActionConfig;
  edit?: RowActionConfig;
  deactivate?: RowActionConfig;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-start">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs leading-5 text-muted">Configured for this workspace only.</p>
        </div>
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted">
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardBody>
        {action && <ActionForm action={action} />}
        {rows.length === 0 ? (
          <EmptyState title="No records yet" description="This structure list is empty for this organization." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  {columns.map((column) => (
                    <th key={column.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Fragment key={String(row.id ?? `${title}-${index}`)}>
                    <tr
                      className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-surface-soft"
                      onClick={() => setSelectedRow(row)}
                    >
                      {columns.map((column) => (
                        <td key={column.key} className="max-w-[260px] whitespace-nowrap px-3 py-2 text-strong">
                          <span className="block truncate">{formatValue(valueAt(row, column.key))}</span>
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <RecordDetailModal
          title={title}
          row={selectedRow}
          columns={columns}
          edit={edit}
          deactivate={deactivate}
          onClose={() => setSelectedRow(null)}
        />
      </CardBody>
    </Card>
  );
}

function ClusterFormModal({
  cluster,
  departmentOptions,
  locations,
  onClose,
  onSaved,
}: {
  cluster: ClusterLookup | 'new' | null;
  departmentOptions: SelectMenuOption[];
  locations: LocationLookup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = cluster === 'new';
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [locationIds, setLocationIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (cluster && cluster !== 'new') {
      setName(cluster.name);
      setCode(cluster.code ?? '');
      setDepartmentId(String(cluster.department_id));
      setDescription(cluster.description ?? '');
      setLocationIds((cluster.locations ?? []).map((location) => location.id));
    } else if (cluster === 'new') {
      setName('');
      setCode('');
      setDepartmentId('');
      setDescription('');
      setLocationIds([]);
    }
  }, [cluster]);

  function toggleLocation(id: number) {
    setLocationIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function handleSubmit() {
    setIsSaving(true);
    try {
      const payload = {
        name,
        code,
        department_id: departmentId ? Number(departmentId) : null,
        description: description || null,
        location_ids: locationIds,
      };

      if (isNew) {
        await api.post('/setup/clusters', payload);
      } else if (cluster) {
        await api.patch(`/setup/clusters/${cluster.id}`, payload);
      }

      toast.success(isNew ? 'Cluster created' : 'Cluster updated', `${name} now covers ${locationIds.length} location${locationIds.length === 1 ? '' : 's'}.`);
      onSaved();
      onClose();
    } catch (error) {
      toast.error('Could not save cluster', error instanceof ApiError ? error.message : 'Please check the form and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={cluster !== null}
      onClose={onClose}
      title={isNew ? 'Create cluster' : 'Edit cluster'}
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalSaveAction title="Save cluster" isLoading={isSaving} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Lagos Cluster" />
        </Field>
        <Field label="Code">
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. LAG-CLU" />
        </Field>
        <Field label="Department" hint="The cluster's approvals and reporting roll up to this department.">
          <SelectMenu value={departmentId} onChange={setDepartmentId} options={departmentOptions} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Locations in this cluster</p>
          {locations.length === 0 ? (
            <p className="text-sm text-muted">No locations set up yet.</p>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              {locations.map((location) => {
                const checked = locationIds.includes(location.id);
                return (
                  <label
                    key={location.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                      checked ? 'bg-teal/5 text-strong' : 'text-muted hover:bg-surface-soft',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLocation(location.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    {location.name}
                    {location.is_primary && <Star className="h-3 w-3 fill-current text-warning" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ClustersPanel({
  clusters,
  departmentOptions,
  locations,
  onChanged,
}: {
  clusters: ClusterLookup[];
  departmentOptions: SelectMenuOption[];
  locations: LocationLookup[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<ClusterLookup | 'new' | null>(null);

  async function handleDeactivate(cluster: ClusterLookup) {
    try {
      await api.patch(`/setup/clusters/${cluster.id}`, { is_active: false });
      toast.success('Cluster deactivated', `${cluster.name} is no longer active.`);
      onChanged();
    } catch (error) {
      toast.error('Could not deactivate cluster', error instanceof ApiError ? error.message : 'Please try again.');
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-start">
        <div>
          <CardTitle>Clusters</CardTitle>
          <p className="mt-1 text-xs leading-5 text-muted">Groups of locations that roll up to one department.</p>
        </div>
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted">
          {clusters.length} record{clusters.length === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardBody>
        <Button type="button" size="sm" onClick={() => setEditing('new')} disabled={departmentOptions.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Add cluster
        </Button>
        {clusters.length === 0 ? (
          <EmptyState
            title="No clusters yet"
            description="Create a cluster to group locations under a department for regional reporting and approvals."
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Name</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Department</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Locations</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {clusters.map((cluster) => (
                  <tr key={cluster.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2 text-strong">{cluster.name}</td>
                    <td className="px-3 py-2 text-muted">{cluster.department?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">
                      {cluster.locations && cluster.locations.length > 0
                        ? cluster.locations.map((location) => location.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button type="button" size="sm" onClick={() => setEditing(cluster)} title="Edit" aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeactivate(cluster)}
                          title="Deactivate"
                          aria-label="Deactivate"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
      <ClusterFormModal
        cluster={editing}
        departmentOptions={departmentOptions}
        locations={locations}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </Card>
  );
}

export function StructureSettingsPage() {
  const lookupsQuery = useSetupLookups();
  const lookups = lookupsQuery.data;
  const departmentOptions = useMemo(
    () => lookups?.departments.map((department) => ({ label: department.name, value: String(department.id) })) ?? [],
    [lookups?.departments],
  );
  const invalidateLookups = [['setup', 'lookups']];
  const simpleFields: ActionField[] = [
    { name: 'name', label: 'Name', required: true },
    { name: 'code', label: 'Code', required: true },
    { name: 'description', label: 'Description' },
    { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
  ];

  return (
    <AreaShell
      title="Organization structure"
      subtitle="Control the company-owned building blocks used by employees, dashboards, leave, attendance, and reports."
      permission="workspace_settings.view"
    >
      {lookupsQuery.isLoading && <LoadingState label="Loading organization structure..." fill />}
      {lookupsQuery.isError && <ErrorState error={lookupsQuery.error} onRetry={() => lookupsQuery.refetch()} />}
      {lookups && (
        <div className="flex flex-col gap-5">
          <ControlNote
            icon={Building2}
            title="Structure is the source of truth"
            description="Departments, locations, roles, and employment categories drive onboarding, reporting lines, dashboards, leave rules, document requirements, and exports."
          />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <LookupPanel
              title="Locations"
              rows={(lookupsQuery.data as AllSetupLookups).locations as unknown as Row[]}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                { key: 'city', label: 'City' },
                { key: 'is_primary', label: 'Primary' },
              ]}
              action={{
                label: 'Add location',
                endpoint: '/setup/locations',
                successMessage: 'Location created',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  {
                    name: 'type',
                    label: 'Type',
                    type: 'select',
                    defaultValue: 'branch',
                    options: [
                      { label: 'Head office', value: 'head_office' },
                      { label: 'Branch', value: 'branch' },
                      { label: 'Remote', value: 'remote' },
                      { label: 'Field', value: 'field' },
                      { label: 'Warehouse', value: 'warehouse' },
                    ],
                  },
                  { name: 'city', label: 'City' },
                  { name: 'state', label: 'State' },
                  { name: 'country', label: 'Country' },
                  { name: 'address', label: 'Address', type: 'textarea' },
                  { name: 'is_primary', label: 'Primary location', type: 'checkbox' },
                ],
              }}
              edit={{
                label: 'Edit location',
                endpoint: (row) => `/setup/locations/${row.id}`,
                method: 'patch',
                successMessage: 'Location updated',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'city', label: 'City' },
                  { name: 'state', label: 'State' },
                  { name: 'country', label: 'Country' },
                  { name: 'is_primary', label: 'Primary', type: 'checkbox' },
                  { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
                ],
              }}
              deactivate={{
                label: 'Deactivate location',
                endpoint: (row) => `/setup/locations/${row.id}`,
                method: 'patch',
                successMessage: 'Location deactivated',
                invalidateKeys: invalidateLookups,
                fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
              }}
            />
            <LookupPanel
              title="Departments"
              rows={(lookupsQuery.data as AllSetupLookups).departments as unknown as Row[]}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                { key: 'description', label: 'Description' },
              ]}
              action={{
                label: 'Add department',
                endpoint: '/setup/departments',
                successMessage: 'Department created',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'parent_id', label: 'Parent department', type: 'select', options: departmentOptions },
                  { name: 'description', label: 'Description', type: 'textarea' },
                ],
              }}
              edit={{
                label: 'Edit department',
                endpoint: (row) => `/setup/departments/${row.id}`,
                method: 'patch',
                successMessage: 'Department updated',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'parent_id', label: 'Parent department', type: 'select', options: departmentOptions },
                  { name: 'description', label: 'Description' },
                  { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
                ],
              }}
              deactivate={{
                label: 'Deactivate department',
                endpoint: (row) => `/setup/departments/${row.id}`,
                method: 'patch',
                successMessage: 'Department deactivated',
                invalidateKeys: invalidateLookups,
                fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
              }}
            />
            <LookupPanel
              title="Units"
              rows={(lookupsQuery.data as AllSetupLookups).units as unknown as Row[]}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'department.name', label: 'Department' },
                { key: 'code', label: 'Code' },
              ]}
              action={{
                label: 'Add unit',
                endpoint: '/setup/units',
                successMessage: 'Unit created',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'department_id', label: 'Department', type: 'select', required: true, options: departmentOptions },
                  { name: 'description', label: 'Description', type: 'textarea' },
                ],
              }}
              edit={{
                label: 'Edit unit',
                endpoint: (row) => `/setup/units/${row.id}`,
                method: 'patch',
                successMessage: 'Unit updated',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'department_id', label: 'Department', type: 'select', required: true, options: departmentOptions },
                  { name: 'description', label: 'Description' },
                  { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
                ],
              }}
              deactivate={{
                label: 'Deactivate unit',
                endpoint: (row) => `/setup/units/${row.id}`,
                method: 'patch',
                successMessage: 'Unit deactivated',
                invalidateKeys: invalidateLookups,
                fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
              }}
            />
            <LookupPanel
              title="Designations"
              rows={(lookupsQuery.data as AllSetupLookups).designations as unknown as Row[]}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                { key: 'description', label: 'Description' },
              ]}
              action={{
                label: 'Add designation',
                endpoint: '/setup/designations',
                successMessage: 'Designation created',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'description', label: 'Description', type: 'textarea' },
                ],
              }}
              edit={{
                label: 'Edit designation',
                endpoint: (row) => `/setup/designations/${row.id}`,
                method: 'patch',
                successMessage: 'Designation updated',
                invalidateKeys: invalidateLookups,
                fields: simpleFields,
              }}
              deactivate={{
                label: 'Deactivate designation',
                endpoint: (row) => `/setup/designations/${row.id}`,
                method: 'patch',
                successMessage: 'Designation deactivated',
                invalidateKeys: invalidateLookups,
                fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
              }}
            />
            <LookupPanel
              title="Grade levels"
              rows={(lookupsQuery.data as AllSetupLookups).grade_levels as unknown as Row[]}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                { key: 'rank', label: 'Rank' },
              ]}
              action={{
                label: 'Add grade level',
                endpoint: '/setup/grade-levels',
                successMessage: 'Grade level created',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'rank', label: 'Rank', type: 'number', defaultValue: 0 },
                  { name: 'description', label: 'Description', type: 'textarea' },
                ],
              }}
              edit={{
                label: 'Edit grade level',
                endpoint: (row) => `/setup/grade-levels/${row.id}`,
                method: 'patch',
                successMessage: 'Grade level updated',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'rank', label: 'Rank', type: 'number', defaultValue: 0 },
                  { name: 'description', label: 'Description' },
                  { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
                ],
              }}
              deactivate={{
                label: 'Deactivate grade level',
                endpoint: (row) => `/setup/grade-levels/${row.id}`,
                method: 'patch',
                successMessage: 'Grade level deactivated',
                invalidateKeys: invalidateLookups,
                fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
              }}
            />
            <LookupPanel
              title="Employment types"
              rows={(lookupsQuery.data as AllSetupLookups).employment_types as unknown as Row[]}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                { key: 'description', label: 'Description' },
              ]}
              action={{
                label: 'Add employment type',
                endpoint: '/setup/employment-types',
                successMessage: 'Employment type created',
                invalidateKeys: invalidateLookups,
                fields: [
                  { name: 'name', label: 'Name', required: true },
                  { name: 'code', label: 'Code', required: true },
                  { name: 'description', label: 'Description', type: 'textarea' },
                ],
              }}
              edit={{
                label: 'Edit employment type',
                endpoint: (row) => `/setup/employment-types/${row.id}`,
                method: 'patch',
                successMessage: 'Employment type updated',
                invalidateKeys: invalidateLookups,
                fields: simpleFields,
              }}
              deactivate={{
                label: 'Deactivate employment type',
                endpoint: (row) => `/setup/employment-types/${row.id}`,
                method: 'patch',
                successMessage: 'Employment type deactivated',
                invalidateKeys: invalidateLookups,
                fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
              }}
            />
            <ClustersPanel
              clusters={(lookupsQuery.data as AllSetupLookups).clusters}
              departmentOptions={departmentOptions}
              locations={(lookupsQuery.data as AllSetupLookups).locations}
              onChanged={() => lookupsQuery.refetch()}
            />
          </div>
        </div>
      )}
    </AreaShell>
  );
}

export function DocumentsControlPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const documentTypesQuery = useQuery({
    queryKey: ['document-type-options'],
    queryFn: () => api.get<unknown>('/documents/types?per_page=100'),
  });
  const requirementsQuery = useQuery({
    queryKey: ['documents', 'requirements', 'summary'],
    queryFn: () => api.get<unknown>('/documents/requirements?per_page=100'),
  });
  const documentsQuery = useQuery({
    queryKey: ['documents', 'submissions', 'latest'],
    queryFn: () => api.get<unknown>('/documents?per_page=8'),
  });
  const complianceQuery = useQuery({
    queryKey: ['documents', 'compliance'],
    queryFn: () => api.get<Row>('/documents/compliance'),
  });
  const lookupsQuery = useSetupLookups();

  const documentTypeOptions = useMemo(
    () =>
      rowsFromResponse(documentTypesQuery.data).map((type) => ({
        label: `${formatValue(type.name)}${type.code ? ` (${formatValue(type.code)})` : ''}`,
        value: String(type.id),
      })),
    [documentTypesQuery.data],
  );

  const departmentOptions = useMemo(
    () => [
      { label: 'All departments', value: '' },
      ...((lookupsQuery.data?.departments ?? []).map((department) => ({
        label: department.name,
        value: String(department.id),
      }))),
    ],
    [lookupsQuery.data?.departments],
  );

  const requirementFields: ActionField[] = [
    { name: 'name', label: 'Name', required: true },
    {
      name: 'document_type_id',
      label: 'Document type',
      type: 'select',
      required: true,
      options: documentTypeOptions,
      help: 'The document catalogue item this requirement is based on.',
    },
    { name: 'description', label: 'Description', type: 'textarea' },
    {
      name: 'department_id',
      label: 'Department',
      type: 'select',
      options: departmentOptions,
      help: 'Leave as All departments when the rule applies to everyone.',
    },
    { name: 'is_required', label: 'Required', type: 'checkbox', defaultValue: true, help: 'Required documents appear as compliance expectations.' },
    {
      name: 'employee_upload_allowed',
      label: 'Employee upload allowed',
      type: 'checkbox',
      defaultValue: true,
      help: 'Allows employees to upload this requirement from self-service. HR can still upload when this is off.',
    },
    {
      name: 'approval_required',
      label: 'Approval required',
      type: 'checkbox',
      help: 'Submitted documents enter the approval/review workflow instead of becoming approved immediately.',
    },
    { name: 'reminder_days', label: 'Reminder days', type: 'number', defaultValue: 30 },
    { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true, help: 'Inactive requirements stop applying to new compliance checks without deleting history.' },
  ];

  const documentTypeRows = rowsFromResponse(documentTypesQuery.data);
  const requirementRows = rowsFromResponse(requirementsQuery.data);
  const documentRows = rowsFromResponse(documentsQuery.data);
  const complianceSummary = (complianceQuery.data?.summary ?? {}) as Record<string, number>;
  const complianceRows = Array.isArray(complianceQuery.data?.data) ? (complianceQuery.data.data as Row[]) : [];
  const pendingDocuments = documentRows.filter((document) => ['submitted', 'pending', 'changes_requested'].includes(String(document.status))).length;
  const activeTypes = documentTypeRows.filter((type) => Boolean(type.is_active)).length;
  const activeRequirements = requirementRows.filter((requirement) => Boolean(requirement.is_active)).length;
  const criticalCompliance = complianceRows.filter((row) => ['missing', 'expired', 'changes_requested', 'rejected'].includes(String(row.state)));

  const settingsPanels = (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <DataPanel
        config={{
          title: 'Document types',
          description: 'The document catalogue HR can request, track, and review.',
          endpoint: '/documents/types',
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'is_active', label: 'Active' },
          ],
          action: {
            label: 'Add document type',
            endpoint: '/documents/types',
            successMessage: 'Document type created',
            invalidateKeys: [['control-panel', '/documents/types'], ['document-type-options']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'code', label: 'Code', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              {
                name: 'requires_expiry_date',
                label: 'Requires expiry date',
                type: 'checkbox',
                help: 'Employees and HR must provide an expiry date when uploading this document type.',
              },
              {
                name: 'employee_upload_allowed',
                label: 'Employee upload allowed',
                type: 'checkbox',
                defaultValue: true,
                help: 'Employees can upload this document themselves. HR can still upload when this is off.',
              },
              {
                name: 'approval_required',
                label: 'Approval required',
                type: 'checkbox',
                help: 'Uploads enter the approval/review workflow before becoming approved.',
              },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          edit: {
            label: 'Edit document type',
            endpoint: (row) => `/documents/types/${row.id}`,
            method: 'patch',
            successMessage: 'Document type updated',
            invalidateKeys: [['control-panel', '/documents/types'], ['document-type-options']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'code', label: 'Code', required: true },
              { name: 'description', label: 'Description' },
              {
                name: 'requires_expiry_date',
                label: 'Requires expiry date',
                type: 'checkbox',
                help: 'Employees and HR must provide an expiry date when uploading this document type.',
              },
              {
                name: 'employee_upload_allowed',
                label: 'Employee upload allowed',
                type: 'checkbox',
                defaultValue: true,
                help: 'Employees can upload this document themselves. HR can still upload when this is off.',
              },
              {
                name: 'approval_required',
                label: 'Approval required',
                type: 'checkbox',
                help: 'Uploads enter the approval/review workflow before becoming approved.',
              },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true, help: 'Inactive document types are hidden from new usage without deleting history.' },
            ],
          },
          deactivate: {
            label: 'Deactivate document type',
            endpoint: (row) => `/documents/types/${row.id}`,
            method: 'patch',
            successMessage: 'Document type deactivated',
            invalidateKeys: [['control-panel', '/documents/types'], ['document-type-options']],
            fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
          },
        }}
      />
      <DataPanel
        config={{
          title: 'Document requirements',
          description: 'Rules that decide who must submit what, and when approval is needed.',
          endpoint: '/documents/requirements',
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'document_type.name', label: 'Type' },
            { key: 'department.name', label: 'Department' },
            { key: 'is_required', label: 'Required' },
          ],
          action: {
            label: 'Add requirement',
            endpoint: '/documents/requirements',
            successMessage: 'Document requirement created',
            invalidateKeys: [['control-panel', '/documents/requirements'], ['documents', 'requirements', 'summary'], ['documents', 'compliance']],
            fields: requirementFields,
          },
          edit: {
            label: 'Edit requirement',
            endpoint: (row) => `/documents/requirements/${row.id}`,
            method: 'patch',
            successMessage: 'Document requirement updated',
            invalidateKeys: [['control-panel', '/documents/requirements'], ['documents', 'requirements', 'summary'], ['documents', 'compliance']],
            fields: requirementFields,
          },
          deactivate: {
            label: 'Deactivate requirement',
            endpoint: (row) => `/documents/requirements/${row.id}`,
            method: 'patch',
            successMessage: 'Document requirement deactivated',
            invalidateKeys: [['control-panel', '/documents/requirements'], ['documents', 'requirements', 'summary'], ['documents', 'compliance']],
            fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
          },
        }}
      />
    </div>
  );

  return (
    <AreaShell
      title="Documents and compliance"
      subtitle="Monitor document readiness, submissions, expiry risks, and compliance evidence."
      permission="employee_documents.view"
      actions={
        <Button type="button" size="icon" onClick={() => setSettingsOpen(true)} title="Document settings" aria-label="Document settings">
          <Settings className="h-4 w-4" />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Document types" value={`${activeTypes}/${documentTypeRows.length}`} icon={FileText} />
        <StatTile label="Active requirements" value={`${activeRequirements}/${requirementRows.length}`} icon={ClipboardCheck} />
        <StatTile label="Pending review" value={pendingDocuments} icon={FileClock} tone={pendingDocuments ? 'warning' : 'success'} />
        <StatTile label="Compliance gaps" value={criticalCompliance.length} icon={ShieldCheck} tone={criticalCompliance.length ? 'danger' : 'success'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compliance health</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {complianceQuery.isLoading ? (
              <LoadingState label="Loading compliance..." />
            ) : complianceQuery.isError ? (
              <ErrorState error={complianceQuery.error} onRetry={() => complianceQuery.refetch()} />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Employees checked', complianceSummary.employees_checked ?? 0],
                    ['Rules checked', complianceSummary.requirements_checked ?? 0],
                    ['Approved', complianceSummary.approved ?? 0],
                    ['Submitted', complianceSummary.submitted ?? 0],
                    ['Missing', complianceSummary.missing ?? 0],
                    ['Expiring soon', complianceSummary.expiring_soon ?? 0],
                    ['Expired', complianceSummary.expired ?? 0],
                    ['Rejected', complianceSummary.rejected ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border border-border bg-surface-soft px-3 py-2">
                      <p className="text-xs text-muted">{label}</p>
                      <p className="mt-1 text-lg font-semibold text-strong">{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Needs attention</p>
                  {criticalCompliance.length === 0 ? (
                    <EmptyState title="No critical compliance gaps" description="Missing, expired, rejected, and change-requested items are clear." />
                  ) : (
                    <div className="space-y-2">
                      {criticalCompliance.slice(0, 5).map((row, index) => (
                        <div key={`${formatValue(valueAt(row, 'employee.id'))}-${formatValue(valueAt(row, 'requirement.id'))}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-strong">{formatValue(valueAt(row, 'employee.full_name'))}</p>
                            <p className="truncate text-xs text-muted">{formatValue(valueAt(row, 'requirement.name'))}</p>
                          </div>
                          <StatusBadge status={String(row.state)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent employee documents</CardTitle>
            <FileCheck2 className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {documentsQuery.isLoading ? (
              <LoadingState label="Loading documents..." />
            ) : documentsQuery.isError ? (
              <ErrorState error={documentsQuery.error} onRetry={() => documentsQuery.refetch()} />
            ) : documentRows.length === 0 ? (
              <EmptyState title="No document submissions yet" description="Employee uploads and HR-managed submissions will appear here." />
            ) : (
              <div className="divide-y divide-border">
                {documentRows.map((document) => (
                  <div key={String(document.id)} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(document.title)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {formatValue(valueAt(document, 'employee.full_name'))} - {formatValue(valueAt(document, 'document_type.name'))}
                      </p>
                    </div>
                    <StatusBadge status={String(document.status)} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Document catalogue</CardTitle>
            <FileText className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {documentTypesQuery.isLoading ? (
              <LoadingState label="Loading document types..." />
            ) : documentTypesQuery.isError ? (
              <ErrorState error={documentTypesQuery.error} onRetry={() => documentTypesQuery.refetch()} />
            ) : documentTypeRows.length === 0 ? (
              <EmptyState title="No document types configured" description="Open settings to add the first document type." />
            ) : (
              <div className="space-y-2">
                {documentTypeRows.slice(0, 8).map((type) => (
                  <div key={String(type.id)} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(type.name)}</p>
                      <p className="text-xs text-muted">{formatValue(type.code)}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {Boolean(type.requires_expiry_date) && <StatusBadge status="expires" />}
                      {Boolean(type.approval_required) && <StatusBadge status="submitted" />}
                      <StatusBadge status={Boolean(type.is_active) ? 'active' : 'suspended'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requirement coverage</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {requirementsQuery.isLoading ? (
              <LoadingState label="Loading requirements..." />
            ) : requirementsQuery.isError ? (
              <ErrorState error={requirementsQuery.error} onRetry={() => requirementsQuery.refetch()} />
            ) : requirementRows.length === 0 ? (
              <EmptyState title="No requirements configured" description="Open settings to define required documents by department or role." />
            ) : (
              <div className="space-y-2">
                {requirementRows.slice(0, 8).map((requirement) => (
                  <div key={String(requirement.id)} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(requirement.name)}</p>
                      <p className="truncate text-xs text-muted">
                        {formatValue(valueAt(requirement, 'document_type.name'))} - {formatValue(valueAt(requirement, 'department.name')) === '-' ? 'All departments' : formatValue(valueAt(requirement, 'department.name'))}
                      </p>
                    </div>
                    <StatusBadge status={Boolean(requirement.is_active) ? 'active' : 'suspended'} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Document settings" size="lg">
        <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
          <p className="text-sm font-semibold text-strong">Configuration lives here</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Create and maintain document types and requirements without turning the main compliance page into a settings screen.
          </p>
        </div>
        {settingsPanels}
      </Modal>
    </AreaShell>
  );
}

function formatSnakeCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const DECISION_OPTIONS: { value: ApprovalDecisionAction; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'request_changes', label: 'Request changes' },
];

function ActOnApprovalModal({ request, onClose }: { request: ApprovalRequest | null; onClose: () => void }) {
  const toast = useToast();
  const [decisionAction, setDecisionAction] = useState<ApprovalDecisionAction>('approve');
  const [note, setNote] = useState('');
  const actMutation = useActOnApprovalRequest(request?.id ?? 0);
  const isPending = request?.status === 'pending';

  useEffect(() => {
    if (request) {
      setDecisionAction('approve');
      setNote('');
    }
  }, [request]);

  async function handleSubmit() {
    try {
      await actMutation.mutateAsync({ action: decisionAction, note: note.trim() || undefined });
      toast.success('Decision recorded', `The request has been ${decisionAction === 'approve' ? 'approved' : decisionAction === 'reject' ? 'rejected' : 'sent back for changes'}.`);
      onClose();
    } catch (error) {
      toast.error('Could not record decision', error instanceof ApiError ? error.message : 'Could not record this decision.');
    }
  }

  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      title={isPending ? 'Review approval request' : 'Approval request'}
      footer={
        isPending ? (
          <>
            <ModalCancelAction onClick={onClose} />
            <ModalSendAction title="Record decision" isLoading={actMutation.isPending} onClick={handleSubmit} />
          </>
        ) : (
          <ModalCancelAction title="Close" onClick={onClose} />
        )
      }
    >
      {request && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-strong">{request.title}</p>
              <p className="text-xs text-muted">
                {formatSnakeCase(request.module)} · {formatSnakeCase(request.action)} · Requested by {request.requester?.name ?? 'System'}
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          {isPending ? (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">Decision</span>
                <SelectMenu
                  value={decisionAction}
                  onChange={(value) => setDecisionAction(value as ApprovalDecisionAction)}
                  options={DECISION_OPTIONS}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted">Note</span>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional — some workflows require a note when rejecting or requesting changes."
                />
              </label>
            </>
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Decision history</p>
              {request.decisions && request.decisions.length > 0 ? (
                <ul className="space-y-2">
                  {request.decisions.map((decision) => (
                    <li key={decision.id} className="rounded-md border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-strong">{decision.actor?.name ?? 'System'}</span>
                        <span className="text-xs text-muted">{new Date(decision.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatSnakeCase(decision.action)} → {formatSnakeCase(decision.next_status)}
                      </p>
                      {decision.note && <p className="mt-1 text-xs text-strong">"{decision.note}"</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No decisions recorded yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ApprovalRequestsPanel({ openRequestId, onOpenRequestHandled }: { openRequestId?: number; onOpenRequestHandled?: () => void }) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('pending');
  const requestsQuery = useApprovalRequests({ status: statusFilter || undefined, per_page: 50 });
  const [actingOn, setActingOn] = useState<ApprovalRequest | null>(null);
  const requests = requestsQuery.data?.data ?? [];
  const deepLinkedRequest = useApprovalRequest(openRequestId);

  useEffect(() => {
    if (deepLinkedRequest.data) {
      setActingOn(deepLinkedRequest.data);
      onOpenRequestHandled?.();
    } else if (deepLinkedRequest.isError) {
      toast.error('Approval request not found', 'It may have been removed, or you no longer have access to it.');
      onOpenRequestHandled?.();
    }
  }, [deepLinkedRequest.data, deepLinkedRequest.isError, onOpenRequestHandled, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval requests</CardTitle>
        <SelectMenu
          className="w-40"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'changes_requested', label: 'Changes requested' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </CardHeader>
      <CardBody className="p-0">
        {requestsQuery.isLoading && <LoadingState label="Loading approval requests..." />}
        {requestsQuery.isError && <ErrorState error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />}
        {requestsQuery.data && requests.length === 0 && (
          <EmptyState title="No approval requests" description="Requests routed through your configured workflows will appear here." />
        )}
        {requests.length > 0 && (
          <ul className="divide-y divide-border">
            {requests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-strong">{request.title}</p>
                  <p className="text-xs text-muted">
                    {formatSnakeCase(request.module)} · {formatSnakeCase(request.action)} · {request.requester?.name ?? 'System'}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <StatusBadge status={request.status} />
                  {request.status === 'pending' && (
                    <Button type="button" size="sm" onClick={() => setActingOn(request)}>
                      Review
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <ActOnApprovalModal request={actingOn} onClose={() => setActingOn(null)} />
    </Card>
  );
}

/** (module, action) pairs are what a real submission is routed by — these three are the only ones the app ever submits against. */
const WORKFLOW_TARGET_OPTIONS: Array<{ value: string; label: string; module: string; action: string }> = [
  { value: 'leave.submit', label: 'Leave requests', module: 'leave', action: 'submit' },
  { value: 'employee_documents.submit', label: 'Employee documents', module: 'employee_documents', action: 'submit' },
  { value: 'attendance.correction', label: 'Attendance corrections', module: 'attendance', action: 'correction' },
];

const APPROVER_TYPE_OPTIONS: Array<{ value: ApproverType; label: string }> = [
  { value: 'direct_manager', label: "Employee's direct manager" },
  { value: 'department_head', label: "Employee's department head" },
  { value: 'role', label: 'Anyone with a specific role' },
  { value: 'permission', label: 'Anyone with a specific permission' },
];

interface StepDraft {
  key: string;
  name: string;
  approver_type: ApproverType;
  approver_role_id: number | null;
  approver_permission: string;
  note_required: boolean;
}

let stepDraftSeq = 0;
function emptyStep(order: number): StepDraft {
  stepDraftSeq += 1;
  return {
    key: `new-${stepDraftSeq}`,
    name: `Step ${order}`,
    approver_type: 'direct_manager',
    approver_role_id: null,
    approver_permission: '',
    note_required: false,
  };
}

function WorkflowFormModal({ workflow, onClose }: { workflow: ApprovalWorkflow | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const isNew = workflow === 'new';
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissionCatalog();
  const createMutation = useCreateApprovalWorkflow();
  const updateMutation = useUpdateApprovalWorkflow(workflow && workflow !== 'new' ? workflow.id : 0);

  const [target, setTarget] = useState(WORKFLOW_TARGET_OPTIONS[0].value);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [requireNoteOnReject, setRequireNoteOnReject] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([]);

  useEffect(() => {
    if (workflow && workflow !== 'new') {
      const matchedTarget = WORKFLOW_TARGET_OPTIONS.find((option) => option.module === workflow.module && option.action === workflow.action);
      setTarget(matchedTarget?.value ?? WORKFLOW_TARGET_OPTIONS[0].value);
      setName(workflow.name);
      setDescription(workflow.description ?? '');
      setIsActive(workflow.is_active);
      setRequireNoteOnReject(workflow.require_note_on_reject);
      setSteps(
        [...workflow.steps]
          .sort((a, b) => a.step_order - b.step_order)
          .map((step) => ({
            key: `existing-${step.id}`,
            name: step.name,
            approver_type: step.approver_type,
            approver_role_id: step.approver_role_id,
            approver_permission: step.approver_permission ?? '',
            note_required: step.note_required,
          })),
      );
    } else if (workflow === 'new') {
      setTarget(WORKFLOW_TARGET_OPTIONS[0].value);
      setName('');
      setDescription('');
      setIsActive(true);
      setRequireNoteOnReject(true);
      setSteps([emptyStep(1)]);
    }
  }, [workflow]);

  function addStep() {
    setSteps((current) => [...current, emptyStep(current.length + 1)]);
  }
  function removeStep(key: string) {
    setSteps((current) => current.filter((step) => step.key !== key));
  }
  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }
  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  }

  async function handleSubmit() {
    const targetOption = WORKFLOW_TARGET_OPTIONS.find((option) => option.value === target) ?? WORKFLOW_TARGET_OPTIONS[0];
    const payload: ApprovalWorkflowPayload = {
      module: targetOption.module,
      action: targetOption.action,
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: isActive,
      require_note_on_reject: requireNoteOnReject,
      steps: steps.map((step, index) => ({
        step_order: index + 1,
        name: step.name.trim() || `Step ${index + 1}`,
        approver_type: step.approver_type,
        approver_role_id: step.approver_type === 'role' ? step.approver_role_id : null,
        approver_permission: step.approver_type === 'permission' ? step.approver_permission || null : null,
        note_required: step.note_required,
        is_active: true,
      })),
    };

    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success('Workflow created', `${payload.name} will now route ${targetOption.label.toLowerCase()}.`);
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success('Workflow updated', 'The approval chain has been saved.');
      }
      onClose();
    } catch (error) {
      toast.error('Could not save workflow', error instanceof ApiError ? error.message : 'Please check the form and try again.');
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={workflow !== null}
      onClose={onClose}
      title={isNew ? 'Create approval workflow' : 'Edit approval workflow'}
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalSaveAction title="Save workflow" isLoading={isSaving} onClick={handleSubmit} />
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Applies to</span>
          <SelectMenu value={target} onChange={setTarget} options={WORKFLOW_TARGET_OPTIONS} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Workflow name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Leave approval chain" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted">Description</span>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-strong">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-strong">
            <input type="checkbox" checked={requireNoteOnReject} onChange={(event) => setRequireNoteOnReject(event.target.checked)} />
            Require note on reject
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Approval chain</span>
            <Button type="button" size="sm" variant="ghost" onClick={addStep}>
              <Plus className="h-3.5 w-3.5" /> Add step
            </Button>
          </div>
          {steps.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
              No steps — matching requests will auto-approve immediately.
            </p>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.key} className="rounded-md border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal-light text-xs font-semibold text-pine">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={step.name}
                        onChange={(event) => updateStep(step.key, { name: event.target.value })}
                        placeholder="Step name"
                      />
                      <SelectMenu
                        value={step.approver_type}
                        onChange={(value) => updateStep(step.key, { approver_type: value as ApproverType })}
                        options={APPROVER_TYPE_OPTIONS}
                      />
                      {step.approver_type === 'role' && (
                        <SelectMenu
                          value={step.approver_role_id ? String(step.approver_role_id) : ''}
                          onChange={(value) => updateStep(step.key, { approver_role_id: value ? Number(value) : null })}
                          options={[
                            { value: '', label: 'Select a role' },
                            ...(rolesQuery.data ?? []).map((role) => ({ value: String(role.id), label: role.name })),
                          ]}
                        />
                      )}
                      {step.approver_type === 'permission' && (
                        <SelectMenu
                          value={step.approver_permission}
                          onChange={(value) => updateStep(step.key, { approver_permission: value })}
                          options={[
                            { value: '', label: 'Select a permission' },
                            ...(permissionsQuery.data ?? []).map((permission) => ({
                              value: permission.name,
                              label: permission.label ?? permission.name,
                            })),
                          ]}
                        />
                      )}
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={step.note_required}
                          onChange={(event) => updateStep(step.key, { note_required: event.target.checked })}
                        />
                        Require a note when this step rejects or requests changes
                      </label>
                    </div>
                    <div className="flex flex-none flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                        className="rounded p-1 text-muted hover:bg-surface-soft disabled:opacity-30"
                        aria-label="Move step up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === steps.length - 1}
                        className="rounded p-1 text-muted hover:bg-surface-soft disabled:opacity-30"
                        aria-label="Move step down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(step.key)}
                        className="rounded p-1 text-danger hover:bg-danger-bg"
                        aria-label="Remove step"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ApprovalWorkflowsPanel() {
  const workflowsQuery = useApprovalWorkflows();
  const [editing, setEditing] = useState<ApprovalWorkflow | 'new' | null>(null);
  const workflows = workflowsQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Approval workflows</CardTitle>
          <p className="mt-1 text-xs text-muted">Chain of approvers routed for leave, documents, and attendance corrections.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Create workflow
        </Button>
      </CardHeader>
      <CardBody className="p-0">
        {workflowsQuery.isLoading && <LoadingState label="Loading workflows..." />}
        {workflowsQuery.isError && <ErrorState error={workflowsQuery.error} onRetry={() => workflowsQuery.refetch()} />}
        {workflowsQuery.data && workflows.length === 0 && (
          <EmptyState title="No workflows configured" description="Create a workflow to route approvals through the right people." />
        )}
        {workflows.length > 0 && (
          <ul className="divide-y divide-border">
            {workflows.map((workflow) => (
              <li key={workflow.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-strong">{workflow.name}</p>
                  <p className="text-xs text-muted">
                    {WORKFLOW_TARGET_OPTIONS.find((option) => option.module === workflow.module && option.action === workflow.action)?.label ??
                      `${formatSnakeCase(workflow.module)} · ${formatSnakeCase(workflow.action)}`}
                    {' · '}
                    {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <StatusBadge status={workflow.is_active ? 'active' : 'suspended'} />
                  <Button type="button" size="sm" onClick={() => setEditing(workflow)} title="Edit" aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <WorkflowFormModal workflow={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

export function ApprovalsControlPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const openRequestId = id ? Number(id) : undefined;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canManageWorkflows = hasPermission('approval_workflows.view');

  const workflowsQuery = useApprovalWorkflows(canManageWorkflows);
  const allRequestsQuery = useApprovalRequests({ per_page: 100 });

  const workflows = workflowsQuery.data?.data ?? [];
  const activeWorkflows = workflows.filter((workflow) => workflow.is_active).length;
  const requests = allRequestsQuery.data?.data ?? [];
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const approvedCount = requests.filter((request) => request.status === 'approved').length;
  const attentionCount = requests.filter((request) => ['rejected', 'changes_requested'].includes(request.status)).length;

  return (
    <AreaShell
      title="Approvals"
      subtitle="Review pending approval requests and control the workflow definitions that route them."
      permission="approvals.view"
      actions={
        canManageWorkflows && (
          <Button type="button" size="icon" onClick={() => setSettingsOpen(true)} title="Approval settings" aria-label="Approval settings">
            <Settings className="h-4 w-4" />
          </Button>
        )
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Pending" value={pendingCount} icon={ClipboardCheck} tone={pendingCount ? 'warning' : 'success'} />
        <StatTile label="Approved" value={approvedCount} icon={CheckCircle2} tone="success" />
        <StatTile
          label="Rejected / changes requested"
          value={attentionCount}
          icon={XCircle}
          tone={attentionCount ? 'danger' : 'default'}
        />
        <StatTile label="Active workflows" value={activeWorkflows} icon={Settings} />
      </div>

      <div className="mt-5">
        <ApprovalRequestsPanel openRequestId={openRequestId} onOpenRequestHandled={() => navigate('/approvals', { replace: true })} />
      </div>

      {canManageWorkflows && (
        <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Approval settings" size="lg">
          <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
            <p className="text-sm font-semibold text-strong">Configuration lives here</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Define which workflows route which decisions without turning the main approvals page into a settings screen.
            </p>
          </div>
          <ApprovalWorkflowsPanel />
        </Modal>
      )}
    </AreaShell>
  );
}

function BulkGrantEntitlementButton({
  leaveTypeOptions,
  leavePeriodOptions,
  leaveTypes,
}: {
  leaveTypeOptions: Array<{ label: string; value: string }>;
  leavePeriodOptions: Array<{ label: string; value: string }>;
  leaveTypes: Row[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leavePeriodId, setLeavePeriodId] = useState('');
  const [daysAllocated, setDaysAllocated] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const selectedType = leaveTypes.find((type) => String(type.id) === leaveTypeId);
  const defaultDays = selectedType ? (selectedType.default_days_per_year as number | null | undefined) : null;

  function reset() {
    setLeaveTypeId('');
    setLeavePeriodId('');
    setDaysAllocated('');
    setNotes('');
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ granted: number; skipped: number; days_allocated: number }>('/leave/entitlements/bulk', {
        leave_type_id: Number(leaveTypeId),
        leave_period_id: Number(leavePeriodId),
        days_allocated: daysAllocated === '' ? undefined : Number(daysAllocated),
        notes: notes || undefined,
      }),
    onSuccess: (result) => {
      const skippedNote = result.skipped ? ` ${result.skipped} employee${result.skipped === 1 ? '' : 's'} already had one and were left untouched.` : '';
      toast.success(
        'Bulk grant complete',
        `Granted ${result.granted} employee${result.granted === 1 ? '' : 's'} ${result.days_allocated} days.${skippedNote}`,
      );
      queryClient.invalidateQueries({ queryKey: ['control-panel', '/leave/entitlements'] });
      setIsOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error('Bulk grant failed', error instanceof ApiError ? error.message : 'Could not grant entitlements.');
    },
  });

  if (!isOpen) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
        <Users className="h-3.5 w-3.5" />
        Bulk grant
      </Button>
    );
  }

  const formId = 'bulk-grant-leave-entitlement';

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      title="Bulk grant entitlement"
      size="lg"
      footer={
        <>
          <ModalCancelAction onClick={() => setIsOpen(false)} />
          <ModalSaveAction form={formId} isLoading={mutation.isPending} title="Grant to all active employees" />
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
          <p className="text-sm font-medium text-strong">Grants every active employee at once</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Employees who already have an entitlement for this leave type and period are left untouched — this only fills the gaps.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Leave type" required>
            <SelectMenu
              value={leaveTypeId}
              onChange={setLeaveTypeId}
              options={[{ value: '', label: 'Select...' }, ...leaveTypeOptions]}
            />
          </Field>
          <Field label="Leave period" required>
            <SelectMenu
              value={leavePeriodId}
              onChange={setLeavePeriodId}
              options={[{ value: '', label: 'Select...' }, ...leavePeriodOptions]}
            />
          </Field>
          <Field
            label="Days allocated"
            hint={
              defaultDays != null
                ? `Leave blank to use this leave type's default of ${defaultDays} days.`
                : selectedType
                  ? 'This leave type has no default days set — enter a value or set one on the leave type first.'
                  : undefined
            }
          >
            <Input
              type="number"
              min={0}
              value={daysAllocated}
              onChange={(event) => setDaysAllocated(event.target.value)}
              placeholder={defaultDays != null ? String(defaultDays) : undefined}
            />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function LeaveSettingsPanels() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <DataPanel
        config={{
          title: 'Leave types',
          description: 'The categories employees can request and HR can govern.',
          endpoint: '/leave/types',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'default_days_per_year', label: 'Default days/year' },
            { key: 'auto_grant_on_activation', label: 'Auto-grant' },
            { key: 'is_paid', label: 'Paid' },
          ],
          action: {
            label: 'Add leave type',
            endpoint: '/leave/types',
            successMessage: 'Leave type created',
            invalidateKeys: [['control-panel', '/leave/types']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'code', label: 'Code', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              {
                name: 'default_days_per_year',
                label: 'Default days per year',
                type: 'number',
                help: 'The standard entitlement for this leave type, e.g. 20 for Annual Leave or 90 for Maternity Leave. Individual employees can still be granted a different amount.',
              },
              {
                name: 'auto_grant_on_activation',
                label: 'Auto-grant when an employee is activated',
                type: 'checkbox',
                help: 'Automatically grants every employee this type\'s default days the moment they become active. Only turn this on for universal types like Annual or Sick Leave — leave it off for situational types like Maternity or Compassionate Leave, which should stay a manual, per-case grant.',
              },
              { name: 'minimum_notice_days', label: 'Minimum notice days', type: 'number', defaultValue: 0 },
              { name: 'maximum_days_per_request', label: 'Max days per request', type: 'number' },
              { name: 'is_paid', label: 'Paid', type: 'checkbox', defaultValue: true },
              { name: 'requires_attachment', label: 'Requires attachment', type: 'checkbox' },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          edit: {
            label: 'Edit leave type',
            endpoint: (row) => `/leave/types/${row.id}`,
            method: 'patch',
            successMessage: 'Leave type updated',
            invalidateKeys: [['control-panel', '/leave/types']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'code', label: 'Code', required: true },
              { name: 'description', label: 'Description' },
              {
                name: 'default_days_per_year',
                label: 'Default days per year',
                type: 'number',
                help: 'The standard entitlement for this leave type. Individual employees can still be granted a different amount.',
              },
              {
                name: 'auto_grant_on_activation',
                label: 'Auto-grant when an employee is activated',
                type: 'checkbox',
                help: 'Automatically grants every employee this type\'s default days the moment they become active. Only turn this on for universal types like Annual or Sick Leave.',
              },
              { name: 'minimum_notice_days', label: 'Minimum notice days', type: 'number', defaultValue: 0 },
              { name: 'maximum_days_per_request', label: 'Max days per request', type: 'number' },
              { name: 'is_paid', label: 'Paid', type: 'checkbox', defaultValue: true },
              { name: 'requires_attachment', label: 'Requires attachment', type: 'checkbox' },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          deactivate: {
            label: 'Deactivate leave type',
            endpoint: (row) => `/leave/types/${row.id}`,
            method: 'patch',
            successMessage: 'Leave type deactivated',
            invalidateKeys: [['control-panel', '/leave/types']],
            fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
          },
        }}
      />
      <DataPanel
        config={{
          title: 'Leave periods',
          description: 'The leave years or periods used for balances and requests.',
          endpoint: '/leave/periods',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'starts_on', label: 'Starts' },
            { key: 'ends_on', label: 'Ends' },
          ],
          action: {
            label: 'Add period',
            endpoint: '/leave/periods',
            successMessage: 'Leave period created',
            invalidateKeys: [['control-panel', '/leave/periods']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'starts_on', label: 'Starts on', type: 'date', required: true },
              { name: 'ends_on', label: 'Ends on', type: 'date', required: true },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          edit: {
            label: 'Edit period',
            endpoint: (row) => `/leave/periods/${row.id}`,
            method: 'patch',
            successMessage: 'Leave period updated',
            invalidateKeys: [['control-panel', '/leave/periods']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'starts_on', label: 'Starts on', type: 'date', required: true },
              { name: 'ends_on', label: 'Ends on', type: 'date', required: true },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          deactivate: {
            label: 'Deactivate period',
            endpoint: (row) => `/leave/periods/${row.id}`,
            method: 'patch',
            successMessage: 'Leave period deactivated',
            invalidateKeys: [['control-panel', '/leave/periods']],
            fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
          },
        }}
      />
      <DataPanel
        config={{
          title: 'Holidays',
          description: 'Company holidays and location-specific non-working dates.',
          endpoint: '/leave/holidays',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'date', label: 'Date' },
            { key: 'location.name', label: 'Location' },
          ],
          action: {
            label: 'Add holiday',
            endpoint: '/leave/holidays',
            successMessage: 'Holiday created',
            invalidateKeys: [['control-panel', '/leave/holidays'], ['leave', 'holidays', 'upcoming']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'date', label: 'Date', type: 'date', required: true },
              { name: 'organization_location_id', label: 'Location ID', type: 'number' },
              { name: 'is_recurring', label: 'Recurring yearly', type: 'checkbox' },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          edit: {
            label: 'Edit holiday',
            endpoint: (row) => `/leave/holidays/${row.id}`,
            method: 'patch',
            successMessage: 'Holiday updated',
            invalidateKeys: [['control-panel', '/leave/holidays'], ['leave', 'holidays', 'upcoming']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'date', label: 'Date', type: 'date', required: true },
              { name: 'organization_location_id', label: 'Location ID', type: 'number' },
              { name: 'is_recurring', label: 'Recurring yearly', type: 'checkbox' },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          deactivate: {
            label: 'Deactivate holiday',
            endpoint: (row) => `/leave/holidays/${row.id}`,
            method: 'patch',
            successMessage: 'Holiday deactivated',
            invalidateKeys: [['control-panel', '/leave/holidays'], ['leave', 'holidays', 'upcoming']],
            fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
          },
        }}
      />
    </div>
  );
}

function LeaveEntitlementsPanel({
  leaveTypeOptions,
  leavePeriodOptions,
  employeeOptions,
  leaveTypeRows,
}: {
  leaveTypeOptions: Array<{ label: string; value: string }>;
  leavePeriodOptions: Array<{ label: string; value: string }>;
  employeeOptions: Array<{ label: string; value: string }>;
  leaveTypeRows: Row[];
}) {
  const query = useQuery({
    queryKey: ['control-panel', '/leave/entitlements'],
    queryFn: () => api.get<unknown>('/leave/entitlements'),
  });

  const grantAction: ActionConfig = {
    label: 'Grant entitlement',
    endpoint: '/leave/entitlements',
    successMessage: 'Leave entitlement saved',
    invalidateKeys: [['control-panel', '/leave/entitlements']],
    fields: [
      { name: 'employee_id', label: 'Employee', type: 'select', required: true, options: employeeOptions },
      {
        name: 'leave_type_id',
        label: 'Leave type',
        type: 'select',
        required: true,
        options: leaveTypeOptions,
        help: 'Check the leave type’s default days per year in Leave settings.',
      },
      { name: 'leave_period_id', label: 'Leave period', type: 'select', required: true, options: leavePeriodOptions },
      { name: 'days_allocated', label: 'Days allocated', type: 'number', required: true, help: 'e.g. 20, 25, or 30 for Annual Leave, or whatever was agreed for Maternity Leave.' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  };

  const deleteAction: RowActionConfig = {
    label: 'Delete entitlement',
    endpoint: (row) => `/leave/entitlements/${row.id}`,
    successMessage: 'Leave entitlement deleted',
    invalidateKeys: [['control-panel', '/leave/entitlements']],
    fields: [],
  };

  const rows = rowsFromResponse(query.data);

  const columns: Column<Row>[] = [
    { key: 'employee', header: 'Employee', render: (row) => formatValue(valueAt(row, 'employee.full_name')) },
    { key: 'leave_type', header: 'Leave type', render: (row) => formatValue(valueAt(row, 'leave_type.name')) },
    { key: 'leave_period', header: 'Period', render: (row) => formatValue(valueAt(row, 'leave_period.name')) },
    { key: 'days_allocated', header: 'Allocated', render: (row) => formatValue(row.days_allocated) },
    { key: 'days_used', header: 'Used', render: (row) => formatValue(row.days_used) },
    { key: 'days_available', header: 'Available', render: (row) => formatValue(row.days_available) },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end">
          <InlineRowAction row={row} config={deleteAction} variant="delete" onDone={() => query.refetch()} />
        </div>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-start">
        <div>
          <CardTitle>Leave entitlements</CardTitle>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted">
            How many days each employee is granted per leave type and leave period. Re-grant to change an amount.
          </p>
        </div>
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted">
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
      </CardHeader>
      <CardBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ActionForm action={grantAction} onDone={() => query.refetch()} />
          <BulkGrantEntitlementButton
            leaveTypeOptions={leaveTypeOptions}
            leavePeriodOptions={leavePeriodOptions}
            leaveTypes={leaveTypeRows}
          />
        </div>
        {query.isLoading ? (
          <LoadingState label="Loading leave entitlements..." />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No entitlements yet" description="Grant an entitlement to get started." />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} />
        )}
      </CardBody>
    </Card>
  );
}

export function LeaveControlPage() {
  const { hasPermission } = useAuth();
  const canManageEntitlements = hasPermission('leave_requests.approve');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entitlementsOpen, setEntitlementsOpen] = useState(false);
  const typesQuery = useQuery({
    queryKey: ['control-panel', '/leave/types'],
    queryFn: () => api.get<unknown>('/leave/types'),
  });
  const holidaysQuery = useQuery({
    queryKey: ['leave', 'holidays', 'upcoming'],
    queryFn: () => api.get<unknown>('/leave/holidays?per_page=100'),
  });
  const requestsQuery = useQuery({
    queryKey: ['leave', 'requests', 'recent'],
    queryFn: () => api.get<unknown>('/leave/requests?per_page=20'),
  });
  const periodsQuery = useQuery({
    queryKey: ['control-panel', '/leave/periods'],
    queryFn: () => api.get<unknown>('/leave/periods'),
    enabled: canManageEntitlements,
  });
  const employeesQuery = useEmployees(
    { status: 'active', per_page: 200, sort_by: 'first_name', sort_direction: 'asc' },
    canManageEntitlements,
  );

  const typeRows = rowsFromResponse(typesQuery.data);
  const activeTypes = typeRows.filter((row) => Boolean(row.is_active)).length;
  const requestRows = rowsFromResponse(requestsQuery.data);
  const pendingCount = requestRows.filter((row) => row.status === 'submitted').length;
  const approvedCount = requestRows.filter((row) => row.status === 'approved').length;

  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcomingHolidays = rowsFromResponse(holidaysQuery.data)
    .filter((row) => Boolean(row.is_active) && typeof row.date === 'string' && row.date >= today && row.date <= in30Days)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const leaveTypeOptions = typeRows.map((type) => ({ label: formatValue(type.name), value: String(type.id) }));
  const leavePeriodOptions = rowsFromResponse(periodsQuery.data).map((period) => ({
    label: formatValue(period.name),
    value: String(period.id),
  }));
  const employeeOptions = (employeesQuery.data?.data ?? []).map((employee) => ({
    label: `${employee.full_name} (${employee.employee_number})`,
    value: String(employee.id),
  }));

  return (
    <AreaShell
      title="Leave"
      subtitle="Track leave requests and the upcoming calendar, and control leave types, periods, and holidays."
      permission="leave_requests.view"
      actions={
        <>
          {canManageEntitlements && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setEntitlementsOpen((current) => !current)}>
              <Users className="h-3.5 w-3.5" />
              {entitlementsOpen ? 'Hide entitlements' : 'Manage entitlements'}
            </Button>
          )}
          <Button type="button" size="icon" onClick={() => setSettingsOpen(true)} title="Leave settings" aria-label="Leave settings">
            <Settings className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Pending requests" value={pendingCount} icon={CalendarClock} tone={pendingCount ? 'warning' : 'success'} />
        <StatTile label="Approved requests" value={approvedCount} icon={CheckCircle2} tone="success" />
        <StatTile label="Active leave types" value={activeTypes} icon={ClipboardCheck} />
        <StatTile label="Holidays in next 30 days" value={upcomingHolidays.length} icon={CalendarDays} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent leave requests</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {requestsQuery.isLoading ? (
              <LoadingState label="Loading leave requests..." />
            ) : requestsQuery.isError ? (
              <ErrorState error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />
            ) : requestRows.length === 0 ? (
              <EmptyState title="No leave requests yet" description="Employee leave requests will appear here as they come in." />
            ) : (
              <div className="divide-y divide-border">
                {requestRows.slice(0, 8).map((request, index) => (
                  <div key={String(request.id ?? index)} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(valueAt(request, 'employee.full_name'))}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {formatValue(valueAt(request, 'leave_type.name'))} · {formatValue(request.starts_on)} - {formatValue(request.ends_on)}
                      </p>
                    </div>
                    <StatusBadge status={String(request.status)} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming holidays</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {holidaysQuery.isLoading ? (
              <LoadingState label="Loading holidays..." />
            ) : holidaysQuery.isError ? (
              <ErrorState error={holidaysQuery.error} onRetry={() => holidaysQuery.refetch()} />
            ) : upcomingHolidays.length === 0 ? (
              <EmptyState title="No holidays in the next 30 days" description="Open settings to add company holidays." />
            ) : (
              <div className="space-y-2">
                {upcomingHolidays.map((holiday, index) => (
                  <div key={String(holiday.id ?? index)} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(holiday.name)}</p>
                      <p className="text-xs text-muted">{formatValue(valueAt(holiday, 'location.name')) === '-' ? 'All locations' : formatValue(valueAt(holiday, 'location.name'))}</p>
                    </div>
                    <p className="flex-shrink-0 text-xs font-medium text-strong">{formatValue(holiday.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {canManageEntitlements && entitlementsOpen && (
        <div className="mt-5">
          <LeaveEntitlementsPanel
            leaveTypeOptions={leaveTypeOptions}
            leavePeriodOptions={leavePeriodOptions}
            employeeOptions={employeeOptions}
            leaveTypeRows={typeRows}
          />
        </div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Leave settings" size="lg">
        <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
          <p className="text-sm font-semibold text-strong">Configuration lives here</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Define leave types, periods, and the company calendar without turning the main leave page into a settings screen.
          </p>
        </div>
        <LeaveSettingsPanels />
      </Modal>
    </AreaShell>
  );
}

function AttendanceSettingsPanels() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <DataPanel
        config={{
          title: 'Attendance settings',
          description: 'The policy that controls clock-in behavior, grace periods, and corrections.',
          endpoint: '/attendance/settings',
          responseKey: 'attendance_settings',
          columns: [
            { key: 'timezone', label: 'Timezone' },
            { key: 'allow_employee_clock_in', label: 'Employee clock-in' },
            { key: 'allow_employee_corrections', label: 'Corrections' },
          ],
          action: {
            label: 'Update settings',
            endpoint: '/attendance/settings',
            method: 'patch',
            successMessage: 'Attendance settings updated',
            invalidateKeys: [['control-panel', '/attendance/settings']],
            fields: [
              { name: 'timezone', label: 'Timezone', defaultValue: 'Africa/Lagos' },
              { name: 'late_grace_minutes', label: 'Late grace minutes', type: 'number', defaultValue: 0 },
              { name: 'early_checkout_grace_minutes', label: 'Early checkout grace', type: 'number', defaultValue: 0 },
              { name: 'rounding_minutes', label: 'Rounding minutes', type: 'number', defaultValue: 0 },
              { name: 'allow_employee_clock_in', label: 'Employee clock-in', type: 'checkbox', defaultValue: true },
              { name: 'allow_employee_corrections', label: 'Employee corrections', type: 'checkbox', defaultValue: true },
              { name: 'require_approval_for_corrections', label: 'Approval for corrections', type: 'checkbox', defaultValue: true },
            ],
          },
        }}
      />
      <DataPanel
        config={{
          title: 'Work shifts',
          description: 'Reusable working schedules for attendance calculations.',
          endpoint: '/attendance/shifts',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'starts_at', label: 'Starts' },
            { key: 'ends_at', label: 'Ends' },
          ],
          action: {
            label: 'Add shift',
            endpoint: '/attendance/shifts',
            successMessage: 'Work shift created',
            invalidateKeys: [['control-panel', '/attendance/shifts']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'code', label: 'Code', required: true },
              { name: 'starts_at', label: 'Starts at', type: 'time', required: true },
              { name: 'ends_at', label: 'Ends at', type: 'time', required: true },
              { name: 'break_minutes', label: 'Break minutes', type: 'number', defaultValue: 0 },
              { name: 'is_overnight', label: 'Overnight shift', type: 'checkbox' },
              { name: 'is_default', label: 'Default shift', type: 'checkbox' },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          edit: {
            label: 'Edit shift',
            endpoint: (row) => `/attendance/shifts/${row.id}`,
            method: 'patch',
            successMessage: 'Work shift updated',
            invalidateKeys: [['control-panel', '/attendance/shifts']],
            fields: [
              { name: 'name', label: 'Name', required: true },
              { name: 'code', label: 'Code', required: true },
              { name: 'starts_at', label: 'Starts at', type: 'time', required: true },
              { name: 'ends_at', label: 'Ends at', type: 'time', required: true },
              { name: 'break_minutes', label: 'Break minutes', type: 'number', defaultValue: 0 },
              { name: 'is_overnight', label: 'Overnight shift', type: 'checkbox' },
              { name: 'is_default', label: 'Default shift', type: 'checkbox' },
              { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
            ],
          },
          deactivate: {
            label: 'Deactivate shift',
            endpoint: (row) => `/attendance/shifts/${row.id}`,
            method: 'patch',
            successMessage: 'Work shift deactivated',
            invalidateKeys: [['control-panel', '/attendance/shifts']],
            fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
          },
        }}
      />
    </div>
  );
}

export function AttendanceControlPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recordsQuery = useQuery({
    queryKey: ['attendance', 'records', 'recent'],
    queryFn: () => api.get<unknown>('/attendance/records?per_page=20'),
  });
  const correctionsQuery = useQuery({
    queryKey: ['attendance', 'corrections', 'recent'],
    queryFn: () => api.get<unknown>('/attendance/corrections?per_page=100'),
  });

  const recordRows = rowsFromResponse(recordsQuery.data);
  const presentCount = recordRows.filter((row) => row.status === 'present').length;
  const lateCount = recordRows.filter((row) => row.status === 'late').length;
  const absentCount = recordRows.filter((row) => row.status === 'absent').length;
  const correctionRows = rowsFromResponse(correctionsQuery.data);
  const pendingCorrections = correctionRows.filter((row) => row.status === 'submitted').length;

  return (
    <AreaShell
      title="Attendance"
      subtitle="Monitor today's attendance and correction requests, and control policy and work shifts."
      permission="attendance.view"
      actions={
        <Button type="button" size="icon" onClick={() => setSettingsOpen(true)} title="Attendance settings" aria-label="Attendance settings">
          <Settings className="h-4 w-4" />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Present" value={presentCount} icon={UserCheck} tone="success" />
        <StatTile label="Late" value={lateCount} icon={Clock3} tone={lateCount ? 'warning' : 'default'} />
        <StatTile label="Absent" value={absentCount} icon={UserX} tone={absentCount ? 'danger' : 'default'} />
        <StatTile label="Pending corrections" value={pendingCorrections} icon={FileClock} tone={pendingCorrections ? 'warning' : 'success'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent attendance records</CardTitle>
            <Clock3 className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {recordsQuery.isLoading ? (
              <LoadingState label="Loading attendance records..." />
            ) : recordsQuery.isError ? (
              <ErrorState error={recordsQuery.error} onRetry={() => recordsQuery.refetch()} />
            ) : recordRows.length === 0 ? (
              <EmptyState title="No attendance records yet" description="Daily attendance entries will appear here as employees clock in." />
            ) : (
              <div className="divide-y divide-border">
                {recordRows.slice(0, 8).map((record, index) => (
                  <div key={String(record.id ?? index)} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(valueAt(record, 'employee.full_name'))}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{formatValue(record.attendance_date)}</p>
                    </div>
                    <StatusBadge status={String(record.status)} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correction requests</CardTitle>
            <FileClock className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {correctionsQuery.isLoading ? (
              <LoadingState label="Loading correction requests..." />
            ) : correctionsQuery.isError ? (
              <ErrorState error={correctionsQuery.error} onRetry={() => correctionsQuery.refetch()} />
            ) : correctionRows.length === 0 ? (
              <EmptyState title="No correction requests" description="Employee-raised corrections will appear here for review." />
            ) : (
              <div className="space-y-2">
                {correctionRows.slice(0, 8).map((correction, index) => (
                  <div key={String(correction.id ?? index)} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-strong">{formatValue(valueAt(correction, 'employee.full_name'))}</p>
                      <p className="truncate text-xs text-muted">{formatValue(correction.reason)}</p>
                    </div>
                    <StatusBadge status={String(correction.status)} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Attendance settings" size="lg">
        <div className="mb-4 rounded-md border border-border bg-surface-soft px-4 py-3">
          <p className="text-sm font-semibold text-strong">Configuration lives here</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Control clock-in policy and work shifts without turning the main attendance page into a settings screen.
          </p>
        </div>
        <AttendanceSettingsPanels />
      </Modal>
    </AreaShell>
  );
}

const REPORT_MODULE_ICONS: Record<string, LucideIcon> = {
  employees: Building2,
  documents: FileCheck2,
  leave: CalendarDays,
  attendance: Clock3,
};

const REPORT_MODULE_LABELS: Record<string, string> = {
  employees: 'Employees',
  documents: 'Documents',
  leave: 'Leave',
  attendance: 'Attendance',
};

export function ReportsControlPage() {
  const toast = useToast();
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const reportsQuery = useQuery({
    queryKey: ['control-panel', '/reports'],
    queryFn: () => api.get<unknown>('/reports'),
  });

  const reportRows = rowsFromResponse(reportsQuery.data);
  const groups = reportRows.reduce<Record<string, Row[]>>((acc, report) => {
    const moduleKey = String(report.module ?? 'general');
    acc[moduleKey] = acc[moduleKey] ?? [];
    acc[moduleKey].push(report);
    return acc;
  }, {});

  async function handleExport(report: Row) {
    const key = String(report.key);
    setExportingKey(key);
    try {
      const response = await apiClient.get(`/reports/${key}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${key}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export ready', `${formatValue(report.name)} has been downloaded.`);
    } catch (error) {
      toast.error('Could not export report', error instanceof ApiError ? error.message : 'Something went wrong while preparing this export.');
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <AreaShell
      title="Reports"
      subtitle="Export ready-made reports across employees, documents, leave, and attendance."
      permission="reports.view"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Available reports" value={reportRows.length} icon={BarChart3} />
        <StatTile label="Modules covered" value={Object.keys(groups).length} icon={Building2} />
        <StatTile label="Employee & document reports" value={(groups.employees?.length ?? 0) + (groups.documents?.length ?? 0)} icon={FileCheck2} />
        <StatTile label="Leave & attendance reports" value={(groups.leave?.length ?? 0) + (groups.attendance?.length ?? 0)} icon={Clock3} />
      </div>

      <div className="mt-5">
        {reportsQuery.isLoading ? (
          <LoadingState label="Loading reports..." />
        ) : reportsQuery.isError ? (
          <ErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />
        ) : reportRows.length === 0 ? (
          <EmptyState title="No reports available" description="Reports become available as your organization's modules are enabled." />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Object.entries(groups).map(([moduleKey, reports]) => {
              const Icon = REPORT_MODULE_ICONS[moduleKey] ?? BarChart3;
              return (
                <Card key={moduleKey}>
                  <CardHeader>
                    <CardTitle>{REPORT_MODULE_LABELS[moduleKey] ?? moduleKey}</CardTitle>
                    <Icon className="h-4 w-4 text-muted" />
                  </CardHeader>
                  <CardBody>
                    <div className="divide-y divide-border">
                      {reports.map((report) => {
                        const key = String(report.key);
                        return (
                          <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-strong">{formatValue(report.name)}</p>
                              <p className="mt-0.5 text-xs leading-5 text-muted">{formatValue(report.description)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleExport(report)}
                              isLoading={exportingKey === key}
                              className="flex-shrink-0"
                            >
                              {exportingKey !== key && <Download className="h-3.5 w-3.5" />} Export
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AreaShell>
  );
}


