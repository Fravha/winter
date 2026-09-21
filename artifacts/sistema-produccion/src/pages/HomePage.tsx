import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Redirect } from 'wouter';
import { LogOut, RotateCw, ShieldAlert, ShieldCheck, ServerCrash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function HomePage() {
  const {
    isFirebaseConfigured,
    user,
    firebaseUser,
    loading,
    authenticated,
    authorized,
    contractualError,
    technicalError,
    logout,
    refreshUser,
  } = useAuth();

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error de configuración</AlertTitle>
          <AlertDescription>
            El sistema no está configurado correctamente. Faltan variables de entorno de Firebase.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center animate-pulse text-muted-foreground">
          Cargando sesión...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Redirect to="/iniciar-sesion" />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">

        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold text-primary">Cruce del Zorro</h1>
          <p className="text-muted-foreground mt-2">Estado de acceso</p>
        </div>

        {technicalError ? (
          <div className="border border-warning/30 bg-warning/10 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-warning">
              <ServerCrash className="h-8 w-8" />
              <h2 className="text-xl font-semibold">No se pudo verificar el acceso</h2>
            </div>
            <p className="text-sm text-foreground">{technicalError}</p>
            <p className="text-sm text-muted-foreground">
              Tu sesión de Firebase continúa activa. Puedes volver a intentar la verificación.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void refreshUser().catch(() => undefined);
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : authorized ? (
          <div className="border border-success/30 bg-success/10 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-success">
              <ShieldCheck className="h-8 w-8" />
              <h2 className="text-xl font-semibold">Acceso autorizado</h2>
            </div>
            <div className="space-y-2 text-sm text-foreground">
              <p><strong>Usuario:</strong> {user?.displayName || firebaseUser?.email}</p>
              <p><strong>Correo:</strong> {user?.email}</p>
              <p><strong>Estado:</strong> {user?.status}</p>
              <p><strong>Rol principal:</strong> {user?.roles?.[0]}</p>
              <p><strong>Permisos ({user?.permissions?.length || 0}):</strong></p>
              <div className="flex flex-wrap gap-2 mt-2">
                {user?.permissions?.map(p => (
                  <span key={p} className="bg-background border border-border px-2 py-1 rounded text-xs">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-destructive/30 bg-destructive/10 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-8 w-8" />
              <h2 className="text-xl font-semibold">Acceso denegado</h2>
            </div>

            {contractualError && (
              <p className="text-sm font-medium text-destructive">
                {contractualError}
              </p>
            )}

            {!contractualError && (
              <p className="text-sm text-foreground">
                No tienes permisos suficientes para acceder al sistema.
              </p>
            )}

            <p className="text-sm text-muted-foreground pt-2 border-t border-border/50">
              Sesión actual: {firebaseUser?.email}
            </p>
          </div>
        )}

        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={logout} className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
