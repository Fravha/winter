import { useMemo, useState } from 'react';
import { useProductionMeasurement, useMeasurementTypes, useProductionBatches, useProductionContainers, useProductionWorks, useParticipants } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Edit2 } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/auth/AuthContext';
import { CorrectMeasurementDialog } from './CorrectMeasurementDialog';

interface Props {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeasurementDetailDialog({ id, open, onOpenChange }: Props) {
  const { can } = useAuth();
  const canCorrect = can('production:measurement_correct');
  const [correctField, setCorrectField] = useState<'value' | 'unit' | 'measuredAt' | 'participantId' | 'observations' | null>(null);

  const { data: measurement, isLoading, error } = useProductionMeasurement(id, { enabled: open });
  
  const { data: measurementTypes } = useMeasurementTypes({ pageSize: 100 }, { enabled: open });
  const { data: batches } = useProductionBatches({ pageSize: 100 }, { enabled: open });
  const { data: containers } = useProductionContainers({ enabled: open });
  const { data: works } = useProductionWorks({ pageSize: 100 }, { enabled: open });
  const { data: participantsList } = useParticipants({ pageSize: 100 }, { enabled: open });

  const typesMap = useMemo(() => new Map(measurementTypes?.data.map(t => [t.id, t.name])), [measurementTypes]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b.code])), [batches]);
  const containersMap = useMemo(() => new Map(containers?.data.map(c => [c.id, c.code])), [containers]);
  const worksMap = useMemo(() => new Map(works?.data.map(w => [w.id, new Date(w.performedAt).toLocaleDateString('es-BO')])), [works]);
  const participantsMap = useMemo(() => new Map(participantsList?.data.map(p => [p.id, p.name])), [participantsList]);

  const mappedError = error ? mapProductionError(error) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Detalles de Medición</DialogTitle>
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
          ) : measurement ? (
            <div className="p-6 space-y-6">
              
              <div className="flex items-center justify-between border-b pb-2">
                <div className="text-xs text-muted-foreground text-left">
                  v{measurement.version} • Registrado: {new Date(measurement.createdAt).toLocaleString('es-BO')}
                  <br />
                  Actualizado: {new Date(measurement.updatedAt).toLocaleString('es-BO')}
                </div>
              </div>

              <div className="bg-muted/30 p-6 rounded-lg border flex flex-col items-center justify-center space-y-2 group relative">
                {canCorrect && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setCorrectField('value')} title="Corregir Valor">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setCorrectField('unit')} title="Corregir Unidad">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <span className="text-sm font-medium text-muted-foreground">{typesMap.get(measurement.measurementTypeId) || 'No disponible'}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-mono text-primary">{measurement.value}</span>
                  <span className="text-xl text-muted-foreground">{measurement.unit}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DetailItem 
                  label="Fecha de Medición" 
                  value={new Date(measurement.measuredAt).toLocaleString('es-BO')} 
                  onEdit={canCorrect ? () => setCorrectField('measuredAt') : undefined} 
                />
                <DetailItem 
                  label="Responsable" 
                  value={measurement.participantId ? participantsMap.get(measurement.participantId) || 'No disponible' : '-'} 
                  onEdit={canCorrect ? () => setCorrectField('participantId') : undefined} 
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
                <p className="text-sm bg-muted/50 p-3 rounded-md border min-h-[3rem]">{measurement.observations || '-'}</p>
              </div>

              <div className="border rounded-md overflow-hidden bg-card">
                <div className="bg-muted px-4 py-2 border-b text-xs font-medium">Contexto Asociado</div>
                <ul className="divide-y text-sm">
                  {measurement.productionBatchId && (
                    <li className="p-3 flex items-center justify-between">
                      <span className="text-muted-foreground">Lote de Producción</span>
                      <span className="font-medium">{batchesMap.get(measurement.productionBatchId) || 'No disponible'}</span>
                    </li>
                  )}
                  {measurement.productionContainerId && (
                    <li className="p-3 flex items-center justify-between">
                      <span className="text-muted-foreground">Contenedor</span>
                      <span className="font-medium">{containersMap.get(measurement.productionContainerId) || 'No disponible'}</span>
                    </li>
                  )}
                  {measurement.productionWorkId && (
                    <li className="p-3 flex items-center justify-between">
                      <span className="text-muted-foreground">Trabajo Ejecutado</span>
                      <span className="font-medium">{worksMap.get(measurement.productionWorkId) || 'No disponible'}</span>
                    </li>
                  )}
                </ul>
              </div>

            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>

      {correctField && measurement && (
        <CorrectMeasurementDialog 
          open={!!correctField} 
          onOpenChange={(v) => !v && setCorrectField(null)} 
          measurement={measurement} 
          field={correctField}
          participantsMap={participantsMap}
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
