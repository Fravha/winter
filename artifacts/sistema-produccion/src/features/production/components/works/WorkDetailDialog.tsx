import { useMemo, useState, useEffect } from 'react';
import { useProductionWork, useProductionOrders, useTransformationOrders, useWorkTypes, useProductionBatches, useProductionContainers, useParticipants } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Edit2, Plus, ArrowLeftRight } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/auth/AuthContext';
import { CorrectWorkDialog } from './CorrectWorkDialog';
import { WorkInputFormDialog } from './WorkInputFormDialog';
import { ReverseWorkInputDialog } from './ReverseWorkInputDialog';
import { useArticulos } from '../../../articulos/api/articulos.hooks';
import { useActiveWarehouses, useInventoryLot } from '../../../inventory/api/inventory.hooks';
import { WorkInput } from '../../types/production.types';

function LotDisplay({ id }: { id: string }) {
  const { data } = useInventoryLot(id);
  if (!data) return <span className="font-mono text-xs">{id}</span>;
  return <span>Lote: <span className="font-medium text-xs">{data.lotCode}</span></span>;
}

interface Props {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkDetailDialog({ id, open, onOpenChange }: Props) {
  const { can } = useAuth();
  const canCorrect = can('production:work_correct');
  const canAddInput = can('production:work_input_create');
  const canReverseInput = can('production:work_input_reverse');

  const [correctField, setCorrectField] = useState<'performedAt' | 'workTypeId' | 'transformationOrderId' | 'observations' | null>(null);
  const [addInputOpen, setAddInputOpen] = useState(false);
  const [reverseInput, setReverseInput] = useState<WorkInput | null>(null);

  const { data: work, isLoading, error } = useProductionWork(id, { enabled: open });
  
  const { data: workTypes } = useWorkTypes({ pageSize: 100 }, { enabled: open });
  const { data: orders } = useProductionOrders({ pageSize: 100 }, { enabled: open });
  const { data: transformOrders } = useTransformationOrders({ pageSize: 100 }, { enabled: open });
  const { data: batches } = useProductionBatches({ pageSize: 100 }, { enabled: open });
  const { data: containers } = useProductionContainers({ enabled: open });
  const { data: participantsList } = useParticipants({ pageSize: 100 }, { enabled: open });
  const { data: articulos } = useArticulos({ activo: true, pageSize: 500 }, { enabled: open });
  const { data: warehouses } = useActiveWarehouses({ enabled: open });

  const typesMap = useMemo(() => new Map(workTypes?.data.map(t => [t.id, t.name])), [workTypes]);
  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const transformMap = useMemo(() => new Map(transformOrders?.data.map(o => [o.id, o.code])), [transformOrders]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b.code])), [batches]);
  const containersMap = useMemo(() => new Map(containers?.data.map(c => [c.id, c.code])), [containers]);
  const participantsMap = useMemo(() => new Map(participantsList?.data.map(p => [p.id, p.name])), [participantsList]);
  const articulosMap = useMemo(() => new Map(articulos?.items.map(a => [a.id, a.nombre])), [articulos]);
  const warehousesMap = useMemo(() => new Map(warehouses?.map(w => [w.id, w.nombre])), [warehouses]);

  const mappedError = error ? mapProductionError(error) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Detalles del Trabajo</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mappedError ? (
            <div className="p-6 text-destructive">
              <div className="bg-destructive/10 p-4 rounded-md">
                <p>{mappedError.userMessage}</p>
                {mappedError.requestId && <p className="text-xs font-mono mt-1 opacity-80">Req: {mappedError.requestId}</p>}
              </div>
            </div>
          ) : work ? (
            <div className="p-6 space-y-6">
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Registrado por: <span className="font-mono text-[10px] break-all">{work.createdByUserId}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  v{work.version} • Creado: {new Date(work.createdAt).toLocaleString('es-BO')}
                  <br />
                  Actualizado: {new Date(work.updatedAt).toLocaleString('es-BO')}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DetailItem 
                  label="Tipo de Trabajo" 
                  value={typesMap.get(work.workTypeId) || 'No disponible'} 
                  onEdit={canCorrect ? () => setCorrectField('workTypeId') : undefined} 
                />
                <DetailItem 
                  label="Fecha Ejecución" 
                  value={new Date(work.performedAt).toLocaleString('es-BO')} 
                  onEdit={canCorrect ? () => setCorrectField('performedAt') : undefined} 
                />
                <DetailItem 
                  label="Orden Principal" 
                  value={ordersMap.get(work.productionOrderId) || 'No disponible'} 
                />
                <DetailItem 
                  label="Orden Transf." 
                  value={work.transformationOrderId ? transformMap.get(work.transformationOrderId) || 'No disponible' : '-'} 
                  onEdit={canCorrect ? () => setCorrectField('transformationOrderId') : undefined} 
                />
              </div>

              <div className="space-y-1 group relative">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase">Observaciones</span>
                  {canCorrect && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCorrectField('observations')}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm bg-muted/50 p-3 rounded-md border min-h-[3rem]">{work.observations || '-'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-md overflow-x-auto">
                  <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Lotes Involucrados ({work.batchIds.length})</div>
                  <ul className="divide-y text-sm">
                    {work.batchIds.map(id => (
                      <li key={id} className="p-2">{batchesMap.get(id) || 'No disponible'}</li>
                    ))}
                    {work.batchIds.length === 0 && <li className="p-2 text-muted-foreground italic text-xs">Ninguno</li>}
                  </ul>
                </div>
                <div className="border rounded-md overflow-x-auto">
                  <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Contenedores ({work.containerIds.length})</div>
                  <ul className="divide-y text-sm">
                    {work.containerIds.map(id => (
                      <li key={id} className="p-2">{containersMap.get(id) || 'No disponible'}</li>
                    ))}
                    {work.containerIds.length === 0 && <li className="p-2 text-muted-foreground italic text-xs">Ninguno</li>}
                  </ul>
                </div>
                <div className="border rounded-md overflow-x-auto">
                  <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Participantes ({work.participants.length})</div>
                  <ul className="divide-y text-sm">
                    {work.participants.map((p, i) => (
                      <li key={i} className="p-2">
                        <div className="font-medium">{participantsMap.get(p.participantId) || 'No disponible'}</div>
                        {p.role && <div className="text-xs text-muted-foreground">{p.role}</div>}
                      </li>
                    ))}
                    {work.participants.length === 0 && <li className="p-2 text-muted-foreground italic text-xs">Ninguno</li>}
                  </ul>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto bg-card mt-6">
                <div className="bg-muted px-4 py-2 border-b font-medium text-sm flex items-center justify-between">
                  <span>Insumos Consumidos</span>
                  {canAddInput && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddInputOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Registrar Insumo
                    </Button>
                  )}
                </div>
                <div className="divide-y">
                  {(!work.inputs || work.inputs.length === 0) ? (
                    <div className="p-4 text-center text-sm text-muted-foreground italic">No hay insumos consumidos registrados</div>
                  ) : (
                    work.inputs.map(input => (
                      <div key={input.id} className={`p-4 flex flex-col gap-2 ${input.status === 'REVERSED' ? 'opacity-60 bg-muted/30' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {articulosMap.get(input.articuloId) || input.articuloId}
                              {input.status === 'REVERSED' && (
                                <span className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Revertido</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Almacén: {input.warehouseId ? (warehousesMap.get(input.warehouseId) || 'No disponible') : 'Sin procedencia legacy'}
                              {input.inventoryLotId && <span className="ml-1">• <LotDisplay id={input.inventoryLotId} /></span>}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="font-medium text-sm whitespace-nowrap bg-muted px-2 py-1 rounded">
                              {input.quantity} {input.unit}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-end mt-2 text-xs">
                          <div className="space-y-1">
                            {input.observations && <div className="italic text-muted-foreground">"{input.observations}"</div>}
                            <div className="text-muted-foreground">
                              Registrado el {new Date(input.createdAt).toLocaleString('es-BO')}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              Movimiento: {input.inventoryMovementId ? (
                                <span className="font-mono text-[10px]" title={input.inventoryMovementId}>{input.inventoryMovementId.substring(0, 8)}...</span>
                              ) : (
                                <span className="italic">No disponible</span>
                              )}
                            </div>
                            {input.status === 'REVERSED' && input.reversalReason && (
                              <div className="text-destructive mt-1">
                                Razón rev.: {input.reversalReason}
                              </div>
                            )}
                          </div>
                          {input.status === 'ACTIVE' && canReverseInput && input.warehouseId && input.inventoryMovementId && input.operationKey && input.requestHash && (
                            <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setReverseInput(input)}>
                              <ArrowLeftRight className="h-3 w-3 mr-1" />
                              Revertir
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {work.corrections && work.corrections.length > 0 && (
                <div className="border rounded-md overflow-x-auto bg-card mt-6">
                  <div className="bg-muted px-4 py-2 border-b font-medium text-sm flex items-center justify-between">
                    <span>Historial de Correcciones</span>
                    <span className="text-xs font-normal text-muted-foreground">{work.corrections.length} registro(s)</span>
                  </div>
                  <div className="divide-y">
                    {work.corrections.map((corr) => (
                      <div key={corr.id} className="p-3 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium capitalize text-xs">{corr.field}</span>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">{new Date(corr.correctedAt).toLocaleString('es-BO')}</span>
                            <span className="text-[10px] text-muted-foreground">Actor: <span className="font-mono break-all">{corr.actorUserId}</span></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="line-through text-muted-foreground opacity-70">
                            {formatCorrectionValue(corr.field, corr.previousValue, typesMap, transformMap)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-primary">
                            {formatCorrectionValue(corr.field, corr.newValue, typesMap, transformMap)}
                          </span>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <p className="text-xs italic bg-muted/50 p-2 rounded flex-1">"{corr.reason}"</p>
                          <span className="text-[10px] text-muted-foreground ml-4 whitespace-nowrap">v{corr.fromVersion} → v{corr.toVersion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>

      {correctField && work && (
        <CorrectWorkDialog 
          open={!!correctField} 
          onOpenChange={(v) => !v && setCorrectField(null)} 
          work={work} 
          field={correctField}
          typesMap={typesMap}
          transformMap={transformMap}
        />
      )}

      {work && (
        <WorkInputFormDialog
          workId={work.id}
          workLabel={`${typesMap.get(work.workTypeId) || 'Trabajo'} · ${new Date(work.performedAt).toLocaleString('es-BO')}`}
          open={addInputOpen}
          onOpenChange={setAddInputOpen}
        />
      )}

      {work && reverseInput && (
        <ReverseWorkInputDialog
          workId={work.id}
          input={reverseInput}
          onClose={() => setReverseInput(null)}
        />
      )}
    </Dialog>
  );
}

function DetailItem({ label, value, onEdit }: { label: string, value: React.ReactNode, onEdit?: () => void }) {
  return (
    <div className="space-y-1 group relative">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase">{label}</span>
        {onEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function formatCorrectionValue(field: string, val: string | null, typesMap: Map<string, string>, transformMap: Map<string, string>) {
  if (!val) return 'N/A';
  if (field === 'performedAt') return new Date(val).toLocaleString('es-BO');
  if (field === 'workTypeId') return typesMap.get(val) || 'No disponible';
  if (field === 'transformationOrderId') return transformMap.get(val) || 'No disponible';
  return val;
}
