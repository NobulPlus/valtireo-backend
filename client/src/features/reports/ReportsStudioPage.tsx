import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  CalendarDays,
  Download,
  FileDown,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { api, apiClient, ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { useDateFormatter } from '@/lib/dateFormat';

type ReportRow = Record<string, string | number | null | undefined>;

interface ReportDefinition {
  key: string;
  name: string;
  module: string;
  description: string;
  filters: string[];
}

interface ReportPreview {
  report: ReportDefinition;
  filters: Record<string, string>;
  data: ReportRow[];
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
  };
}

const MODULE_LABELS: Record<string, string> = {
  employees: 'People',
  documents: 'Documents',
  leave: 'Leave',
  attendance: 'Attendance',
  service_desk: 'Service Desk',
  assets: 'Assets',
};

const SELECT_FILTERS: Record<string, Array<{ value: string; label: string }>> = {
  status: [
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'invited', label: 'Invited' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
    { value: 'late', label: 'Late' },
    { value: 'absent', label: 'Absent' },
    { value: 'maintenance', label: 'Maintenance' },
  ],
  confirmation_status: [
    { value: '', label: 'All confirmations' },
    { value: 'probation', label: 'Probation' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_applicable', label: 'Not applicable' },
  ],
  profile_status: [
    { value: '', label: 'All profile statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'changes_requested', label: 'Changes requested' },
  ],
  priority: [
    { value: '', label: 'All priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ],
  source: [
    { value: '', label: 'All sources' },
    { value: 'manual', label: 'Manual' },
    { value: 'employee', label: 'Employee' },
    { value: 'import', label: 'Import' },
    { value: 'system', label: 'System' },
  ],
  condition: [
    { value: '', label: 'All conditions' },
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'damaged', label: 'Damaged' },
  ],
};

const DATE_RANGE_PAIRS = [
  ['date_from', 'date_to', 'Date range'],
  ['submitted_from', 'submitted_to', 'Submitted range'],
  ['expires_from', 'expires_to', 'Expiry range'],
  ['purchase_from', 'purchase_to', 'Purchase range'],
  ['warranty_from', 'warranty_to', 'Warranty range'],
  ['assigned_from', 'assigned_to', 'Assigned range'],
  ['returned_from', 'returned_to', 'Returned range'],
] as const;

function titleCase(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function compactParams(filters: Record<string, string>, page: number): Record<string, string | number> {
  return Object.entries(filters).reduce<Record<string, string | number>>(
    (params, [key, value]) => {
      if (value !== '') params[key] = value;
      return params;
    },
    { page, per_page: 15 },
  );
}

function rowColumns(rows: ReportRow[]): string[] {
  const priority = ['employee_number', 'full_name', 'asset_tag', 'name', 'status', 'category', 'department'];
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return keys.sort((a, b) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    return a.localeCompare(b);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function ReportsStudioPage() {
  const toast = useToast();
  const { formatDate, formatDateTime } = useDateFormatter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ['reports', 'catalog'],
    queryFn: () => api.get<{ data: ReportDefinition[] }>('/reports'),
  });

  const reports = useMemo(() => reportsQuery.data?.data ?? [], [reportsQuery.data]);
  const selected = useMemo(() => reports.find((report) => report.key === selectedKey) ?? reports[0] ?? null, [reports, selectedKey]);
  const activeFilters = useMemo(() => compactParams(filters, page), [filters, page]);

  const previewQuery = useQuery({
    queryKey: ['reports', 'preview', selected?.key, activeFilters],
    queryFn: () => api.get<ReportPreview>(`/reports/${selected?.key}`, { params: activeFilters }),
    enabled: Boolean(selected),
  });

  const previewRows = previewQuery.data?.data ?? [];
  const columns = rowColumns(previewRows).filter((column) => column !== 'id' && column !== 'employee_id');
  const reportFilters = selected?.filters ?? [];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const datePair = DATE_RANGE_PAIRS.find(([from, to]) => reportFilters.includes(from) && reportFilters.includes(to));
  const selectFilters = reportFilters.filter((filter) => SELECT_FILTERS[filter]);
  const advancedFilters = reportFilters.filter(
    (filter) =>
      !['search', 'sort_by', 'sort_direction'].includes(filter) &&
      !selectFilters.includes(filter) &&
      !DATE_RANGE_PAIRS.some(([from, to]) => filter === from || filter === to),
  );

  function setFilter(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters({});
    setPage(1);
  }

  async function exportReport() {
    if (!selected) return;
    setExporting(true);
    try {
      const response = await apiClient.get(`/reports/${selected.key}/export`, {
        params: compactParams(filters, page),
        responseType: 'blob',
      });
      downloadBlob(new Blob([response.data]), `${selected.key}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Report exported', `${selected.name} was downloaded with the current filters.`);
    } catch (error) {
      toast.error('Could not export report', error instanceof ApiError ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function formatCell(key: string, value: ReportRow[string]) {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'status' || key.endsWith('_status') || key === 'priority') return <StatusBadge status={String(value)} />;
    if (key.endsWith('_at')) return formatDateTime(String(value));
    if (key.endsWith('_date') || key.endsWith('_on')) return formatDate(String(value));
    return String(value);
  }

  return (
    <div>
      <PageHeader title="Reports studio" subtitle="Preview, filter, sort, and export operational reports from one workspace." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Available reports" value={reports.length} icon={BarChart3} />
        <StatTile label="Modules covered" value={new Set(reports.map((report) => report.module)).size} icon={Table2} />
        <StatTile label="Rows in preview" value={previewQuery.data?.meta.total ?? '—'} icon={Filter} />
        <StatTile label="Active filters" value={activeFilterCount} icon={SlidersHorizontal} tone={activeFilterCount ? 'warning' : 'default'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Report library</CardTitle>
            <FileDown className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody className="p-0">
            {reportsQuery.isLoading && <LoadingState label="Loading reports..." />}
            {reportsQuery.isError && <ErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />}
            {reports.length === 0 && !reportsQuery.isLoading ? (
              <EmptyState title="No reports available" description="Reports appear when modules and permissions are enabled." />
            ) : (
              <div className="divide-y divide-border">
                {reports.map((report) => {
                  const active = selected?.key === report.key;
                  return (
                    <button
                      key={report.key}
                      type="button"
                      onClick={() => {
                        setSelectedKey(report.key);
                        setFilters({});
                        setPage(1);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors hover:bg-surface-soft',
                        active && 'bg-teal/10',
                      )}
                    >
                      <p className="text-sm font-semibold text-strong">{report.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{report.description}</p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-teal">
                        {MODULE_LABELS[report.module] ?? titleCase(report.module)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{selected?.name ?? 'Select a report'}</CardTitle>
                {selected && <p className="mt-1 text-xs leading-5 text-muted">{selected.description}</p>}
              </div>
              <Button type="button" variant="primary" onClick={exportReport} isLoading={exporting} disabled={!selected}>
                {!exporting && <Download className="h-4 w-4" />}
                Report
              </Button>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,0.8fr))_auto]">
                {reportFilters.includes('search') && (
                  <Field label="Search">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
                      <Input
                        value={filters.search ?? ''}
                        onChange={(event) => setFilter('search', event.target.value)}
                        placeholder="Name, number, asset, ticket..."
                        className="pl-9"
                      />
                    </div>
                  </Field>
                )}

                {selectFilters.slice(0, 2).map((filter) => (
                  <Field key={filter} label={titleCase(filter)}>
                    <SelectMenu
                      value={filters[filter] ?? ''}
                      onChange={(value) => setFilter(filter, value)}
                      options={SELECT_FILTERS[filter]}
                    />
                  </Field>
                ))}

                {datePair && (
                  <>
                    <Field label={`${datePair[2]} from`}>
                      <DatePicker value={filters[datePair[0]] ?? ''} onChange={(value) => setFilter(datePair[0], value)} />
                    </Field>
                    <Field label="To">
                      <DatePicker value={filters[datePair[1]] ?? ''} onChange={(value) => setFilter(datePair[1], value)} />
                    </Field>
                  </>
                )}

                <div className="flex items-end gap-2">
                  <Button type="button" size="icon" onClick={() => previewQuery.refetch()} title="Refresh preview" aria-label="Refresh preview">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" onClick={resetFilters} title="Clear filters" aria-label="Clear filters">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {reportFilters.includes('sort_by') && (
                  <SelectMenu
                    value={filters.sort_by ?? ''}
                    onChange={(value) => setFilter('sort_by', value)}
                    placeholder="Sort field"
                    className="w-56"
                    options={[
                      { value: '', label: 'Default sort' },
                      ...columns.slice(0, 10).map((column) => ({ value: column, label: titleCase(column) })),
                    ]}
                  />
                )}
                {reportFilters.includes('sort_direction') && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setFilter('sort_direction', filters.sort_direction === 'asc' ? 'desc' : 'asc')}
                  >
                    {filters.sort_direction === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
                    {filters.sort_direction === 'asc' ? 'Ascending' : 'Descending'}
                  </Button>
                )}
                {advancedFilters.length > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setAdvancedOpen((current) => !current)}>
                    <SlidersHorizontal className="h-4 w-4" />
                    {advancedOpen ? 'Hide advanced' : 'Advanced filters'}
                  </Button>
                )}
              </div>

              {advancedOpen && advancedFilters.length > 0 && (
                <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface-soft p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {advancedFilters.map((filter) => (
                    <Field key={filter} label={titleCase(filter)}>
                      <Input
                        value={filters[filter] ?? ''}
                        onChange={(event) => setFilter(filter, event.target.value)}
                        placeholder="Enter value"
                      />
                    </Field>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted">
                <CalendarDays className="h-3.5 w-3.5" />
                {previewQuery.data?.meta.total ?? 0} row{previewQuery.data?.meta.total === 1 ? '' : 's'}
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {previewQuery.isLoading && <LoadingState label="Loading preview..." />}
              {previewQuery.isError && <ErrorState error={previewQuery.error} onRetry={() => previewQuery.refetch()} />}
              {!previewQuery.isLoading && previewRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No rows match this report" description="Adjust filters or choose another report." />
                </div>
              ) : (
                previewRows.length > 0 && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-soft text-xs uppercase text-muted">
                            {columns.map((column) => (
                              <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">
                                {titleCase(column)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, index) => (
                            <tr key={String(row.id ?? `${selected?.key}-${index}`)} className="border-b border-border last:border-0">
                              {columns.map((column) => (
                                <td key={column} className="max-w-[260px] whitespace-nowrap px-4 py-3 text-strong">
                                  <span className="block truncate">{formatCell(column, row[column])}</span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {previewQuery.data && (
                      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
                        <span>
                          Showing {previewQuery.data.meta.from ?? 0}-{previewQuery.data.meta.to ?? 0} of {previewQuery.data.meta.total}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button type="button" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page">
                            ←
                          </Button>
                          <span>
                            {previewQuery.data.meta.current_page} / {previewQuery.data.meta.last_page}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            disabled={page >= previewQuery.data.meta.last_page}
                            onClick={() => setPage((current) => current + 1)}
                            aria-label="Next page"
                          >
                            →
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
