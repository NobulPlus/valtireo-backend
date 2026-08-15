import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, FileSpreadsheet, Upload, UserPlus, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { CopyableSecret } from '@/components/ui/CopyableSecret';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { AsyncSelect, type AsyncOption } from '@/components/ui/AsyncSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useSetupLookups } from '@/features/workspace/api';
import {
  downloadEmployeeImportTemplate,
  searchEmployees,
  useCreateEmployee,
  useImportEmployees,
  type TemplateImportResult,
} from '@/features/employees/api';
import { ApiError } from '@/lib/apiClient';

const schema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  work_email: z.string().min(1, 'Work email is required').email('Enter a valid email address'),
  phone: z.string().optional(),
  department_id: z.string().min(1, 'Department is required'),
  unit_id: z.string().optional(),
  designation_id: z.string().min(1, 'Designation is required'),
  grade_level_id: z.string().optional(),
  employment_type_id: z.string().min(1, 'Employment type is required'),
  organization_location_id: z.string().min(1, 'Location is required'),
  start_date: z.string().optional(),
  send_invitation: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function lookupOptions<T extends { id: number; name: string }>(items: T[] | undefined, placeholder: string): SelectMenuOption[] {
  return [
    { value: '', label: placeholder },
    ...(items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

function EmployeeCreateContent() {
  const navigate = useNavigate();
  const lookupsQuery = useSetupLookups();
  const createMutation = useCreateEmployee();
  const importMutation = useImportEmployees();
  const toast = useToast();
  const [reportingManager, setReportingManager] = useState<AsyncOption | null>(null);
  const [importResult, setImportResult] = useState<TemplateImportResult | null>(null);
  const [invitationLink, setInvitationLink] = useState<{ url: string; employeeId: number } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_number: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      work_email: '',
      phone: '',
      department_id: '',
      unit_id: '',
      designation_id: '',
      grade_level_id: '',
      employment_type_id: '',
      organization_location_id: '',
      start_date: '',
      send_invitation: true,
    },
  });

  const selectedDepartmentId = watch('department_id');
  const startDate = watch('start_date') ?? '';
  const selectedUnitId = watch('unit_id') ?? '';
  const selectedDesignationId = watch('designation_id') ?? '';
  const selectedGradeLevelId = watch('grade_level_id') ?? '';
  const selectedEmploymentTypeId = watch('employment_type_id') ?? '';
  const selectedLocationId = watch('organization_location_id') ?? '';
  const phone = watch('phone') ?? '';
  const units = useMemo(
    () =>
      (lookupsQuery.data?.units ?? []).filter(
        (unit) => !selectedDepartmentId || String(unit.department_id) === selectedDepartmentId,
      ),
    [lookupsQuery.data, selectedDepartmentId],
  );

  async function onSubmit(values: FormValues) {
    try {
      const result = await createMutation.mutateAsync({
        employee_number: values.employee_number,
        first_name: values.first_name,
        middle_name: values.middle_name || null,
        last_name: values.last_name,
        work_email: values.work_email,
        phone: values.phone || null,
        department_id: Number(values.department_id),
        unit_id: values.unit_id ? Number(values.unit_id) : null,
        designation_id: Number(values.designation_id),
        grade_level_id: values.grade_level_id ? Number(values.grade_level_id) : null,
        employment_type_id: Number(values.employment_type_id),
        organization_location_id: Number(values.organization_location_id),
        reporting_manager_id: reportingManager?.value ?? null,
        start_date: values.start_date || null,
        send_invitation: values.send_invitation,
      });
      toast.success('Employee created', `${result.employee.full_name} has been added successfully.`);

      if (result.invitation) {
        setInvitationLink({
          url: `${window.location.origin}/accept-invitation/${result.invitation.token}`,
          employeeId: result.employee.id,
        });
      } else {
        navigate(`/employees/${result.employee.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field in schema.shape) {
            setError(field as keyof FormValues, { message: messages[0] });
          }
        });
        toast.error('Could not create employee', error.message);
      } else if (error instanceof ApiError) {
        toast.error('Could not create employee', error.message);
      } else {
        toast.error('Could not create employee', 'Something went wrong. Please try again.');
      }
    }
  }

  function closeInvitationModal() {
    if (invitationLink) {
      navigate(`/employees/${invitationLink.employeeId}`);
    }
    setInvitationLink(null);
  }

  async function handleDownloadTemplate() {
    try {
      await downloadEmployeeImportTemplate();
      toast.success('Template downloaded', 'Fill the CSV in Excel, save it, then upload it here.');
    } catch (error) {
      toast.error(
        'Could not download template',
        error instanceof ApiError ? error.message : 'Could not download the employee import template.',
      );
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setImportResult(null);

    try {
      const result = await importMutation.mutateAsync(file);
      setImportResult(result);
      if (result.summary.failed_rows > 0) {
        toast.warning(
          'Import completed with issues',
          `${result.summary.imported_rows} imported, ${result.summary.failed_rows} failed. Review the report below.`,
        );
      } else {
        toast.success('Employees imported', `${result.summary.imported_rows} employee records were created.`);
      }
    } catch (error) {
      toast.error('Could not import employees', error instanceof ApiError ? error.message : 'Could not import the employee file.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Add employee"
        breadcrumbs={[{ label: 'Employees', to: '/employees' }, { label: 'Add employee' }]}
      />

      <Card className="mb-5">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Bulk employee upload</CardTitle>
            <p className="mt-1 text-xs text-muted">
              Download the template, fill it in Excel, then upload the completed CSV to create multiple employees.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleDownloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Template
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-white px-4 text-sm font-medium text-strong transition-colors hover:bg-surface-soft">
              {importMutation.isPending ? (
                <>
                  <Upload className="h-3.5 w-3.5 animate-pulse" /> Importing
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" /> Upload
                </>
              )}
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                disabled={importMutation.isPending}
                onChange={(event) => {
                  void handleImportFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm text-muted md:grid-cols-3">
            <div className="rounded-md bg-surface-soft p-3">
              <FileSpreadsheet className="mb-2 h-4 w-4 text-teal" />
              <span className="block font-medium text-strong">Use structure codes</span>
              <span>Departments, units, designations, grade levels, employment types, and locations use their codes.</span>
            </div>
            <div className="rounded-md bg-surface-soft p-3">
              <span className="block font-medium text-strong">Required fields</span>
              <span>Employee number, names, work email, department, designation, employment type, and location.</span>
            </div>
            <div className="rounded-md bg-surface-soft p-3">
              <span className="block font-medium text-strong">Invitation control</span>
              <span>Set send_invitation to true or false per row.</span>
            </div>
          </div>

          {importResult && (
            <div className="rounded-md border border-border bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-strong">
                  Imported {importResult.summary.imported_rows} of {importResult.summary.total_rows} rows
                </span>
                <span className="text-muted">Valid: {importResult.summary.valid_rows}</span>
                <span className="text-muted">Failed: {importResult.summary.failed_rows}</span>
              </div>
              {importResult.summary.failed_rows > 0 && (
                <div className="mt-3 space-y-1">
                  {importResult.rows
                    .filter((row) => !row.valid)
                    .slice(0, 3)
                    .map((row) => (
                      <p key={row.row_number} className="text-xs text-danger">
                        Row {row.row_number}: {Object.values(row.errors).join(' ')}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Employee number" htmlFor="employee_number" error={errors.employee_number?.message} required>
              <Input id="employee_number" invalid={Boolean(errors.employee_number)} {...register('employee_number')} />
            </Field>
            <Field label="Work email" htmlFor="work_email" error={errors.work_email?.message} required>
              <Input id="work_email" type="email" invalid={Boolean(errors.work_email)} {...register('work_email')} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <PhoneInput
                id="phone"
                value={phone}
                onChange={(value) => setValue('phone', value, { shouldDirty: true, shouldValidate: true })}
                invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="First name" htmlFor="first_name" error={errors.first_name?.message} required>
              <Input id="first_name" invalid={Boolean(errors.first_name)} {...register('first_name')} />
            </Field>
            <Field label="Middle name" htmlFor="middle_name" error={errors.middle_name?.message}>
              <Input id="middle_name" {...register('middle_name')} />
            </Field>
            <Field label="Last name" htmlFor="last_name" error={errors.last_name?.message} required>
              <Input id="last_name" invalid={Boolean(errors.last_name)} {...register('last_name')} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Structure & assignment</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Department" htmlFor="department_id" error={errors.department_id?.message} required>
              <SelectMenu
                value={selectedDepartmentId}
                onChange={(value) => {
                  setValue('department_id', value, { shouldDirty: true, shouldValidate: true });
                  setValue('unit_id', '', { shouldDirty: true, shouldValidate: true });
                }}
                options={lookupOptions(lookupsQuery.data?.departments, 'Select department')}
                invalid={Boolean(errors.department_id)}
              />
            </Field>
            <Field label="Unit" htmlFor="unit_id" error={errors.unit_id?.message}>
              <SelectMenu
                value={selectedUnitId}
                onChange={(value) => setValue('unit_id', value, { shouldDirty: true, shouldValidate: true })}
                options={lookupOptions(units, 'Select unit')}
              />
            </Field>
            <Field label="Designation" htmlFor="designation_id" error={errors.designation_id?.message} required>
              <SelectMenu
                value={selectedDesignationId}
                onChange={(value) => setValue('designation_id', value, { shouldDirty: true, shouldValidate: true })}
                options={lookupOptions(lookupsQuery.data?.designations, 'Select designation')}
                invalid={Boolean(errors.designation_id)}
              />
            </Field>
            <Field label="Grade level" htmlFor="grade_level_id" error={errors.grade_level_id?.message}>
              <SelectMenu
                value={selectedGradeLevelId}
                onChange={(value) => setValue('grade_level_id', value, { shouldDirty: true, shouldValidate: true })}
                options={lookupOptions(lookupsQuery.data?.grade_levels, 'Select grade level')}
              />
            </Field>
            <Field
              label="Employment type"
              htmlFor="employment_type_id"
              error={errors.employment_type_id?.message}
              required
            >
              <SelectMenu
                value={selectedEmploymentTypeId}
                onChange={(value) => setValue('employment_type_id', value, { shouldDirty: true, shouldValidate: true })}
                options={lookupOptions(lookupsQuery.data?.employment_types, 'Select employment type')}
                invalid={Boolean(errors.employment_type_id)}
              />
            </Field>
            <Field
              label="Location"
              htmlFor="organization_location_id"
              error={errors.organization_location_id?.message}
              required
            >
              <SelectMenu
                value={selectedLocationId}
                onChange={(value) => setValue('organization_location_id', value, { shouldDirty: true, shouldValidate: true })}
                options={lookupOptions(lookupsQuery.data?.locations, 'Select location')}
                invalid={Boolean(errors.organization_location_id)}
              />
            </Field>
            <Field label="Reporting manager" htmlFor="reporting_manager_id">
              <AsyncSelect
                value={reportingManager}
                onChange={setReportingManager}
                placeholder="Search employees…"
                loadOptions={async (query) => {
                  const results = await searchEmployees(query);
                  return results.map((employee) => ({
                    value: employee.id,
                    label: employee.full_name,
                    description: employee.employee_number,
                  }));
                }}
              />
            </Field>
            <Field label="Start date" htmlFor="start_date" error={errors.start_date?.message}>
              <DatePicker
                value={startDate}
                onChange={(value) => setValue('start_date', value, { shouldDirty: true, shouldValidate: true })}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onboarding</CardTitle>
          </CardHeader>
          <CardBody>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border" {...register('send_invitation')} />
              <span>
                <span className="block font-medium text-strong">Send invitation</span>
                <span className="block text-muted">
                  Generates a link the employee uses to set a password and complete their profile &mdash; email delivery
                  isn't wired up yet, so you'll get the link to share yourself. Leave this unchecked to create a draft
                  record you can invite later.
                </span>
              </span>
            </label>
          </CardBody>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            <UserPlus className="h-3.5 w-3.5" />
            Create employee
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/employees')}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </form>

      <Modal
        open={Boolean(invitationLink)}
        onClose={closeInvitationModal}
        title="Invitation link ready"
        footer={
          <Button type="button" variant="primary" onClick={closeInvitationModal}>
            Continue to employee record
          </Button>
        }
      >
        <div className="space-y-4">
          <Alert tone="warning">
            This link is shown once and isn't emailed. Share it with the employee so they can set their password and
            activate their account.
          </Alert>
          {invitationLink && <CopyableSecret value={invitationLink.url} label="Copy invitation link" />}
        </div>
      </Modal>
    </div>
  );
}

export function EmployeeCreatePage() {
  return (
    <RequirePermission permission="employees.create">
      <EmployeeCreateContent />
    </RequirePermission>
  );
}
