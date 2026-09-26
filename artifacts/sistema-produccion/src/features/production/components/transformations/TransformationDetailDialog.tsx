import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTransformation, useProductionOrders, useTransformationOrders, useProductionWorks, useProductionBatches, useWorkTypes } from '../../api/production.hooks';
import { useArticulos } from '@/features/articulos/api/articulos.hooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mapProductionError } from '../../api/production.error';
import { useMemo } from 'react';

interface Props {
  id: string | null;
  onClose: () => void;
}

export function TransformationDetailDialog({ id, onClose }: Props) {
  const { data, isLoading, error, refetch } = useTransformation(id!, { enabled: !!id });
  const t = data;

  // Ideally we only fetch needed batches, but for simplicity we fetch by PO if available
  const { data: orders } = useProductionOrders({ pageSize: 100 }, { enabled: !!t });
  const { data: tOrders } = useTransformationOrders({ pageSize: 100 }, { enabled: !!t });
  const { data: works } = useProductionWorks({ pageSize: 100 }, { enabled: !!t });
  const { data: workTypes } = useWorkTypes({ pageSize: 100 }, { enabled: !!t });
  const { data: batches } = useProductionBatches({ pageSize: 100, productionOrderId: t?.productionOrderId }, { enabled: !!t });
  const { data: articulos } = useArticulos({ page: 1, pageSize: 100, activo: true }, { enabled: !!t });

  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const tOrdersMap = useMemo(() => new Map(tOrders?.data.map(o => [o.id, o.code])), [tOrders]);
  const worksMap = useMemo(() => new Map(works?.data.map(w => [w.id, w])), [works]);
  const workTypesMap = useMemo(() => new Map(workTypes?.data.map(w => [w.id, w.name])), [workTypes]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b])), [batches]);
  const articulosMap = useMemo(() => new Map(articulos?.items.map(a => [a.id, `${a.codigo} · ${a.nombre}`])), [articulos]);

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Detalle de Transformación</DialogTitle>
          <DialogDescription>
            Información completa sobre consumos y generación de lotes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 bg-muted/10">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-[120px] w-full" />
              <div className="grid grid-cols-2 gap-6">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[200px] w-full" />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error al cargar la información</p>
              <p className="text-sm mt-1">{mapProductionError(error).userMessage}</p>
              <p className="text-xs font-mono mt-1 opacity-70">Código: {mapProductionError(error).code}</p>
              {mapProductionError(error).requestId && <p className="text-xs font-mono mt-1 opacity-70">Req: {mapProductionError(error).requestId}</p>}
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
              </Button>
            </div>
          ) : t ? (
            <div className="space-y-8 max-w-3xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-lg bg-card shadow-sm">
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-muted-foreground block">Fecha de Operación:</span> 
                  <span className="font-medium">{new Date(t.performedAt).toLocaleString('es-BO')}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-muted-foreground block">Orden Producción:</span> 
                  <span className="font-medium">{ordersMap.get(t.productionOrderId) || 'No disponible'}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-muted-foreground block">Orden Transf.:</span> 
                  <span className="font-medium">{t.transformationOrderId ? tOrdersMap.get(t.transformationOrderId) || 'No disponible' : 'No disponible'}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-muted-foreground block">Trabajo Asignado:</span> 
                  <span className="font-medium">
                    {(() => {
                       if (!t.productionWorkId) return 'No disponible';
                       const work = worksMap.get(t.productionWorkId);
                       if (!work) return 'No disponible';
                       const type = workTypesMap.get(work.workTypeId) || '';
                       return `${type} - ${new Date(work.performedAt).toLocaleDateString('es-BO')}`;
                    })()}
                  </span>
                </div>
                {t.observations && (
                  <div className="col-span-full pt-2 border-t mt-2">
                    <span className="text-xs text-muted-foreground block">Observaciones:</span> 
                    <span className="text-sm">{t.observations}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center">
                    Inputs (Consumo)
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t.inputs.length}</span>
                  </h4>
                  <div className="border rounded-md overflow-x-auto bg-card shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Lote</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.inputs.map((item, idx) => {
                          const batch = batchesMap.get(item.productionBatchId);
                          const articleName = batch ? articulosMap.get(batch.articuloId) : null;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{batch?.code || 'No disponible'}</TableCell>
                              <TableCell>{articleName || 'No disponible'}</TableCell>
                              <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center">
                    Outputs (Generación)
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t.outputs.length}</span>
                  </h4>
                  <div className="border rounded-md overflow-x-auto bg-card shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Lote Generado</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.outputs.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{item.code || 'No disponible'}</TableCell>
                            <TableCell className="font-medium">{articulosMap.get(item.articuloId) || 'No disponible'}</TableCell>
                            <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {t.losses.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center">
                    Pérdidas
                    <span className="ml-2 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{t.losses.length}</span>
                  </h4>
                  <div className="border rounded-md overflow-x-auto bg-card shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Lote Afectado</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.losses.map((item, idx) => {
                          const batch = item.productionBatchId ? batchesMap.get(item.productionBatchId) : null;
                          const articleName = batch ? articulosMap.get(batch.articuloId) : null;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{batch?.code || (item.productionBatchId ? 'No disponible' : 'General (Sin Lote)')}</TableCell>
                              <TableCell>{articleName || 'No disponible'}</TableCell>
                              <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Auditoría</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-muted/30 p-3 rounded break-all">
                  <div><span className="text-muted-foreground">Req Hash:</span> {t.requestHash}</div>
                  <div><span className="text-muted-foreground">Usuario:</span> {t.actorUserId}</div>
                </div>
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
