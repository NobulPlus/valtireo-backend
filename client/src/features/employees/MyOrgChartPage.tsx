import { PageHeader } from '@/components/ui/PageHeader';
import { OrgChartView } from '@/features/employees/OrgChartView';

export function MyOrgChartPage() {
  return (
    <div>
      <PageHeader title="Org chart" subtitle="See how your organization is structured, department by department." />
      <OrgChartView readOnly />
    </div>
  );
}
