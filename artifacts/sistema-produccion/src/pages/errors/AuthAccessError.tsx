import { useState } from 'react';
import { AlertTriangle, LogOut, RefreshCw, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AuthAccessErrorProps = {
  contractualError: string | null;
  technicalError: string | null;
  onRetry: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function AuthAccessError({
  contractualError,
  technicalError,
  onRetry,
  onLogout,
}: AuthAccessErrorProps) {
  const [retrying, setRetrying] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isTechnical = Boolean(technicalError);
  const Icon = isTechnical ? AlertTriangle : ShieldX;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <section className="w-full max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icon className="h-7 w-7" />
        </span>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {isTechnical ? 'Error de acceso' : 'Cuenta sin acceso'}
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold">
          {isTechnical ? 'No pudimos verificar tu acceso' : 'No puedes ingresar al sistema'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {technicalError ||
            contractualError ||
            'Tu cuenta de Firebase no tiene una autorización activa en Winter.'}
        </p>
        <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={loggingOut || retrying}
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </Button>
          {isTechnical && (
            <Button
              type="button"
              onClick={handleRetry}
              disabled={retrying || loggingOut}
            >
              <RefreshCw className={retrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {retrying ? 'Reintentando...' : 'Reintentar'}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}