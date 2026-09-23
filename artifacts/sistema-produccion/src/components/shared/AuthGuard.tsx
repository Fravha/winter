import { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthAccessError } from '@/pages/errors/AuthAccessError';

export function AuthGuard({ children }: { children: ReactNode }) {
  const {
    authenticated,
    loading,
    authorized,
    contractualError,
    technicalError,
    refreshUser,
    logout,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (!authenticated) {
    return <Redirect to="/iniciar-sesion" />;
  }
  
  if (!authorized) {
    return (
      <AuthAccessError
        contractualError={contractualError}
        technicalError={technicalError}
        onRetry={refreshUser}
        onLogout={logout}
      />
    );
  }

  return <>{children}</>;
}
