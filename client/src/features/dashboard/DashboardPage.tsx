import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/cn';
import { OrganizationDashboardView } from '@/features/dashboard/OrganizationDashboardView';
import { ManagerDashboardView } from '@/features/dashboard/ManagerDashboardView';
import { MyDashboardView } from '@/features/dashboard/MyDashboardView';

type Tab = 'organization' | 'manager' | 'me';

const TAB_LABELS: Record<Tab, string> = {
  organization: 'Organization',
  manager: 'Manager',
  me: 'My dashboard',
};

const ORG_LEVEL_ROLES = [
  'Organization Admin',
  'HR Director',
  'HR Officer',
  'Compliance Officer',
  'ICT Admin',
];
const MANAGER_ROLES = ['Department Head', 'Supervisor'];

export function DashboardPage() {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const { hasPermission, hasAnyRole, session } = useAuth();

  const availableTabs: Tab[] = [
    ...(hasPermission('reports.view') ? (['organization'] as Tab[]) : []),
    ...(hasAnyRole([...ORG_LEVEL_ROLES, ...MANAGER_ROLES]) ? (['manager'] as Tab[]) : []),
    'me',
  ];

  const activeTab: Tab = (tab as Tab) && availableTabs.includes(tab as Tab) ? (tab as Tab) : availableTabs[0];

  if (!tab || !availableTabs.includes(tab as Tab)) {
    return <Navigate to={`/dashboard/${activeTab}`} replace />;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${session?.user.name.split(' ')[0] ?? ''}.`}
      />

      {availableTabs.length > 1 && (
        <div className="mb-5 flex items-center gap-1 border-b border-border">
          {availableTabs.map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => navigate(`/dashboard/${tabKey}`)}
              className={cn(
                'border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors',
                activeTab === tabKey
                  ? 'border-pine text-pine'
                  : 'border-transparent text-muted hover:text-strong',
              )}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'organization' && <OrganizationDashboardView />}
      {activeTab === 'manager' && <ManagerDashboardView />}
      {activeTab === 'me' && <MyDashboardView />}
    </div>
  );
}
