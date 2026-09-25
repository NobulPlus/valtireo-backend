import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/States';
import { WorkspaceModeModal } from '@/components/shell/WorkspaceModeModal';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, canChooseWorkspaceMode, workspaceMode } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (canChooseWorkspaceMode && workspaceMode === null) {
    return (
      <div className="min-h-screen bg-canvas">
        <WorkspaceModeModal />
      </div>
    );
  }

  return <>{children}</>;
}
