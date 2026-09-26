import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AuditLog } from '@/features/admin/types';

export function AuditDetailDialog({ log, open, onOpenChange }: {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">Detalle de Evento de Auditoría</DialogTitle>
          <DialogDescription>
            Información completa sobre la acción ejecutada en el sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 py-6 border-y border-border/50 text-sm">
          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              ID de Evento
            </span>
            <span className="font-mono text-sm">{log.id}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Fecha
            </span>
            <span className="font-medium">
              {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Acción
            </span>
            <span className="font-semibold text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded border border-border/50 inline-block">
              {log.action}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Tipo de Recurso
            </span>
            <span className="font-medium">{log.resourceType}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              ID de Recurso
            </span>
            <span className="font-mono text-xs break-all">{log.resourceId || '—'}</span>
          </div>

          <div className="col-span-2">
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Actor (ID Usuario)
            </span>
            <span className="font-mono text-xs break-all">{log.actorUserId || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              Dirección IP
            </span>
            <span className="font-mono text-xs">{log.ipAddress || '—'}</span>
          </div>
          <div className="col-span-2 md:col-span-1">
            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1.5 font-semibold">
              ID de Petición
            </span>
            <span className="font-mono text-xs break-all">{log.requestId || '—'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto mt-6 flex flex-col min-h-0">
          <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-2 font-semibold">
            Metadatos
          </span>
          <div className="flex-1 overflow-auto rounded-md border border-border/50 bg-muted/50 p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80">
              {JSON.stringify(log.metadata, null, 2) ?? 'null'}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
