import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/shell/AppShell';
import { ProtectedRoute } from '@/components/shell/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EmployeeListPage } from '@/features/employees/EmployeeListPage';
import { EmployeeCreatePage } from '@/features/employees/EmployeeCreatePage';
import { EmployeeDetailPage } from '@/features/employees/EmployeeDetailPage';
import { PlatformDashboardPage } from '@/features/platform/PlatformDashboardPage';
import { PlatformOrganizationDetailPage } from '@/features/platform/PlatformOrganizationDetailPage';
import { ControlCenterPage } from '@/features/settings/ControlCenterPage';
import {
  ApprovalsControlPage,
  AttendanceControlPage,
  DocumentsControlPage,
  LeaveControlPage,
  ReportsControlPage,
  StructureSettingsPage,
} from '@/features/settings/SetupDataPages';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function IndexRedirect() {
  const { defaultRoute } = useAuth();
  return <Navigate to={defaultRoute} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route path="platform" element={<PlatformDashboardPage />} />
        <Route path="platform/organizations/:id" element={<PlatformOrganizationDetailPage />} />
        <Route path="dashboard" element={<Navigate to="/dashboard/organization" replace />} />
        <Route path="dashboard/:tab" element={<DashboardPage />} />
        <Route path="employees" element={<EmployeeListPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="workspace" element={<WorkspacePage />} />
        <Route path="settings/control-center" element={<ControlCenterPage />} />
        <Route path="settings/structure" element={<StructureSettingsPage />} />
        <Route path="documents" element={<DocumentsControlPage />} />
        <Route path="approvals" element={<ApprovalsControlPage />} />
        <Route path="leave" element={<LeaveControlPage />} />
        <Route path="attendance" element={<AttendanceControlPage />} />
        <Route path="reports" element={<ReportsControlPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
