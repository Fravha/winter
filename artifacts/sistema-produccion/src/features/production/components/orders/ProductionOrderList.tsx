import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Eye, CheckCircle2 } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { ProductionOrderCreateDialog } from './ProductionOrderCreateDialog';
import { ProductionOrderDetailDialog } from './ProductionOrderDetailDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ProductionOrderFilters, ProductionOrder } from '../../types/production.types';
import { useProductionOrders, useCloseProductionOrder } from '../../api/production.hooks';

export function ProductionOrderList() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canCreate = can('production:order_create');
  const canClose = can('production:order_close');

  const [filters, setFilters] = useState<ProductionOrderFilters>({ page: 1, pageSize: 10 });
  const { data, isLoading, isFetching, error } = useProductionOrders(filters);
  const closeMutation = useCloseProductionOrder();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<string | null>(null);
  const [confirmCloseItem, setConfirmCloseItem] = useState<ProductionOrder | null>(null);

  const handleClose = async () => {
    if (!confirmCloseItem) return;
    try {
      await closeMutation.mutateAsync(confirmCloseItem.id);
      toast({ title: 'Orden cerrada correctamente' });
    } catch (err) {
      const prodErr = mapProductionError(err);
      toast({
        title: 'Error al cerrar orden',
        description: `${prodErr.code}: ${prodErr.userMessage}${prodErr.requestId ? ` (Req: ${prodErr.requestId})` : ''}`,
        variant: 'destructive'
      });
    } finally {
      setConfirmCloseItem(null);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('es-BO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const items: ProductionOrder[] = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0, totalPages: 1 };

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-xl">Órdenes de Producción</CardTitle>
          <CardDescription>
            Gestión principal de órdenes de producción.
          </CardDescription>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto" data-testid="button-create-production-order">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-center mb-4 justify-between">
          <div className="w-full sm:w-48">
            <Select
              value={filters.status || 'ALL'}
              onValueChange={(val) => setFilters(prev => ({ ...prev, status: val === 'ALL' ? undefined : val as 'OPEN' | 'CLOSED', page: 1 }))}
            >
              <SelectTrigger aria-label="Filtro de estado" data-testid="select-filter-status">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="OPEN">Abierta</SelectItem>
                <SelectItem value="CLOSED">Cerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {error ? (
          <div className="p-4 text-center text-destructive">
            Error al cargar los datos. {mapProductionError(error).userMessage}
            <div className="mt-2 text-xs opacity-70">
              Request ID: {mapProductionError(error).requestId || 'N/A'}
            </div>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {filters.status ? 'No se encontraron órdenes para los filtros aplicados.' : 'No se encontraron órdenes.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-production-order-${item.id}`}>
                      <TableCell className="font-mono font-medium">{item.code}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'OPEN' ? 'default' : 'secondary'}>
                          {item.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(item.startDate)}</TableCell>
                      <TableCell>{item.closedAt ? formatDate(item.closedAt) : '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.observations || ''}>
                        {item.observations || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailItem(item.id)}
                            title="Ver Detalle"
                            aria-label="Ver Detalle"
                            data-testid={`button-view-production-order-${item.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canClose && item.status === 'OPEN' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmCloseItem(item)}
                              title="Cerrar Orden"
                              aria-label="Cerrar Orden"
                              data-testid={`button-close-production-order-${item.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
              disabled={meta.page <= 1 || isLoading}
            >
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              Página {meta.page} de {meta.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página siguiente"
              onClick={() => setFilters(prev => ({ ...prev, page: Math.min(meta.totalPages, (prev.page || 1) + 1) }))}
              disabled={meta.page >= meta.totalPages || isLoading}
            >
              Siguiente
            </Button>
          </div>
        )}
      </CardContent>

      {createOpen && (
        <ProductionOrderCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {detailItem && (
        <ProductionOrderDetailDialog
          orderId={detailItem}
          open={!!detailItem}
          onOpenChange={(op) => !op && setDetailItem(null)}
        />
      )}

      <AlertDialog open={!!confirmCloseItem} onOpenChange={(op) => !op && setConfirmCloseItem(null)}>
        <AlertDialogContent className="w-[calc(100%_-_2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar Orden de Producción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cerrar la orden <strong className="font-mono text-foreground">{confirmCloseItem?.code}</strong>?<br/><br/>
              Esta acción es irreversible y no podrás reabrir la orden ni agregar nuevas operaciones o transformaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
