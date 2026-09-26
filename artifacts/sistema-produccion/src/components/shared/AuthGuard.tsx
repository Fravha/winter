import { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import { StartupLoader } from '@/components/shared/StartupLoader';
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
    return <StartupLoader label="Verificando acceso" />;
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
