import { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { AccessDeniedPage } from '@/pages/errors/AccessDeniedPage';

type PermissionGuardProps = {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  showErrorPage?: boolean;
};

export function PermissionGuard({
  permission,
  children,
  fallback = null,
  showErrorPage = false,
}: PermissionGuardProps) {
  const { can } = useAuth();
  
  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = permissions.some((p) => can(p));

  if (!hasAccess) {
    if (showErrorPage) {
      return <AccessDeniedPage />;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
