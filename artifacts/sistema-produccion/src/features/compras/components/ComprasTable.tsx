import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoreHorizontal, Eye, Edit2, ArrowDownToLine, Ban, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Compra, CompraStatus, COMPRA_STATUSES } from '../types/compra.types';
import { CompraStatusBadge } from './CompraStatusBadge';
import { useAuth } from '@/auth/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { mapCompraError } from '../api/compras.error';

interface ComprasTableProps {
  compras: Compra[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  hasLoadedData: boolean;
  onRetry: () => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  statusFilter: CompraStatus | undefined;
  onStatusFilterChange: (status: CompraStatus | undefined) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onReceive: (id: string) => void;
  onCancel: (id: string) => void;
  canCreate: boolean;
  onCreate: () => void;
}

export function ComprasTable({
  compras,
  isLoading,
  isFetching,
  error,
  hasLoadedData,
  onRetry,
  page,
  totalPages,
  totalCount,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  onView,
  onEdit,
  onReceive,
  onCancel,
  canCreate,
  onCreate,
}: ComprasTableProps) {
  const { can } = useAuth();

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  };

  const formatDateTime = (dateStr: string) => {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr));
  };

  const hasRows = compras.length > 0;
  const mappedError = error ? mapCompraError(error) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Estado:</span>
          <Select
            value={statusFilter || "ALL"}
            onValueChange={(val) => onStatusFilterChange(val === "ALL" ? undefined : val as CompraStatus)}
          >
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filtrar compras por estado" data-testid="select-filter-status">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {COMPRA_STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  {s === 'REGISTERED' ? 'Registrada' : s === 'RECEIVED' ? 'Recibida' : 'Cancelada'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground flex items-center">
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />}
          {isFetching && !isLoading ? 'Actualizando...' : `Página ${page} de ${Math.max(1, totalPages)}`}
        </div>
      </div>

      {mappedError && hasLoadedData && (
        <div className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          <div>
            <span className="font-medium">{mappedError.userMessage}</span>
            {mappedError.requestId && <span className="ml-2 opacity-80 text-xs">(Req ID: {mappedError.requestId})</span>}
          </div>
          <Button variant="outline" size="sm" onClick={onRetry} className="border-destructive/30 hover:bg-destructive/20 text-destructive">
            Reintentar
          </Button>
        </div>
      )}

      <div className="border rounded-md overflow-x-auto bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Artículos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última Act.</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !hasLoadedData ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : mappedError && !hasLoadedData ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <div className="flex flex-col items-center text-destructive">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p className="font-medium mb-1">{mappedError.userMessage}</p>
                    {mappedError.requestId && <p className="text-xs opacity-80 mb-4">Req ID: {mappedError.requestId}</p>}
                    <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : !hasRows ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <span>{statusFilter ? 'No se encontraron compras con los filtros actuales.' : 'No hay compras registradas.'}</span>
                    {!statusFilter && canCreate && (
                      <Button type="button" size="sm" onClick={onCreate} data-testid="button-empty-create-compra">
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Compra
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              compras.map((compra) => {
                const canEdit = can('compras:update') && compra.status === 'REGISTERED';
                const canReceive = can('compras:receive') && compra.status === 'REGISTERED';
                const canCancel = can('compras:cancel') && compra.status === 'REGISTERED';

                return (
                  <TableRow key={compra.id} data-testid={`row-compra-${compra.id}`}>
                    <TableCell className="font-medium">{compra.supplierName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {compra.documentNumber || '-'}
                      {compra.documentDate && <span className="block text-xs">{formatDate(compra.documentDate)}</span>}
                    </TableCell>
                    <TableCell>
                      {compra.items.length}
                    </TableCell>
                    <TableCell>
                      <CompraStatusBadge status={compra.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(compra.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" aria-label={`Acciones de la compra ${compra.id}`} data-testid={`button-actions-${compra.id}`}>
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(compra.id)} data-testid={`menu-view-${compra.id}`}>
                            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>Ver Detalles</span>
                          </DropdownMenuItem>

                          {(canEdit || canReceive || canCancel) && <DropdownMenuSeparator />}

                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit(compra.id)} data-testid={`menu-edit-${compra.id}`}>
                              <Edit2 className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                          )}

                          {canReceive && (
                            <DropdownMenuItem onClick={() => onReceive(compra.id)} data-testid={`menu-receive-${compra.id}`}>
                              <ArrowDownToLine className="mr-2 h-4 w-4 text-success" />
                              <span className="text-success font-medium">Recibir</span>
                            </DropdownMenuItem>
                          )}

                          {canCancel && (
                            <DropdownMenuItem onClick={() => onCancel(compra.id)} data-testid={`menu-cancel-${compra.id}`}>
                              <Ban className="mr-2 h-4 w-4 text-destructive" />
                              <span className="text-destructive font-medium">Cancelar</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {compras.length} de {totalCount} resultados
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isFetching}
            data-testid="button-prev-page"
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isFetching}
            data-testid="button-next-page"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
