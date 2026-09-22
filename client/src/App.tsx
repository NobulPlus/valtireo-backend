import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/shell/AppShell';
import { ProtectedRoute } from '@/components/shell/ProtectedRoute';
import { AcceptInvitationPage } from '@/features/auth/AcceptInvitationPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EmployeeListPage } from '@/features/employees/EmployeeListPage';
import { EmployeeCreatePage } from '@/features/employees/EmployeeCreatePage';
import { EmployeeDetailPage } from '@/features/employees/EmployeeDetailPage';
import { MyProfilePage } from '@/features/profile/MyProfilePage';
import { MyLeavePage } from '@/features/leave/MyLeavePage';
import { MyTicketsPage } from '@/features/tickets/MyTicketsPage';
import { TicketQueuePage } from '@/features/tickets/TicketQueuePage';
import { AssetManagementPage } from '@/features/assets/AssetManagementPage';
import { MyAssetsPage } from '@/features/assets/MyAssetsPage';
import { PayrollControlPage } from '@/features/payroll/PayrollControlPage';
import { MyPayslipsPage } from '@/features/payroll/MyPayslipsPage';
import { MyAttendancePage } from '@/features/attendance/MyAttendancePage';
import { MyOrgChartPage } from '@/features/employees/MyOrgChartPage';
import { MyDirectoryPage } from '@/features/employees/MyDirectoryPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { PlatformDashboardPage } from '@/features/platform/PlatformDashboardPage';
import { PlatformOrganizationCreatePage } from '@/features/platform/PlatformOrganizationCreatePage';
import { PlatformOrganizationDetailPage } from '@/features/platform/PlatformOrganizationDetailPage';
import { PlatformErrorLogsPage } from '@/features/platform/PlatformErrorLogsPage';
import { PlatformPermissionCatalogPage } from '@/features/platform/PlatformPermissionCatalogPage';
import { AuditActivityPage } from '@/features/audit/AuditActivityPage';
import { ControlCenterPage } from '@/features/settings/ControlCenterPage';
import { CustomFieldsPage } from '@/features/settings/CustomFieldsPage';
import { RolesPermissionsPage } from '@/features/settings/RolesPermissionsPage';
import { ReportsStudioPage } from '@/features/reports/ReportsStudioPage';
import {
  ApprovalsControlPage,
  AttendanceControlPage,
  DocumentsControlPage,
  LeaveControlPage,
  StructureSettingsPage,
} from '@/features/settings/SetupDataPages';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';
import { OrganizationVerificationPage } from '@/features/workspace/OrganizationVerificationPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function IndexRedirect() {
  const { defaultRoute } = useAuth();
  return <Navigate to={defaultRoute} replace />;
}

export default function App() {
  return (
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
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="employees" element={<EmployeeListPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="me/profile" element={<MyProfilePage />} />
        <Route path="me/leave" element={<MyLeavePage />} />
        <Route path="me/tickets" element={<MyTicketsPage />} />
        <Route path="me/assets" element={<MyAssetsPage />} />
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
  );
}
