import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/shell/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Route-level code-splitting. Every route below used to be a static import, so
 * visiting /login — before there's even a session — pulled down the entire
 * app's JS in one ~1.7MB chunk (Connect's LiveKit client, charts, every admin
 * page, all of it) before the login form could render. A reasonable idea.
 * Fine on localhost; punishing on a staging host with real network latency
 * and no CDN warm cache yet, which is exactly where this was reported as
 * "login takes a while." Named-export modules need the .then() unwrap since
 * React.lazy only understands a default export.
 */
function namedLazy<M, K extends keyof M>(
  factory: () => Promise<M>,
  name: K,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): M[K] extends ComponentType<any> ? React.LazyExoticComponent<M[K]> : never {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(() => factory().then((module) => ({ default: module[name] as ComponentType<any> }))) as never;
}

const AppShell = namedLazy(() => import('@/components/shell/AppShell'), 'AppShell');
const AcceptInvitationPage = namedLazy(() => import('@/features/auth/AcceptInvitationPage'), 'AcceptInvitationPage');
const DashboardPage = namedLazy(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage');
const EmployeeListPage = namedLazy(() => import('@/features/employees/EmployeeListPage'), 'EmployeeListPage');
const EmployeeCreatePage = namedLazy(() => import('@/features/employees/EmployeeCreatePage'), 'EmployeeCreatePage');
const EmployeeDetailPage = namedLazy(() => import('@/features/employees/EmployeeDetailPage'), 'EmployeeDetailPage');
const MyProfilePage = namedLazy(() => import('@/features/profile/MyProfilePage'), 'MyProfilePage');
const MyLeavePage = namedLazy(() => import('@/features/leave/MyLeavePage'), 'MyLeavePage');
const MyTicketsPage = namedLazy(() => import('@/features/tickets/MyTicketsPage'), 'MyTicketsPage');
const TicketQueuePage = namedLazy(() => import('@/features/tickets/TicketQueuePage'), 'TicketQueuePage');
const AssetManagementPage = namedLazy(() => import('@/features/assets/AssetManagementPage'), 'AssetManagementPage');
const MyAssetsPage = namedLazy(() => import('@/features/assets/MyAssetsPage'), 'MyAssetsPage');
const PayrollControlPage = namedLazy(() => import('@/features/payroll/PayrollControlPage'), 'PayrollControlPage');
const MyPayslipsPage = namedLazy(() => import('@/features/payroll/MyPayslipsPage'), 'MyPayslipsPage');
const OperationsCenterPage = namedLazy(() => import('@/features/operations/OperationsCenterPage'), 'OperationsCenterPage');
const MyAttendancePage = namedLazy(() => import('@/features/attendance/MyAttendancePage'), 'MyAttendancePage');
const MyOrgChartPage = namedLazy(() => import('@/features/employees/MyOrgChartPage'), 'MyOrgChartPage');
const MyDirectoryPage = namedLazy(() => import('@/features/employees/MyDirectoryPage'), 'MyDirectoryPage');
const NotificationsPage = namedLazy(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage');
const CalendarPage = namedLazy(() => import('@/features/calendar/CalendarPage'), 'CalendarPage');
const PlatformDashboardPage = namedLazy(() => import('@/features/platform/PlatformDashboardPage'), 'PlatformDashboardPage');
const PlatformOrganizationCreatePage = namedLazy(() => import('@/features/platform/PlatformOrganizationCreatePage'), 'PlatformOrganizationCreatePage');
const PlatformOrganizationDetailPage = namedLazy(() => import('@/features/platform/PlatformOrganizationDetailPage'), 'PlatformOrganizationDetailPage');
const PlatformErrorLogsPage = namedLazy(() => import('@/features/platform/PlatformErrorLogsPage'), 'PlatformErrorLogsPage');
const PlatformPermissionCatalogPage = namedLazy(() => import('@/features/platform/PlatformPermissionCatalogPage'), 'PlatformPermissionCatalogPage');
const AuditActivityPage = namedLazy(() => import('@/features/audit/AuditActivityPage'), 'AuditActivityPage');
const ControlCenterPage = namedLazy(() => import('@/features/settings/ControlCenterPage'), 'ControlCenterPage');
const CustomFieldsPage = namedLazy(() => import('@/features/settings/CustomFieldsPage'), 'CustomFieldsPage');
const RolesPermissionsPage = namedLazy(() => import('@/features/settings/RolesPermissionsPage'), 'RolesPermissionsPage');
const ReportsStudioPage = namedLazy(() => import('@/features/reports/ReportsStudioPage'), 'ReportsStudioPage');
const ApprovalsControlPage = namedLazy(() => import('@/features/settings/SetupDataPages'), 'ApprovalsControlPage');
const AttendanceControlPage = namedLazy(() => import('@/features/settings/SetupDataPages'), 'AttendanceControlPage');
const DocumentsControlPage = namedLazy(() => import('@/features/settings/SetupDataPages'), 'DocumentsControlPage');
const LeaveControlPage = namedLazy(() => import('@/features/settings/SetupDataPages'), 'LeaveControlPage');
const StructureSettingsPage = namedLazy(() => import('@/features/settings/SetupDataPages'), 'StructureSettingsPage');
const WorkspacePage = namedLazy(() => import('@/features/workspace/WorkspacePage'), 'WorkspacePage');
const OrganizationVerificationPage = namedLazy(() => import('@/features/workspace/OrganizationVerificationPage'), 'OrganizationVerificationPage');
const LifestylePage = namedLazy(() => import('@/features/lifestyle/LifestylePage'), 'LifestylePage');
const LifestyleAdminPage = namedLazy(() => import('@/features/lifestyle/LifestylePage'), 'LifestyleAdminPage');
const ConnectPage = namedLazy(() => import('@/features/connect/ConnectPage'), 'ConnectPage');
const ConnectMessenger = namedLazy(() => import('@/features/connect/ConnectMessenger'), 'ConnectMessenger');
const OrbitMyWorkPage = namedLazy(() => import('@/features/orbit/OrbitMyWorkPage'), 'OrbitMyWorkPage');
const OrbitWorkspacesPage = namedLazy(() => import('@/features/orbit/OrbitWorkspacesPage'), 'OrbitWorkspacesPage');
const OrbitWorkspaceOverviewPage = namedLazy(() => import('@/features/orbit/OrbitWorkspaceOverviewPage'), 'OrbitWorkspaceOverviewPage');
const OrbitProjectBoardPage = namedLazy(() => import('@/features/orbit/OrbitProjectBoardPage'), 'OrbitProjectBoardPage');

function IndexRedirect() {
  const { defaultRoute } = useAuth();
  return <Navigate to={defaultRoute} replace />;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-teal" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invitation/:token" element={<AcceptInvitationPage />} />
        <Route path="/admin-invitations/:token" element={<AcceptInvitationPage mode="organization-admin" />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<IndexRedirect />} />
          <Route path="platform" element={<PlatformDashboardPage />} />
          <Route path="platform/error-logs" element={<PlatformErrorLogsPage />} />
          <Route path="platform/organizations/new" element={<PlatformOrganizationCreatePage />} />
          <Route path="platform/organizations/:id" element={<PlatformOrganizationDetailPage />} />
          <Route path="platform/permissions" element={<PlatformPermissionCatalogPage />} />
          <Route path="dashboard" element={<Navigate to="/dashboard/organization" replace />} />
          <Route path="dashboard/:tab" element={<DashboardPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="connect" element={<ConnectMessenger />} />
          <Route path="connect/chat/:id" element={<ConnectMessenger />} />
          <Route path="connect/:id" element={<ConnectPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="operations" element={<OperationsCenterPage />} />
          <Route path="orbit" element={<OrbitMyWorkPage />} />
          <Route path="orbit/workspaces" element={<OrbitWorkspacesPage />} />
          <Route path="orbit/workspaces/:workspaceId" element={<OrbitWorkspaceOverviewPage />} />
          <Route path="orbit/projects/:projectId" element={<OrbitProjectBoardPage />} />
          <Route path="employees" element={<EmployeeListPage />} />
          <Route path="employees/new" element={<EmployeeCreatePage />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />
          <Route path="me/profile" element={<MyProfilePage />} />
          <Route path="me/leave" element={<MyLeavePage />} />
          <Route path="me/tickets" element={<MyTicketsPage />} />
          <Route path="me/assets" element={<MyAssetsPage />} />
          <Route path="me/lifestyle" element={<LifestylePage />} />
          <Route path="settings/lifestyle" element={<LifestyleAdminPage />} />
          <Route path="me/payslips" element={<MyPayslipsPage />} />
          <Route path="me/attendance" element={<MyAttendancePage />} />
          <Route path="me/org-chart" element={<MyOrgChartPage />} />
          <Route path="me/directory" element={<MyDirectoryPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="organization-verification" element={<OrganizationVerificationPage />} />
          <Route path="settings/control-center" element={<ControlCenterPage />} />
          <Route path="settings/structure" element={<StructureSettingsPage />} />
          <Route path="settings/roles" element={<RolesPermissionsPage />} />
          <Route path="settings/custom-fields" element={<CustomFieldsPage />} />
          <Route path="settings/assets" element={<AssetManagementPage />} />
          <Route path="documents" element={<DocumentsControlPage />} />
          <Route path="approvals" element={<ApprovalsControlPage />} />
          <Route path="approvals/:id" element={<ApprovalsControlPage />} />
          <Route path="service-desk" element={<TicketQueuePage />} />
          <Route path="leave" element={<LeaveControlPage />} />
          <Route path="attendance" element={<AttendanceControlPage />} />
          <Route path="payroll" element={<PayrollControlPage />} />
          <Route path="reports" element={<ReportsStudioPage />} />
          <Route path="audit" element={<AuditActivityPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
