import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ForbiddenState } from '@/components/ui/States';

/**
 * Page-level permission gate. The handoff guide's rule is to hide nav for
 * unavailable modules but still handle 403 gracefully since the backend
 * remains the source of truth — this covers the case where a user
 * navigates directly to a URL they don't have permission for.
 */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <ForbiddenState description={`This page requires the "${permission}" permission.`} />;
  }

  return <>{children}</>;
}
