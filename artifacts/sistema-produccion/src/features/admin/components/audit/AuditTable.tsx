import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AuditLog, PaginationMeta } from '@/features/admin/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AuditTableProps = {
  logs: AuditLog[];
  meta?: PaginationMeta;
  isLoading: boolean;
  hasError: boolean;
  pageSize: number;
  onViewDetails: (log: AuditLog) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function AuditTable({
  logs,
  meta,
  isLoading,
  hasError,
  pageSize,
  onViewDetails,
  onPageChange,
  onPageSizeChange,
}: AuditTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-md bg-card">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Recurso</TableHead>
              <TableHead>ID Recurso</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Req ID</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (hasError) return null;

  if (logs.length === 0 && meta?.total === 0) {
    return (
      <div className="border rounded-md p-12 flex flex-col items-center justify-center text-center bg-card shadow-sm">
        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-foreground">No hay registros</h3>
        <p className="text-muted-foreground text-sm mt-1">
          No se encontraron eventos de auditoría para los filtros aplicados.
        </p>
      </div>
    );
  }

  const formatShortId = (id: string | null) => {
    if (!id) return '-';
    return id.substring(0, 8) + '...';
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-md bg-card shadow-sm overflow-hidden">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Fecha</TableHead>
              <TableHead className="w-[120px]">Acción</TableHead>
              <TableHead className="w-[140px]">Tipo Recurso</TableHead>
              <TableHead>ID Recurso</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>ID Petición</TableHead>
              <TableHead className="w-[80px] text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                  {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-[11px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded border border-border/50">
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-sm font-medium">{log.resourceType}</TableCell>
                <TableCell
                  className="font-mono text-xs text-muted-foreground"
                  title={log.resourceId || undefined}
                >
                  {formatShortId(log.resourceId)}
                </TableCell>
                <TableCell
                  className="font-mono text-xs text-muted-foreground"
                  title={log.actorUserId || undefined}
                >
                  {formatShortId(log.actorUserId)}
                </TableCell>
                <TableCell
                  className="font-mono text-xs text-muted-foreground"
                  title={log.requestId || undefined}
                >
                  {formatShortId(log.requestId)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ver detalle de ${log.action}`}
                    className="h-8 w-8"
                    onClick={() => onViewDetails(log)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Esta página no tiene registros. Vuelva a una página anterior o ajuste los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {meta && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Filas por página:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(val) => onPageSizeChange(parseInt(val))}
            >
              <SelectTrigger className="w-[70px] h-8 text-xs">
                <SelectValue placeholder="20" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-2 sm:ml-4">
              Mostrando pág. {meta.page} de {meta.totalPages || 1} ({meta.total} regs)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="h-8"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="w-4 h-4 sm:ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
