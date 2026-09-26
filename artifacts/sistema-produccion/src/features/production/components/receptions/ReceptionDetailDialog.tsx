import { useState, useMemo } from 'react';
import { useGrapeReception, useCustomFieldDefinitions, useProductionOrders, useProductionBatches } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, Edit3, CheckCircle2, AlertTriangle, FileText, History } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { useAuth } from '@/auth/AuthContext';
import { CorrectReceptionDialog } from './CorrectReceptionDialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useArticulos } from '@/features/articulos/api/articulos.hooks';

interface Props {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  varietiesMap: Map<string, string>;
  producersMap: Map<string, string>;
}

export function ReceptionDetailDialog({ id, open, onOpenChange, varietiesMap, producersMap }: Props) {
  const { can } = useAuth();
  const canCorrect = can('production:reception_correct');
  
  const [correctOpen, setCorrectOpen] = useState(false);
  const [fieldToCorrect, setFieldToCorrect] = useState<'receivedAt' | 'producerId' | 'observations' | 'status' | null>(null);

  const { data: reception, isLoading, error } = useGrapeReception(id, { enabled: open });
  const { data: customFields } = useCustomFieldDefinitions({ enabled: open });

  const { data: articulos } = useArticulos({ page: 1, pageSize: 100 }, { enabled: open });
  const { data: orders } = useProductionOrders({ page: 1, pageSize: 100 }, { enabled: open });
  const { data: batches } = useProductionBatches(
    { page: 1, pageSize: 100, productionOrderId: reception?.productionOrderId }, 
    { enabled: !!reception?.productionOrderId && open }
  );

  const articulosMap = useMemo(() => new Map(articulos?.items.map(a => [a.id, `${a.codigo} · ${a.nombre}`])), [articulos]);
  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b.code])), [batches]);

  const customFieldsMap = new Map((customFields?.data || []).map(f => [f.id, f]));
  const mappedError = error ? mapProductionError(error) : null;

  const handleCorrect = (field: typeof fieldToCorrect) => {
    setFieldToCorrect(field);
    setCorrectOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Detalles de Recepción</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : mappedError ? (
              <div className="p-6">
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm">{mappedError.userMessage}</h3>
                    {mappedError.requestId && <p className="text-xs font-mono mt-1">Req: {mappedError.requestId}</p>}
                  </div>
                </div>
              </div>
            ) : reception ? (
              <div className="p-6 space-y-8">
                {/* Info Principal */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <DetailField 
                    label="Fecha Recepción" 
                    value={new Date(reception.receivedAt).toLocaleString('es-BO')} 
                    onCorrect={canCorrect ? () => handleCorrect('receivedAt') : undefined}
                  />
                  <DetailField 
                    label="Productor" 
                    value={reception.producerId ? producersMap.get(reception.producerId) || 'No disponible' : 'Propio'} 
                    onCorrect={canCorrect ? () => handleCorrect('producerId') : undefined}
                  />
                  <DetailField 
                    label="Estado" 
                    value={reception.status === 'ACCEPTED' ? 'Aceptada' : 'Observada'} 
                    valueClass={reception.status === 'ACCEPTED' ? 'text-success font-medium' : 'text-warning font-medium'}
                    onCorrect={canCorrect ? () => handleCorrect('status') : undefined}
                  />
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Orden Producción</span>
                    <p className="text-sm bg-muted px-2 py-1 rounded w-fit">{ordersMap.get(reception.productionOrderId) || <span className="text-muted-foreground font-normal">No disponible</span>}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DetailField 
                    label="Observaciones" 
                    value={reception.observations || 'Sin observaciones'} 
                    className="col-span-full md:col-span-1"
                    onCorrect={canCorrect ? () => handleCorrect('observations') : undefined}
                  />
                </div>

                {/* Campos Personalizados */}
                {reception.customFields && reception.customFields.length > 0 && (
                  <div className="space-y-3 border-t pt-6">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Atributos Específicos
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {reception.customFields.map((cf, i) => {
                        const def = customFieldsMap.get(cf.definitionId);
                        const label = def?.label || 'Campo Desconocido';
                        let displayValue = String(cf.value);
                        if (def?.dataType === 'BOOLEAN') displayValue = cf.value ? 'Sí' : 'No';
                        return (
                          <div key={i} className="space-y-1 bg-muted/30 p-3 rounded-md border">
                            <span className="text-xs text-muted-foreground font-medium">{label}</span>
                            <p className="text-sm">{displayValue}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-3 border-t pt-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Lotes Físicos (Ítems)
                  </h3>
                  <div className="border rounded-md overflow-x-auto bg-card">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Variedad</TableHead>
                          <TableHead>Artículo Ref.</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead>Lote Generado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reception.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{varietiesMap.get(item.grapeVarietyId) || <span className="text-muted-foreground font-normal text-xs">No disponible</span>}</TableCell>
                            <TableCell className="font-medium">{articulosMap.get(item.articuloId) || <span className="text-muted-foreground font-normal text-xs">No disponible</span>}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{item.quantity} {item.unit}</TableCell>
                             <TableCell className="text-xs text-muted-foreground">{item.productionBatchId ? batchesMap.get(item.productionBatchId) || 'No disponible' : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Corrections History */}
                {reception.corrections && reception.corrections.length > 0 && (
                  <div className="space-y-3 border-t pt-6">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <History className="h-4 w-4" /> Historial de Correcciones
                    </h3>
                    <div className="border rounded-md overflow-x-auto bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Campo</TableHead>
                            <TableHead>Cambio</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Versión</TableHead>
                            <TableHead>Actor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...reception.corrections].sort((a,b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime()).map((corr, i) => (
                            <TableRow key={i} className="text-xs">
                              <TableCell className="whitespace-nowrap">{new Date(corr.correctedAt).toLocaleString('es-BO')}</TableCell>
                              <TableCell className="font-medium">{formatFieldName(corr.field)}</TableCell>
                              <TableCell>
                                <span className="text-muted-foreground line-through mr-2">{formatFieldValue(corr.field, corr.previousValue, producersMap)}</span>
                                <span className="font-medium text-primary">{formatFieldValue(corr.field, corr.newValue, producersMap)}</span>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate" title={corr.reason}>{corr.reason}</TableCell>
                              <TableCell className="tabular-nums">v{corr.fromVersion} → v{corr.toVersion}</TableCell>
                               <TableCell className="text-muted-foreground" title={corr.actorUserId}>Usuario registrado</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {reception && fieldToCorrect && (
        <CorrectReceptionDialog 
          open={correctOpen} 
          onOpenChange={setCorrectOpen}
          reception={reception}
          field={fieldToCorrect}
          producersMap={producersMap}
        />
      )}
    </>
  );
}

function DetailField({ label, value, onCorrect, className = "", valueClass = "" }: { label: string, value: string, onCorrect?: () => void, className?: string, valueClass?: string }) {
  return (
    <div className={`space-y-1 group relative ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {onCorrect && (
          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onCorrect} title="Corregir campo">
            <Edit3 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className={`text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}

function formatFieldName(field: string) {
  switch (field) {
    case 'receivedAt': return 'Fecha Recepción';
    case 'producerId': return 'Productor';
    case 'status': return 'Estado';
    case 'observations': return 'Observaciones';
    default: return field;
  }
}

function formatFieldValue(field: string, value: string | null, producersMap: Map<string, string>) {
  if (value === null) return 'N/A';
  if (field === 'receivedAt') return new Date(value).toLocaleString('es-BO');
  if (field === 'status') return value === 'ACCEPTED' ? 'Aceptada' : 'Observada';
  if (field === 'producerId') return producersMap.get(value) || 'No disponible';
  return value;
}
