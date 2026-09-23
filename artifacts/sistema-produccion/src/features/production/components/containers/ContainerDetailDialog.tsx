import { useState, useMemo } from 'react';
import { useProductionContainer, useProductionContainerOccupancies, useProductionContainerMovements, useAllProductionBatches, useAllProductionWorks } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Box, ArrowRightCircle, CheckCircle2, SplitSquareHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mapProductionError } from '../../api/production.error';

interface Props {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContainerDetailDialog({ id, open, onOpenChange }: Props) {
  const { data: container, isLoading, error } = useProductionContainer(id, { enabled: open });
  const { data: occupanciesRes, isLoading: loadingOcc } = useProductionContainerOccupancies(id, { enabled: open });
  const { data: movementsRes, isLoading: loadingMov } = useProductionContainerMovements(id, { enabled: open });

  // Soft fetch related metadata for display
  const { data: batches } = useAllProductionBatches({ enabled: open });
  const { data: works } = useAllProductionWorks({ enabled: open });
  
  const batchesMap = useMemo(() => new Map(batches?.map(b => [b.id, b.code])), [batches]);
  const worksMap = useMemo(() => new Map(works?.map(w => [w.id, `Trabajo del ${new Date(w.performedAt).toLocaleDateString('es-BO')}`])), [works]);

  const mappedError = error ? mapProductionError(error) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5 text-muted-foreground" />
            Recipiente {container?.code}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : mappedError ? (
            <div className="p-6 text-destructive">{mappedError.userMessage}</div>
          ) : container ? (
            <div className="p-6 space-y-8">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Nombre</div>
                  <div className="font-medium">{container.name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Tipo & Material</div>
                  <div className="font-medium">{container.type} • {container.material || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Capacidad</div>
                  <div className="font-medium">{container.capacity} {container.capacityUnit}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">Ubicación</div>
                  <div className="font-medium">{container.location || '-'}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold border-b pb-2 mb-4">Ocupación Actual</h3>
                {container.status === 'DISPONIBLE' ? (
                  <div className="p-4 border rounded-md text-sm text-center text-muted-foreground italic bg-muted/10">
                    El recipiente está disponible.
                  </div>
                ) : container.status === 'FUERA_DE_SERVICIO' ? (
                  <div className="p-4 border rounded-md text-sm text-center text-warning italic bg-warning/10 border-warning/20">
                    El recipiente está fuera de servicio.
                  </div>
                ) : container.currentOccupancy ? (
                  <div className="p-4 border rounded-md bg-primary/5 border-primary/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Lote actual</div>
                      <div className="text-lg font-bold text-primary">
                        {container.currentOccupancy.batchCode || batchesMap.get(container.currentOccupancy.batchId) || <span className="font-mono text-sm italic">Cargando lote...</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Cantidad</div>
                      <div className="text-xl font-medium">{container.currentOccupancy.quantity} <span className="text-sm">{container.currentOccupancy.unit}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">Ingresó el</div>
                      <div className="font-medium">{new Date(container.currentOccupancy.openedAt).toLocaleString('es-BO')}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border rounded-md text-sm text-center text-warning bg-warning/10">
                    Estado OCUPADO pero no hay registro de ocupación activa (Inconsistencia).
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold border-b pb-2 mb-4">Historial de Ocupaciones</h3>
                {loadingOcc ? (
                  <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
                ) : occupanciesRes?.data.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic text-center p-4 border rounded-md">No hay registro de ocupaciones anteriores.</div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2">Lote</th>
                          <th className="px-4 py-2">Cantidad</th>
                          <th className="px-4 py-2">Ingresó</th>
                          <th className="px-4 py-2">Salió</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {occupanciesRes?.data.map(occ => (
                          <tr key={occ.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">
                              {batchesMap.get(occ.batchId) || <span className="text-muted-foreground italic">Lote histórico</span>}
                            </td>
                            <td className="px-4 py-3">
                              {occ.quantity} <span className="text-xs text-muted-foreground">{occ.unit}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(occ.openedAt).toLocaleString('es-BO')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                              {occ.closedAt ? new Date(occ.closedAt).toLocaleString('es-BO') : <Badge variant="outline" className="text-[10px]">ACTIVA</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold border-b pb-2 mb-4">Historial de Movimientos</h3>
                {loadingMov ? (
                  <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
                ) : movementsRes?.data.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic text-center p-4 border rounded-md">No hay movimientos registrados.</div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2">Fecha</th>
                          <th className="px-4 py-2">Operación</th>
                          <th className="px-4 py-2">Lote (Origen → Destino)</th>
                          <th className="px-4 py-2">Cantidad</th>
                          <th className="px-4 py-2">Referencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {movementsRes?.data.map(mov => {
                          const isSource = mov.sourceContainerId === container.id;
                          const isDest = mov.destinationContainerId === container.id;
                          
                          let typeIcon = null;
                          let typeLabel = '';
                          if (mov.movementType === 'ASSIGNED') {
                            typeIcon = <CheckCircle2 className="h-4 w-4 text-success" />;
                            typeLabel = 'Asignación';
                          } else if (mov.movementType === 'TRANSFERRED') {
                            typeIcon = <ArrowRightCircle className="h-4 w-4 text-primary" />;
                            typeLabel = 'Traslado Total';
                          } else {
                            typeIcon = <SplitSquareHorizontal className="h-4 w-4 text-info" />;
                            typeLabel = 'Traslado Parcial';
                          }

                          return (
                            <tr key={mov.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3 whitespace-nowrap">
                                {new Date(mov.occurredAt).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {typeIcon}
                                  <div>
                                    <div className="font-medium">{typeLabel}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">{isSource && isDest ? 'Mismo' : isSource ? 'Salida' : 'Ingreso'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {mov.movementType === 'PARTIAL_TRANSFERRED' && mov.destinationBatchId ? (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground line-through">{batchesMap.get(mov.sourceBatchId) || 'Lote origen'}</span>
                                    <span className="mx-1">→</span>
                                    <span className="font-medium">{batchesMap.get(mov.destinationBatchId) || 'Lote destino'}</span>
                                  </div>
                                ) : (
                                  <div className="font-medium text-xs">
                                    {batchesMap.get(mov.sourceBatchId) || 'Lote principal'}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium whitespace-nowrap">
                                  {isSource && !isDest ? '-' : '+'}{mov.quantity} <span className="text-xs text-muted-foreground">{mov.unit}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {mov.productionWorkId && (
                                  <div className="text-primary truncate max-w-[150px]" title={worksMap.get(mov.productionWorkId)}>
                                    {worksMap.get(mov.productionWorkId) || 'Trabajo vinculado'}
                                  </div>
                                )}
                                {mov.actorUserId && (
                                  <div className="text-muted-foreground truncate max-w-[150px]" title={mov.actorUserId}>
                                    Operador: {mov.actorUserId.substring(0, 10)}...
                                  </div>
                                )}
                                {mov.observations && (
                                  <div className="text-muted-foreground italic truncate max-w-[200px] mt-1" title={mov.observations}>
                                    Obs: {mov.observations}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}