import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { ColumnChart, MultiLineTrendChart } from '@/components/ui/Charts';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useDateFormatter } from '@/lib/dateFormat';
import { useOrbitProjectReporting, type OrbitProject } from '@/features/orbit/api';

function formatHours(hours: number): string {
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function OrbitReportsPanel({ project }: { project: OrbitProject }) {
  const { data, isLoading } = useOrbitProjectReporting(project.id);
  const { formatDate } = useDateFormatter();

  if (isLoading) return <LoadingState fill />;
  if (!data) return null;

  const hasHistory = data.velocity.entries.length > 0 || data.sprint_summary.length > 0;
  const hasBurndown = data.active_sprint_burndown !== null;

  if (!hasHistory && !hasBurndown) {
    return (
      <EmptyState
        title="No delivery history yet"
        description="Complete a sprint to start seeing velocity, cycle time, and burndown metrics here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hasHistory && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Avg velocity" value={data.velocity.average_points ?? '—'} />
            <StatTile label="Median velocity" value={data.velocity.median_points ?? '—'} />
            <StatTile
              label={`Avg cycle time${data.cycle_time.sample_size > 0 ? ` (n=${data.cycle_time.sample_size})` : ''}`}
              value={data.cycle_time.average_hours !== null ? formatHours(data.cycle_time.average_hours) : '—'}
            />
            <StatTile label="Completed sprints" value={data.sprint_summary.length} />
          </div>

          {data.velocity.entries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Velocity by sprint</CardTitle>
              </CardHeader>
              <CardBody>
                <ColumnChart
                  entries={data.velocity.entries.map((entry) => ({ id: entry.id, label: entry.label, value: entry.value }))}
                  valueLabel="points"
                />
              </CardBody>
            </Card>
          )}

          {data.sprint_summary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sprint summary</CardTitle>
              </CardHeader>
              <CardBody className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-5 py-2.5">Sprint</th>
                      <th className="px-5 py-2.5">Ended</th>
                      <th className="px-5 py-2.5 text-right">Committed</th>
                      <th className="px-5 py-2.5 text-right">Done</th>
                      <th className="px-5 py-2.5 text-right">Carried over</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sprint_summary.map((sprint) => (
                      <tr key={sprint.iteration_id} className="border-b border-border last:border-0">
                        <td className="px-5 py-2.5 font-medium text-strong">{sprint.name}</td>
                        <td className="px-5 py-2.5 text-muted">{formatDate(sprint.ends_at)}</td>
                        <td className="px-5 py-2.5 text-right text-strong">
                          {sprint.committed_count} items · {sprint.committed_points} pts
                        </td>
                        <td className="px-5 py-2.5 text-right text-strong">
                          {sprint.done_count} items · {sprint.done_points} pts
                        </td>
                        <td className="px-5 py-2.5 text-right text-muted">
                          {sprint.carried_over_count} items · {sprint.carried_over_points} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}

          {data.cycle_time.by_type.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cycle time by type</CardTitle>
              </CardHeader>
              <CardBody>
                <ColumnChart
                  entries={data.cycle_time.by_type.map((row) => ({ label: row.type, value: row.average_hours }))}
                  valueLabel="hours"
                />
              </CardBody>
            </Card>
          )}
        </>
      )}

      {data.active_sprint_burndown && (
        <Card>
          <CardHeader>
            <CardTitle>{data.active_sprint_burndown.name} burndown</CardTitle>
          </CardHeader>
          <CardBody>
            <MultiLineTrendChart
              valueLabel="points remaining"
              entries={data.active_sprint_burndown.series.map((entry) => ({ label: entry.label, values: entry.values }))}
              series={[
                { key: 'ideal', label: 'Ideal', color: 'var(--color-info)' },
                { key: 'actual', label: 'Actual', color: 'var(--color-teal)' },
              ]}
            />
            <p className="mt-3 text-xs text-muted">{data.active_sprint_burndown.approximation_note}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
