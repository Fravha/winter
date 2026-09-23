import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut, UserCredential } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { WinterUser } from './auth.types';
import { request } from '@/lib/api/request';
import { ApiError } from '@/lib/api/api-error';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type AuthContextType = {
  isFirebaseConfigured: boolean;
  firebaseUser: FirebaseUser | null;
  user: WinterUser | null;
  role: string | null;
  permissions: string[];
  loading: boolean;
  authenticated: boolean;
  authorized: boolean;
  contractualError: string | null;
  technicalError: string | null;
  login: (email: string, password: string) => Promise<UserCredential | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!auth) {
      setAuthInitialized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthInitialized(true);
      if (!fbUser) {
        queryClient.clear();
      }
    });
    return () => unsubscribe();
  }, [queryClient]);

  const {
    data: user = null,
    isLoading: userLoading,
    error: userError,
    refetch,
  } = useQuery<WinterUser, Error>({
    queryKey: ['auth', 'me', firebaseUser?.uid],
    queryFn: ({ signal }) => request<WinterUser>('auth/me', { signal }),
    enabled: isFirebaseConfigured && authInitialized && !!firebaseUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loading = !authInitialized || (!!firebaseUser && userLoading);

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    queryClient.clear();
  };

  let contractualError: string | null = null;
  let technicalError: string | null = null;

  if (userError) {
    if (userError instanceof ApiError) {
      if (userError.code === 'AUTH_USER_NOT_REGISTERED') {
        contractualError = 'Tu cuenta no está registrada en el sistema.';
      } else if (userError.code === 'AUTH_USER_INACTIVE') {
        contractualError = 'Tu cuenta se encuentra inactiva o suspendida.';
      } else {
        technicalError = 'No fue posible verificar tu acceso con el servidor de Winter.';
      }
    } else {
      technicalError = 'Ocurrió un error técnico al verificar tu cuenta.';
    }
  }

  const authenticated = !!firebaseUser;
  // If there's an error, user data MUST not authorize.
  const authorized = authenticated && !userError && user?.status === 'ACTIVE';

  // Safe roles and permissions based on successful fetch
  const role = (!userError && user?.roles?.[0]) || null;
  const permissions = (!userError && user?.permissions) || [];

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  );

  const refreshUser = useCallback(async () => {
    if (!isFirebaseConfigured || !firebaseUser) return;
    const result = await refetch();
    if (result.error) {
      throw result.error;
    }
  }, [refetch, firebaseUser]);

  const login = async (email: string, password: string) => {
    if (!auth) return null;
    return signInWithEmailAndPassword(auth, email, password);
  };

  return (
    <AuthContext.Provider
      value={{
        isFirebaseConfigured,
        firebaseUser,
        user: userError ? null : user,
        role,
        permissions,
        loading,
        authenticated,
        authorized,
        contractualError,
        technicalError,
        login,
        logout,
        refreshUser,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}