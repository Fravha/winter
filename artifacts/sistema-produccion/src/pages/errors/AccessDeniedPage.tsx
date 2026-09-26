import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export function AccessDeniedPage() {
  return (
    <div className="h-[80vh] w-full flex flex-col items-center justify-center text-center px-4">
      <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">
        Acceso denegado
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        No tienes permiso para acceder a esta sección. Si consideras que esto es un error, 
        contacta al administrador del sistema.
      </p>
      <Button asChild>
        <Link href="/">
          Volver al inicio
        </Link>
      </Button>
    </div>
  );
}
