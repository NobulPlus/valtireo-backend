import { Fragment, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Building2, ClipboardCheck, FileCheck2, FileClock, FileText, Pencil, Plus, Power, Settings, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction, ModalSendAction } from '@/components/ui/ModalActions';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useAuth } from '@/context/AuthContext';
import { useActOnApprovalRequest, useApprovalRequests, type ApprovalDecisionAction } from '@/features/approvals/api';
import { useSetupLookups } from '@/features/workspace/api';
import { api, ApiError } from '@/lib/apiClient';
import type { AllSetupLookups, ApprovalRequest, Paginated } from '@/types/api';

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
              <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-strong">
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
  variant?: 'edit' | 'deactivate';
  onDone?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(() => initialFormFromRow(config.fields, row));
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(
        config.endpoint(row),
        payloadFromForm(config.fields, variant === 'deactivate' ? initialForm(config.fields) : form),
      ),
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

  if (!isOpen && variant === 'deactivate') {
    return (
      <Button type="button" size="sm" variant="danger" onClick={() => setIsOpen(true)} title="Deactivate" aria-label="Deactivate">
        <Power className="h-3.5 w-3.5" />
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

  if (variant === 'deactivate') {
    return (
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={config.label}
        footer={
          <>
            <ModalCancelAction onClick={() => setIsOpen(false)} />
            <ModalConfirmAction
              title="Deactivate"
              variant="danger"
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate()}
              icon={Power}
            />
          </>
        }
      >
        <div className="rounded-md border border-danger-bg bg-danger-bg/40 p-4">
          <p className="text-sm font-semibold text-strong">{formatValue(row.name ?? row.title ?? row.code)}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            For now this safely deactivates the record instead of hard deleting it, so historical employees,
            documents, attendance, and reports do not lose their references.
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
          <p className="text-sm font-medium text-strong">{formatValue(row.name ?? row.title ?? row.code)}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Update this record without leaving the control surface. Changes remain scoped to this organization.
          </p>
        </div>
        <ActionFields fields={config.fields} form={form} setForm={setForm} />
      </form>
    </Modal>
  );
}

function DataPanel({ config }: { config: PanelConfig }) {
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
        {config.action && <ActionForm action={config.action} onDone={() => query.refetch()} />}
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
  onClose,
  onDone,
}: {
  title: string;
  row: Row | null;
  columns: Array<{ key: string; label: string }>;
  edit?: RowActionConfig;
  deactivate?: RowActionConfig;
  onClose: () => void;
  onDone?: () => void;
}) {
  if (!row) return null;

  const heading = formatValue(row.name ?? row.title ?? row.full_name ?? row.code ?? title);

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
          <div key={column.key} className="rounded-md border border-border bg-white px-3 py-2">
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

export function StructureSettingsPage() {
  const lookupsQuery = useSetupLookups();
  const lookups = lookupsQuery.data;
  const departmentOptions = useMemo(
    () => lookups?.departments.map((department) => ({ label: department.name, value: department.id })) ?? [],
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
      title="Review approval request"
      footer={
        <>
          <ModalCancelAction onClick={onClose} />
          <ModalSendAction title="Record decision" isLoading={actMutation.isPending} onClick={handleSubmit} />
        </>
      }
    >
      {request && (
        <div className="space-y-4">
          <div>
            <p className="font-medium text-strong">{request.title}</p>
            <p className="text-xs text-muted">
              {formatSnakeCase(request.module)} · {formatSnakeCase(request.action)} · Requested by {request.requester?.name ?? 'System'}
            </p>
          </div>
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
        </div>
      )}
    </Modal>
  );
}

function ApprovalRequestsPanel() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const requestsQuery = useApprovalRequests({ status: statusFilter || undefined, per_page: 50 });
  const [actingOn, setActingOn] = useState<ApprovalRequest | null>(null);
  const requests = requestsQuery.data?.data ?? [];

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

export function ApprovalsControlPage() {
  const { hasPermission } = useAuth();

  return (
    <AreaShell
      title="Approvals"
      subtitle="Review pending approval requests and control the workflow definitions that route them."
      permission="approvals.view"
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {hasPermission('approval_workflows.view') && (
          <DataPanel
          config={{
            title: 'Approval workflows',
            description: 'Workflow definitions owned by this organization.',
            endpoint: '/approval-workflows',
            columns: [
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Name' },
              { key: 'module', label: 'Module' },
              { key: 'action', label: 'Action' },
              { key: 'is_active', label: 'Active' },
            ],
            action: {
              label: 'Create workflow',
              endpoint: '/approval-workflows',
              successMessage: 'Approval workflow created',
              invalidateKeys: [['control-panel', '/approval-workflows']],
              fields: [
                {
                  name: 'module',
                  label: 'Module',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Documents', value: 'documents' },
                    { label: 'Leave', value: 'leave' },
                    { label: 'Attendance', value: 'attendance' },
                    { label: 'Employees', value: 'employees' },
                  ],
                },
                { name: 'action', label: 'Action', required: true, placeholder: 'review, approve, correction' },
                { name: 'name', label: 'Name', required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
                { name: 'require_note_on_reject', label: 'Require note on reject', type: 'checkbox', defaultValue: true },
              ],
            },
            edit: {
              label: 'Edit workflow',
              endpoint: (row) => `/approval-workflows/${row.id}`,
              method: 'patch',
              successMessage: 'Approval workflow updated',
              invalidateKeys: [['control-panel', '/approval-workflows']],
              fields: [
                {
                  name: 'module',
                  label: 'Module',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Documents', value: 'documents' },
                    { label: 'Leave', value: 'leave' },
                    { label: 'Attendance', value: 'attendance' },
                    { label: 'Employees', value: 'employees' },
                  ],
                },
                { name: 'action', label: 'Action', required: true },
                { name: 'name', label: 'Name', required: true },
                { name: 'description', label: 'Description' },
                { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
                { name: 'require_note_on_reject', label: 'Require note on reject', type: 'checkbox' },
              ],
            },
            deactivate: {
              label: 'Deactivate workflow',
              endpoint: (row) => `/approval-workflows/${row.id}`,
              method: 'patch',
              successMessage: 'Approval workflow deactivated',
              invalidateKeys: [['control-panel', '/approval-workflows']],
              fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
            },
          }}
          />
        )}
        <ApprovalRequestsPanel />
      </div>
    </AreaShell>
  );
}

export function LeaveControlPage() {
  return (
    <AreaShell
      title="Leave setup"
      subtitle="Control leave definitions, periods, holidays, entitlements, and organization leave requests."
      permission="leave_requests.view"
    >
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
              invalidateKeys: [['control-panel', '/leave/holidays']],
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
              invalidateKeys: [['control-panel', '/leave/holidays']],
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
              invalidateKeys: [['control-panel', '/leave/holidays']],
              fields: [{ name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: false }],
            },
          }}
        />
        <DataPanel
          config={{
            title: 'Leave requests',
            description: 'Employee requests moving through the leave workflow.',
            endpoint: '/leave/requests',
            columns: [
              { key: 'employee.full_name', label: 'Employee' },
              { key: 'leave_type.name', label: 'Type' },
              { key: 'status', label: 'Status' },
            ],
          }}
        />
      </div>
    </AreaShell>
  );
}

export function AttendanceControlPage() {
  return (
    <AreaShell
      title="Attendance setup"
      subtitle="Control attendance policy, work shifts, records, and correction requests."
      permission="attendance.view"
    >
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
        <DataPanel
          config={{
            title: 'Attendance records',
            description: 'Daily attendance entries captured for employees.',
            endpoint: '/attendance/records',
            columns: [
              { key: 'employee.full_name', label: 'Employee' },
              { key: 'attendance_date', label: 'Date' },
              { key: 'status', label: 'Status' },
            ],
          }}
        />
        <DataPanel
          config={{
            title: 'Correction requests',
            description: 'Employee-raised corrections awaiting review or audit history.',
            endpoint: '/attendance/corrections',
            columns: [
              { key: 'employee.full_name', label: 'Employee' },
              { key: 'status', label: 'Status' },
              { key: 'reason', label: 'Reason' },
            ],
          }}
        />
      </div>
    </AreaShell>
  );
}

export function ReportsControlPage() {
  return (
    <AreaShell
      title="Reports"
      subtitle="Control the organization report catalogue and export points."
      permission="reports.view"
    >
      <div className="flex flex-col gap-5">
        <ControlNote
          icon={BarChart3}
          title="Report exports"
          description="Report exports remain backend-driven, so any filters applied through each report endpoint stay scoped to the current organization."
        />
        <DataPanel
          config={{
            title: 'Available reports',
            description: 'Exportable views prepared for HR, compliance, and operations.',
            endpoint: '/reports',
            columns: [
              { key: 'key', label: 'Key' },
              { key: 'name', label: 'Name' },
              { key: 'description', label: 'Description' },
            ],
          }}
        />
        <Link
          to="/settings/control-center"
          className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-border bg-white px-3 text-[13px] font-medium text-strong transition-colors hover:bg-surface-soft"
        >
          Back to control center
        </Link>
      </div>
    </AreaShell>
  );
}


