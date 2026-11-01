import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, MessageCircle, Phone, PhoneCall, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/apiClient';
import { useDepartmentOptions, useEmployeeDirectory } from '@/features/employees/api';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function MyDirectoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, moduleByKey } = useAuth();
  const userId = session?.user.id;
  const connectEnabled = moduleByKey('connect')?.can_access === true;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // undefined = "not chosen yet" — the backend resolves this to the
  // viewer's own department on first load; we sync it into local state
  // once known so the filter reflects what's actually applied.
  const [department, setDepartment] = useState<number | 'all' | undefined>(undefined);

  const departmentsQuery = useDepartmentOptions();
  const query = useEmployeeDirectory({ search: search || undefined, department_id: department, page, per_page: 24 });
  const entries = query.data?.data ?? [];
  const scope = query.data?.scope;

  // Message and Call both start from the same direct conversation — Connect
  // dedupes it server-side, so reopening an existing thread with this
  // colleague is as cheap as creating a new one.
  const message = useMutation({
    mutationFn: async (userId: number) => {
      const { data } = await api.post<{ data: { id: string } }>('/connect/conversations', { kind: 'direct', member_ids: [userId] });
      return data.id;
    },
    onSuccess: (id) => navigate(`/connect/chat/${id}`),
    onError: (error) => toast.error('Could not open conversation', error instanceof ApiError ? error.message : 'Please try again.'),
  });
  const call = useMutation({
    mutationFn: async (userId: number) => {
      const { data } = await api.post<{ data: { id: string } }>('/connect/conversations', { kind: 'direct', member_ids: [userId] });
      await api.post('/connect/calls', { conversation_id: data.id });
      return data.id;
    },
    onSuccess: (id) => navigate(`/connect/chat/${id}`),
    onError: (error) => toast.error('Could not start call', error instanceof ApiError ? error.message : 'Please try again.'),
  });

  useEffect(() => {
    if (department === undefined && scope) {
      setDepartment(scope.department_id ?? 'all');
    }
  }, [department, scope]);

  const departmentOptions = [
    { value: 'all', label: 'All departments' },
    ...(departmentsQuery.data ?? []).map((dept) => ({ value: String(dept.id), label: dept.name })),
  ];

  return (
    <div>
      <PageHeader title="Directory" subtitle="Find and reach colleagues — starting with your own department." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <div className="sm:w-56">
          <SelectMenu
            value={department === undefined ? '' : String(department)}
            onChange={(value) => {
              setDepartment(value === 'all' ? 'all' : Number(value));
              setPage(1);
            }}
            options={departmentOptions}
          />
        </div>
      </div>

      {query.isLoading && <LoadingState label="Loading directory..." fill />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {query.data && entries.length === 0 && (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No colleagues found" description="Try a different search or department." />
      )}

      {entries.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const canConnect = connectEnabled && entry.user_id !== null && entry.user_id !== userId;
            return (
            <Card key={entry.id} className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-teal/10 font-display text-xs font-semibold text-teal">
                {initials(entry.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-strong">{entry.full_name}</p>
                    <p className="truncate text-xs text-muted">
                      {entry.designation ?? 'No designation'}
                      {entry.department ? ` · ${entry.department.name}` : ''}
                    </p>
                  </div>
                  {canConnect && (
                    <div className="flex flex-none gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Message ${entry.full_name}`}
                        title={`Message ${entry.full_name}`}
                        isLoading={message.isPending && message.variables === entry.user_id}
                        onClick={() => message.mutate(entry.user_id!)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Call ${entry.full_name}`}
                        title={`Call ${entry.full_name}`}
                        isLoading={call.isPending && call.variables === entry.user_id}
                        onClick={() => call.mutate(entry.user_id!)}
                      >
                        <PhoneCall className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <a href={`mailto:${entry.work_email}`} className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-teal">
                    <Mail className="h-3 w-3 flex-none" />
                    <span className="truncate">{entry.work_email}</span>
                  </a>
                  {entry.phone && (
                    <a href={`tel:${entry.phone}`} className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-teal">
                      <Phone className="h-3 w-3 flex-none" />
                      <span className="truncate">{entry.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {query.data && <Pagination meta={query.data.meta} onPageChange={setPage} />}
    </div>
  );
}
