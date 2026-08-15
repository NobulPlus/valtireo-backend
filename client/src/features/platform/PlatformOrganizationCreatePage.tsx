import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, ShieldPlus, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { CopyableSecret } from '@/components/ui/CopyableSecret';
import { CreatableSelect } from '@/components/ui/CreatableSelect';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useCreateOrganization, usePlatformModuleCatalog } from '@/features/platform/api';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { COUNTRIES } from '@/lib/countries';
import { hasCuratedStates, STATES_BY_COUNTRY } from '@/lib/statesByCountry';
import type { ProvisionOrganizationResponse } from '@/types/api';

const COUNTRY_OPTIONS: SelectMenuOption[] = COUNTRIES.map((country) => ({ value: country, label: country }));

const SECTOR_OPTIONS = [
  'Agriculture',
  'Banking & Financial Services',
  'Education',
  'Energy & Utilities',
  'Government & Public Sector',
  'Healthcare',
  'Hospitality & Tourism',
  'Insurance',
  'Legal Services',
  'Logistics & Distribution',
  'Manufacturing',
  'Media & Entertainment',
  'Non-Profit / NGO',
  'Professional Services',
  'Real Estate & Construction',
  'Retail & Consumer Goods',
  'Technology',
  'Telecommunications',
];

const schema = z.object({
  orgName: z.string().min(1, 'Organization name is required'),
  orgCode: z
    .string()
    .min(1, 'Organization code is required')
    .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, dashes, and underscores only'),
  orgCountry: z.string().min(1, 'Country is required'),
  orgEmail: z.string().trim().email('Enter a valid email address').or(z.literal('')).optional(),
  orgPhone: z.string().optional(),
  orgWebsite: z.string().optional(),
  orgSector: z.string().optional(),
  orgAddress: z.string().optional(),
  orgCity: z.string().optional(),
  orgState: z.string().optional(),
  adminName: z.string().min(1, "Admin's name is required"),
  adminEmail: z.string().min(1, "Admin's email is required").email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

const DIACRITIC_MARKS = /[\u0300-\u036f]/g;

function deriveOrgCode(name: string): string {
  return name
    .normalize('NFKD')
    .replace(DIACRITIC_MARKS, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 30);
}

const SERVER_FIELD_MAP: Partial<Record<string, keyof FormValues>> = {
  'organization.name': 'orgName',
  'organization.code': 'orgCode',
  'organization.email': 'orgEmail',
  'organization.phone': 'orgPhone',
  'organization.website': 'orgWebsite',
  'organization.sector': 'orgSector',
  'organization.country': 'orgCountry',
  'organization.state': 'orgState',
  'organization.city': 'orgCity',
  'organization.address': 'orgAddress',
  'admin.name': 'adminName',
  'admin.email': 'adminEmail',
};

function ProvisionSuccess({ result, onCreateAnother }: { result: ProvisionOrganizationResponse; onCreateAnother: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {result.organization.name} is provisioned
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <Alert tone="warning">
          This temporary password is shown once and is not emailed. Share it securely with{' '}
          {result.admin.name} now &mdash; it cannot be retrieved again from the console.
        </Alert>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-muted">Organization code</p>
            <p className="mt-1 text-sm font-medium text-strong">{result.organization.code}</p>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-muted">Organization admin</p>
            <p className="mt-1 text-sm font-medium text-strong">
              {result.admin.name} &middot; {result.admin.email}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Temporary password</p>
          <CopyableSecret value={result.invitation.temporary_password} label="Copy password" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/platform/organizations/${result.organization.id}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[var(--workspace-button,var(--color-pine))] px-4 text-sm font-medium text-white hover:brightness-95"
          >
            Go to organization
          </Link>
          <Button type="button" variant="secondary" onClick={onCreateAnother}>
            Provision another
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function PlatformOrganizationCreateForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const modulesQuery = usePlatformModuleCatalog();
  const createMutation = useCreateOrganization();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionOrganizationResponse | null>(null);

  const orgCodeEditedRef = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orgName: '',
      orgCode: '',
      orgCountry: '',
      orgEmail: '',
      orgPhone: '',
      orgWebsite: '',
      orgSector: '',
      orgAddress: '',
      orgCity: '',
      orgState: '',
      adminName: '',
      adminEmail: '',
    },
  });

  const orgName = watch('orgName');
  const orgCountry = watch('orgCountry');
  const orgSector = watch('orgSector') ?? '';
  const orgPhone = watch('orgPhone') ?? '';
  const orgState = watch('orgState') ?? '';
  const curatedStates = hasCuratedStates(orgCountry) ? STATES_BY_COUNTRY[orgCountry] : null;

  useEffect(() => {
    if (orgCodeEditedRef.current) return;
    setValue('orgCode', deriveOrgCode(orgName ?? ''), { shouldValidate: false });
  }, [orgName, setValue]);

  function toggleModule(key: string) {
    setSelectedModules((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));
  }

  async function onSubmit(values: FormValues) {
    if (selectedModules.length === 0) {
      setModuleError('Select at least one module to subscribe this organization to.');
      return;
    }

    setModuleError(null);

    try {
      const result = await createMutation.mutateAsync({
        organization: {
          name: values.orgName,
          code: values.orgCode,
          email: values.orgEmail || null,
          phone: values.orgPhone || null,
          website: values.orgWebsite || null,
          sector: values.orgSector || null,
          country: values.orgCountry,
          state: values.orgState || null,
          city: values.orgCity || null,
          address: values.orgAddress || null,
        },
        admin: {
          name: values.adminName,
          email: values.adminEmail,
        },
        modules: selectedModules,
      });

      toast.success('Organization provisioned', `${result.organization.name} is ready to onboard.`);
      setProvisionResult(result);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        let firstUnmapped: string | null = null;

        Object.entries(error.errors).forEach(([field, messages]) => {
          const mapped = SERVER_FIELD_MAP[field];
          if (mapped) {
            setError(mapped, { message: messages[0] });
          } else {
            firstUnmapped ??= messages[0];
          }
        });

        if (firstUnmapped) setModuleError(firstUnmapped);
        toast.error('Could not provision organization', error.message);
      } else if (error instanceof ApiError) {
        toast.error('Could not provision organization', error.message);
      } else {
        toast.error('Could not provision organization', 'Something went wrong. Please try again.');
      }
    }
  }

  function handleCreateAnother() {
    setProvisionResult(null);
    setSelectedModules([]);
    setModuleError(null);
    orgCodeEditedRef.current = false;
    reset();
  }

  if (provisionResult) {
    return <ProvisionSuccess result={provisionResult} onCreateAnother={handleCreateAnother} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Organization name" htmlFor="orgName" error={errors.orgName?.message} required>
            <Input id="orgName" invalid={Boolean(errors.orgName)} {...register('orgName')} />
          </Field>
          <Field
            label="Organization code"
            htmlFor="orgCode"
            error={errors.orgCode?.message}
            hint="Auto-filled from the organization name until you edit it directly."
            required
          >
            <Input
              id="orgCode"
              invalid={Boolean(errors.orgCode)}
              {...register('orgCode', {
                onChange: () => {
                  orgCodeEditedRef.current = true;
                },
              })}
            />
          </Field>
          <Field label="Country" htmlFor="orgCountry" error={errors.orgCountry?.message} required>
            <SelectMenu
              value={orgCountry}
              onChange={(value) => {
                setValue('orgCountry', value, { shouldDirty: true, shouldValidate: true });
                setValue('orgState', '', { shouldDirty: true });
              }}
              options={COUNTRY_OPTIONS}
              placeholder="Select country"
              invalid={Boolean(errors.orgCountry)}
            />
          </Field>
          <Field label="Sector" htmlFor="orgSector" error={errors.orgSector?.message} hint="Pick a suggestion or type your own.">
            <CreatableSelect
              id="orgSector"
              value={orgSector}
              onChange={(value) => setValue('orgSector', value, { shouldDirty: true, shouldValidate: true })}
              options={SECTOR_OPTIONS}
              placeholder="e.g. Healthcare"
              invalid={Boolean(errors.orgSector)}
            />
          </Field>
          <Field label="Organization email" htmlFor="orgEmail" error={errors.orgEmail?.message}>
            <Input id="orgEmail" type="email" {...register('orgEmail')} />
          </Field>
          <Field label="Phone" htmlFor="orgPhone" error={errors.orgPhone?.message}>
            <PhoneInput
              id="orgPhone"
              value={orgPhone}
              onChange={(value) => setValue('orgPhone', value, { shouldDirty: true, shouldValidate: true })}
              invalid={Boolean(errors.orgPhone)}
            />
          </Field>
          <Field label="Website" htmlFor="orgWebsite" error={errors.orgWebsite?.message}>
            <Input id="orgWebsite" placeholder="https://" {...register('orgWebsite')} />
          </Field>
          <Field label="State" htmlFor="orgState" error={errors.orgState?.message}>
            {curatedStates ? (
              <SelectMenu
                value={orgState}
                onChange={(value) => setValue('orgState', value, { shouldDirty: true, shouldValidate: true })}
                options={curatedStates.map((state) => ({ value: state, label: state }))}
                placeholder="Select state"
                invalid={Boolean(errors.orgState)}
              />
            ) : (
              <Input id="orgState" {...register('orgState')} />
            )}
          </Field>
          <Field label="City" htmlFor="orgCity" error={errors.orgCity?.message}>
            <Input id="orgCity" {...register('orgCity')} />
          </Field>
          <Field label="Address" htmlFor="orgAddress" error={errors.orgAddress?.message} className="sm:col-span-2">
            <Input id="orgAddress" {...register('orgAddress')} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization admin</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Admin name" htmlFor="adminName" error={errors.adminName?.message} required>
            <Input id="adminName" invalid={Boolean(errors.adminName)} {...register('adminName')} />
          </Field>
          <Field label="Admin email" htmlFor="adminEmail" error={errors.adminEmail?.message} required>
            <Input id="adminEmail" type="email" invalid={Boolean(errors.adminEmail)} {...register('adminEmail')} />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">
            This person is created as the organization's first Organization Admin. A temporary password is shown once, right
            after provisioning &mdash; email delivery isn't wired up yet, so you'll need to share it yourself.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {modulesQuery.isLoading && <LoadingState label="Loading module catalog..." />}
          {modulesQuery.isError && <ErrorState error={modulesQuery.error} onRetry={() => modulesQuery.refetch()} />}
          {modulesQuery.data && modulesQuery.data.data.length === 0 && <EmptyState title="No modules available to assign" />}
          {modulesQuery.data?.data.map((module) => {
            const checked = selectedModules.includes(module.key);
            return (
              <label
                key={module.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors',
                  checked ? 'border-teal bg-teal/5' : 'border-border hover:bg-surface-soft',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={checked}
                  onChange={() => toggleModule(module.key)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-strong">{module.name}</span>
                  <span className="block text-xs text-muted">
                    {module.category ?? 'Uncategorized'}
                    {module.description ? ` · ${module.description}` : ''}
                  </span>
                </span>
              </label>
            );
          })}
          {moduleError && <Alert>{moduleError}</Alert>}
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" isLoading={isSubmitting || createMutation.isPending}>
          <ShieldPlus className="h-3.5 w-3.5" />
          Provision organization
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate('/platform')}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function PlatformOrganizationCreatePage() {
  return (
    <div>
      <PageHeader
        title="Provision organization"
        subtitle="Create a new customer workspace on behalf of Valtireo."
        breadcrumbs={[{ label: 'Platform console', to: '/platform' }, { label: 'Provision organization' }]}
        actions={
          <Link
            to="/platform"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3 text-sm font-medium text-strong hover:bg-surface-soft"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />
      <PlatformOrganizationCreateForm />
    </div>
  );
}
