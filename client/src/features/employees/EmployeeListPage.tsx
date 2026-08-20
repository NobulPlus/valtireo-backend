import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  GripVertical,
  LayoutGrid,
  Mail,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  UserCog,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dropdown, DropdownMenuItem } from '@/components/ui/Dropdown';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { RequirePermission } from '@/components/shell/RequirePermission';
import { useAuth } from '@/context/AuthContext';
import { useSetupLookups } from '@/features/workspace/api';
import { downloadEmployeesCsv, useEmployees, useMoveEmployeeStatus, type EmployeeFilters } from '@/features/employees/api';
import { ApproveOnboardingModal } from '@/features/employees/ApproveOnboardingModal';
import { ChangeStatusModal } from '@/features/employees/ChangeStatusModal';
import { EMPLOYEE_STATUS_OPTIONS, isReadyForOnboardingApproval, statusLabel } from '@/features/employees/statusHelpers';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { Employee } from '@/types/api';

const BOARD_COLUMNS = [
  { status: 'draft', title: 'Draft', hint: 'Created by HR, not invited yet.' },
  { status: 'invited', title: 'Invited', hint: 'Invitation sent, waiting for acceptance.' },
  { status: 'onboarding', title: 'Onboarding', hint: 'Employee is completing profile.' },
  { status: 'active', title: 'Active', hint: 'Approved and operating.' },
  { status: 'probation', title: 'Probation', hint: 'Active lifecycle, under review.' },
  { status: 'confirmed', title: 'Confirmed', hint: 'Fully confirmed employee.' },
  { status: 'suspended', title: 'Suspended', hint: 'Temporarily restricted.' },
  { status: 'exited', title: 'Exited', hint: 'No longer active.' },
];
const BOARD_BATCH_SIZE = 5;

type ViewMode = 'board' | 'table';
type BoardVisibleCounts = Record<string, number>;

function lookupOptions<T extends { id: number; name: string }>(items: T[] | undefined, placeholder: string): SelectMenuOption[] {
  return [
    { value: '', label: placeholder },
    ...(items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

function today(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function EmployeeListContent() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const lookupsQuery = useSetupLookups();
  const moveStatus = useMoveEmployeeStatus();

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<number | null>(null);
  const [visibleBoardCounts, setVisibleBoardCounts] = useState<BoardVisibleCounts>(() =>
    Object.fromEntries(BOARD_COLUMNS.map((column) => [column.status, BOARD_BATCH_SIZE])),
  );
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [approveTarget, setApproveTarget] = useState<Employee | null>(null);

  const filters: EmployeeFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      department_id: departmentId ? Number(departmentId) : undefined,
      page: viewMode === 'table' ? page : 1,
      per_page: viewMode === 'table' ? 10 : 250,
    }),
    [debouncedSearch, status, departmentId, page, viewMode],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useEmployees(filters);

  useEffect(() => {
    setVisibleBoardCounts(Object.fromEntries(BOARD_COLUMNS.map((column) => [column.status, BOARD_BATCH_SIZE])));
  }, [debouncedSearch, status, departmentId]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadEmployeesCsv(filters);
    } finally {
      setExporting(false);
    }
  }

  async function handleDrop(targetStatus: string) {
    const employee = data?.data.find((item) => item.id === draggingEmployeeId);
    setDraggingEmployeeId(null);

    if (!employee || employee.status === targetStatus) {
      return;
    }

    if (targetStatus === 'invited' && employee.status === 'draft' && !employee.work_email) {
      toast.error('Invitation blocked', 'Add a work email before inviting this employee.');
      return;
    }

    if (employee.status === 'onboarding' && ['active', 'probation', 'confirmed'].includes(targetStatus)) {
      // Leaving onboarding needs a profile-readiness check and a starting-stage
      // choice that drag-and-drop has nowhere to collect — open the real
      // approval flow instead of letting this silently bypass it.
      setApproveTarget(employee);
      return;
    }

    if (targetStatus === 'probation') {
      // Moving into probation requires a probation_ends_at date, which
      // drag-and-drop has nowhere to collect — redirect to the form that has
      // the field instead of letting this 422.
      toast.error('Set a probation end date', 'Use "Change status" from the employee table to move someone into probation.');
      return;
    }

    try {
      await moveStatus.mutateAsync({
        employeeId: employee.id,
        new_status: targetStatus,
        effective_date: today(),
        reason: targetStatus === 'invited' ? 'Invitation sent from employee kanban board.' : 'Moved from employee kanban board.',
      });
      toast.success(
        targetStatus === 'invited' ? 'Invitation sent' : 'Employee moved',
        `${employee.full_name} moved to ${statusLabel(targetStatus)}.`,
      );
    } catch (error) {
      toast.error('Could not move employee', error instanceof ApiError ? error.message : 'The employee status could not be updated.');
    }
  }

  const boardGroups = useMemo(() => {
    const groups = Object.fromEntries(BOARD_COLUMNS.map((column) => [column.status, [] as Employee[]]));

    for (const employee of data?.data ?? []) {
      if (!groups[employee.status]) {
        groups[employee.status] = [];
      }

      groups[employee.status].push(employee);
    }

    return groups;
  }, [data]);

  function revealMoreCards(status: string) {
    const total = boardGroups[status]?.length ?? 0;
    setVisibleBoardCounts((current) => ({
      ...current,
      [status]: Math.min((current[status] ?? BOARD_BATCH_SIZE) + BOARD_BATCH_SIZE, total),
    }));
  }

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => (
        <div>
          <p className="font-medium text-strong">{row.full_name}</p>
          <p className="text-xs text-muted">{row.employee_number}</p>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => row.department?.name ?? '—' },
    { key: 'designation', header: 'Designation', render: (row) => row.designation?.name ?? '—' },
    { key: 'location', header: 'Location', render: (row) => row.location?.name ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'profile',
      header: 'Profile',
      render: (row) => (row.profile ? <StatusBadge status={row.profile.completion_status} /> : '—'),
    },
  ];

  if (hasPermission('employees.update')) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        // DataTable's onRowClick navigates the whole row, and Dropdown's
        // panel isn't a portal — without this, clicking a menu item would
        // bubble up and fire the row navigation in the same tick as the
        // action itself.
        <div onClick={(event) => event.stopPropagation()}>
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label={`Actions for ${row.full_name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          >
            <DropdownMenuItem icon={Eye} onClick={() => navigate(`/employees/${row.id}`)}>
              View details
            </DropdownMenuItem>
            <DropdownMenuItem icon={UserCog} onClick={() => setStatusTarget(row)}>
              Change status
            </DropdownMenuItem>
            {row.status === 'onboarding' && (
              <DropdownMenuItem
                icon={CheckCircle2}
                onClick={() => setApproveTarget(row)}
                disabled={!isReadyForOnboardingApproval(row)}
              >
                Approve onboarding
              </DropdownMenuItem>
            )}
          </Dropdown>
        </div>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Search, filter, and manage every employee record in your workspace."
        actions={
          <>
          <Button variant="secondary" onClick={handleExport} isLoading={exporting}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {hasPermission('employees.create') && (
              <Button variant="primary" onClick={() => navigate('/employees/new')}>
                <Plus className="h-3.5 w-3.5" /> Add employee
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, number, or email…"
              className="pl-9"
            />
          </div>
          <SelectMenu
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              ...EMPLOYEE_STATUS_OPTIONS.map((option) => ({ value: option, label: statusLabel(option) })),
            ]}
            className="sm:w-44"
          />
          <SelectMenu
            value={departmentId}
            onChange={(value) => {
              setDepartmentId(value);
              setPage(1);
            }}
            options={lookupOptions(lookupsQuery.data?.departments, 'All departments')}
            className="sm:w-52"
          />
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-white p-1 lg:w-24">
            <button
              type="button"
              onClick={() => {
                setViewMode('board');
                setPage(1);
              }}
              className={cn(
                'flex h-7 items-center justify-center rounded text-muted transition-colors hover:bg-surface-soft hover:text-strong',
                viewMode === 'board' && 'bg-teal/10 text-teal',
              )}
              aria-label="Kanban board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('table');
                setPage(1);
              }}
              className={cn(
                'flex h-7 items-center justify-center rounded text-muted transition-colors hover:bg-surface-soft hover:text-strong',
                viewMode === 'table' && 'bg-teal/10 text-teal',
              )}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading && <LoadingState label="Loading employees…" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && data.data.length === 0 && (
          <EmptyState
            icon={<UserRound className="h-6 w-6" />}
            title="No employees found"
            description="Try adjusting your filters, or add your first employee."
          />
        )}

        {data && data.data.length > 0 && viewMode === 'board' && (
          <div className={cn('overflow-x-auto p-4', isFetching && 'opacity-60 transition-opacity')}>
            <div className="grid min-w-[1180px] grid-cols-8 gap-3">
              {BOARD_COLUMNS.map((column) => {
                const employees = boardGroups[column.status] ?? [];
                const visibleCount = visibleBoardCounts[column.status] ?? BOARD_BATCH_SIZE;
                const visibleEmployees = employees.slice(0, visibleCount);
                const remainingCount = Math.max(employees.length - visibleEmployees.length, 0);

                return (
                  <section
                    key={column.status}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => void handleDrop(column.status)}
                    className="flex min-h-[520px] flex-col rounded-lg border border-border bg-surface-soft/70"
                  >
                    <div className="border-b border-border px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-strong">{column.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted">{column.hint}</p>
                        </div>
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-semibold text-strong">
                          {employees.length}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-2">
                      {employees.length === 0 ? (
                        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border bg-white/60 px-3 text-center text-xs text-muted">
                          Drop employees here
                        </div>
                      ) : (
                        <>
                          {visibleEmployees.map((employee) => (
                            <EmployeeKanbanCard
                              key={employee.id}
                              employee={employee}
                              draggable={hasPermission('employees.update')}
                              moving={moveStatus.isPending && draggingEmployeeId === employee.id}
                              onOpen={() => navigate(`/employees/${employee.id}`)}
                              onDragStart={() => setDraggingEmployeeId(employee.id)}
                              onDragEnd={() => setDraggingEmployeeId(null)}
                            />
                          ))}
                          {remainingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => revealMoreCards(column.status)}
                              className="rounded-md border border-dashed border-border bg-white/70 px-3 py-2 text-center text-xs font-medium text-muted transition-colors hover:border-teal hover:bg-teal/10 hover:text-teal"
                            >
                              Show {Math.min(BOARD_BATCH_SIZE, remainingCount)} more
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
            {data.meta.total > data.data.length && (
              <p className="mt-3 text-xs text-muted">
                Showing the first {data.data.length} matching employees on the board. Use table view for precise pagination.
              </p>
            )}
          </div>
        )}

        {data && data.data.length > 0 && viewMode === 'table' && (
          <>
            <div className={isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable
                columns={columns}
                rows={data.data}
                rowKey={(row) => row.id}
                onRowClick={(row) => navigate(`/employees/${row.id}`)}
              />
            </div>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {statusTarget && (
        <ChangeStatusModal employee={statusTarget} open onClose={() => setStatusTarget(null)} />
      )}
      {approveTarget && (
        <ApproveOnboardingModal employee={approveTarget} open onClose={() => setApproveTarget(null)} />
      )}
    </div>
  );
}

function EmployeeKanbanCard({
  employee,
  draggable,
  moving,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  employee: Employee;
  draggable: boolean;
  moving: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group rounded-md border border-border bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
        moving && 'opacity-60',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-strong group-hover:text-teal">{employee.full_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{employee.employee_number}</p>
        </button>
        {draggable && <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />}
      </div>

      <div className="space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{employee.department?.name ?? 'No department'}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <BriefcaseBusiness className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{employee.designation?.name ?? 'No designation'}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{employee.location?.name ?? 'No location'}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{employee.work_email || 'No work email'}</span>
        </p>
        {employee.probation_ends_at && (
          <p className={cn('flex items-center gap-1.5', new Date(employee.probation_ends_at) < new Date() && 'text-warning')}>
            <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Probation ends {new Date(employee.probation_ends_at).toLocaleDateString()}</span>
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={employee.status} />
        {employee.profile && <StatusBadge status={employee.profile.completion_status} />}
      </div>
    </article>
  );
}

export function EmployeeListPage() {
  return (
    <RequirePermission permission="employees.view">
      <EmployeeListContent />
    </RequirePermission>
  );
}
