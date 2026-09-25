import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserX } from 'lucide-react';
import { useOrgChart } from '@/features/employees/api';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { OrgChartNode } from '@/types/api';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

interface TreeIndex {
  byId: Map<number, OrgChartNode>;
  childrenOf: Map<number, OrgChartNode[]>;
}

function buildIndex(nodes: OrgChartNode[]): TreeIndex {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenOf = new Map<number, OrgChartNode[]>();

  for (const node of nodes) {
    const managerId = node.reporting_manager_id;
    if (managerId !== null && byId.has(managerId)) {
      const siblings = childrenOf.get(managerId) ?? [];
      siblings.push(node);
      childrenOf.set(managerId, siblings);
    }
  }

  return { byId, childrenOf };
}

function PersonNode({
  node,
  index,
  depth,
  readOnly,
}: {
  node: OrgChartNode;
  index: TreeIndex;
  depth: number;
  readOnly: boolean;
}) {
  const navigate = useNavigate();
  const children = index.childrenOf.get(node.id) ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={readOnly ? undefined : () => navigate(`/employees/${node.id}`)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2 text-left transition-colors',
          readOnly ? 'cursor-default' : 'hover:bg-surface-soft',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-8 flex-none items-center justify-center rounded-full font-display text-[11px] font-semibold',
            node.is_department_head ? 'bg-teal text-white' : 'bg-teal/10 text-teal',
          )}
        >
          {initials(node.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-strong">{node.full_name}</span>
            {node.is_department_head && (
              <ShieldCheck className="h-3.5 w-3.5 flex-none text-teal" aria-label="Department head" />
            )}
            {!readOnly && !node.has_login && (
              <UserX className="h-3.5 w-3.5 flex-none text-warning" aria-label="No login yet" />
            )}
          </span>
          <span className="block truncate text-[11px] text-muted">
            {node.designation ?? 'No designation'}
            {node.role_name ? ` · ${node.role_name}` : ''}
          </span>
        </span>
      </button>
      {children.length > 0 && (
        <div className="ml-4 space-y-0.5 border-l border-border pl-4">
          {children.map((child) => (
            <PersonNode key={child.id} node={child} index={index} depth={depth + 1} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChartView({ readOnly = false }: { readOnly?: boolean }) {
  const { data, isLoading, isError, error, refetch } = useOrgChart();

  const departments = useMemo(() => {
    if (!data) return [];

    const index = buildIndex(data);
    const roots = data.filter(
      (node) => node.reporting_manager_id === null || !index.byId.has(node.reporting_manager_id),
    );

    const groups = new Map<string, { id: number | null; name: string; roots: OrgChartNode[] }>();
    for (const root of roots) {
      const key = root.department ? String(root.department.id) : 'unassigned';
      const group = groups.get(key) ?? {
        id: root.department?.id ?? null,
        name: root.department?.name ?? 'Unassigned',
        roots: [],
      };
      group.roots.push(root);
      groups.set(key, group);
    }

    return Array.from(groups.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => ({ ...group, index }));
  }, [data]);

  if (isLoading) return <LoadingState label="Loading org chart..." fill />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No active employees yet" description="The org chart fills in once employees are active and assigned to departments." />;
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {departments.map((department) => (
        <Card key={department.id ?? 'unassigned'}>
          <CardHeader>
            <CardTitle>{department.name}</CardTitle>
            <span className="text-xs text-muted">
              {department.roots.length} head{department.roots.length === 1 ? '' : 's'}
            </span>
          </CardHeader>
          <CardBody className="space-y-3">
            {department.roots.map((root) => (
              <PersonNode key={root.id} node={root} index={department.index} depth={0} readOnly={readOnly} />
            ))}
            {!readOnly && !department.roots.some((root) => root.is_department_head) && (
              <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
                No one in this department holds department-head approval authority yet.
              </p>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
