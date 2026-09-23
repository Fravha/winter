import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mapProductionError } from '../../api/production.error';
import { Loader2 } from 'lucide-react';
import { useProductionOrder } from '../../api/production.hooks';

export function ProductionOrderDetailDialog({ orderId, open, onOpenChange }: { orderId: string, open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: order, isLoading, error } = useProductionOrder(orderId);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('es-BO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Orden de Producción</DialogTitle>
          <DialogDescription>
            Visualización de la orden y sus órdenes de transformación relacionadas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">
            Error al cargar detalle. {mapProductionError(error).code}: {mapProductionError(error).userMessage}
            <div className="mt-2 text-xs opacity-70">
              Request ID: {mapProductionError(error).requestId || 'N/A'}
            </div>
          </div>
        ) : order ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Código</p>
                <p className="font-mono text-lg">{order.code}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estado</p>
                <Badge variant={order.status === 'OPEN' ? 'default' : 'secondary'} className="mt-1">
                  {order.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fecha Inicio</p>
                <p>{formatDate(order.startDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fecha Cierre</p>
                <p>{order.closedAt ? formatDate(order.closedAt) : '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Observaciones</p>
                <p className="whitespace-pre-wrap">{order.observations || 'Sin observaciones.'}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium text-lg mb-3">Órdenes de Transformación Relacionadas</h4>
              {order.transformationOrders && order.transformationOrders.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Inicio Período</TableHead>
                        <TableHead>Fin Período</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.transformationOrders.map(to => (
                        <TableRow key={to.id}>
                          <TableCell className="font-mono">{to.code}</TableCell>
                          <TableCell>
                            <Badge variant={to.status === 'OPEN' ? 'outline' : 'secondary'} className="text-xs">
                              {to.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(to.periodStart)}</TableCell>
                          <TableCell>{to.periodEnd ? formatDate(to.periodEnd) : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Esta orden de producción no tiene órdenes de transformación relacionadas.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
