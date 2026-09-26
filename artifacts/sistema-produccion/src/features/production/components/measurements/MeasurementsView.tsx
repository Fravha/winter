import { useState, useMemo } from 'react';
import { useProductionMeasurements, useMeasurementTypes, useProductionBatches, useProductionContainers, useProductionWorks, useParticipants } from '../../api/production.hooks';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, AlertCircle, FileText, Plus, Activity } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { MeasurementTypeSelect, BatchSelect, ContainerSelect, WorkSelect } from '../shared/ProductionSharedSelects';
import { useAuth } from '@/auth/AuthContext';
import { CreateMeasurementDialog } from './CreateMeasurementDialog';
import { MeasurementDetailDialog } from './MeasurementDetailDialog';
import { Input } from '@/components/ui/input';

export function MeasurementsView() {
  const [page, setPage] = useState(1);
  const [measurementTypeId, setMeasurementTypeId] = useState<string>('');
  const [productionBatchId, setProductionBatchId] = useState<string>('');
  const [productionContainerId, setProductionContainerId] = useState<string>('');
  const [productionWorkId, setProductionWorkId] = useState<string>('');
  const [measuredAtFrom, setMeasuredAtFrom] = useState<string>('');
  const [measuredAtTo, setMeasuredAtTo] = useState<string>('');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { can } = useAuth();
  const canCreate = can('production:measurement_create');

  const { data, isLoading, error, refetch, isFetching } = useProductionMeasurements({ 
    page, pageSize: 10, measurementTypeId, productionBatchId, productionContainerId,
    productionWorkId,
    measuredAtFrom: measuredAtFrom ? new Date(measuredAtFrom).toISOString() : undefined,
    measuredAtTo: measuredAtTo ? new Date(measuredAtTo).toISOString() : undefined
  });
  
  const { data: measurementTypes } = useMeasurementTypes({ pageSize: 100 });
  const { data: batches } = useProductionBatches({ pageSize: 100 });
  const { data: containers } = useProductionContainers();
  const { data: works } = useProductionWorks({ pageSize: 100 });
  const { data: participantsList } = useParticipants({ pageSize: 100 });

  const typesMap = useMemo(() => new Map(measurementTypes?.data.map(t => [t.id, t.name])), [measurementTypes]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b.code])), [batches]);
  const containersMap = useMemo(() => new Map(containers?.data.map(c => [c.id, c.code])), [containers]);
  const worksMap = useMemo(() => new Map(works?.data.map(w => [w.id, new Date(w.performedAt).toLocaleDateString('es-BO')])), [works]);
  const participantsMap = useMemo(() => new Map(participantsList?.data.map(p => [p.id, p.name])), [participantsList]);

  const measurements = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0, totalPages: 1 };
  const mappedError = error ? mapProductionError(error) : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full min-w-0 lg:flex-1">
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipo de Medición</label>
            <MeasurementTypeSelect value={measurementTypeId} onValueChange={(val) => { setMeasurementTypeId(val); setPage(1); }} />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Lote</label>
            <BatchSelect value={productionBatchId} onValueChange={(val) => { setProductionBatchId(val); setPage(1); }} />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contenedor</label>
            <ContainerSelect value={productionContainerId} onValueChange={(val) => { setProductionContainerId(val); setPage(1); }} />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Trabajo</label>
            <WorkSelect value={productionWorkId} onValueChange={(val) => { setProductionWorkId(val); setPage(1); }} />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <Input type="datetime-local" value={measuredAtFrom} onChange={e => { setMeasuredAtFrom(e.target.value); setPage(1); }} className="h-9 text-xs" />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <Input type="datetime-local" value={measuredAtTo} onChange={e => { setMeasuredAtTo(e.target.value); setPage(1); }} className="h-9 text-xs" />
          </div>
          {(measurementTypeId || productionBatchId || productionContainerId || productionWorkId || measuredAtFrom || measuredAtTo) && (
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => { setMeasurementTypeId(''); setProductionBatchId(''); setProductionContainerId(''); setProductionWorkId(''); setMeasuredAtFrom(''); setMeasuredAtTo(''); setPage(1); }} className="h-9 text-xs">
                Limpiar
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" /> Nueva Medición
            </Button>
          )}
        </div>
      </div>

      {mappedError ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{mappedError.userMessage}</h3>
            {mappedError.requestId && <p className="text-xs font-mono mt-1 opacity-80">Req: {mappedError.requestId}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 bg-background">Reintentar</Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Recipiente</TableHead>
                  <TableHead>Trabajo</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-8 w-24 ml-auto bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : measurements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Activity className="h-8 w-8 mb-2 opacity-20" />
                        <p>No se encontraron mediciones.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  measurements.map((measurement) => (
                    <TableRow key={measurement.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-xs whitespace-nowrap">{new Date(measurement.measuredAt).toLocaleString('es-BO')}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{typesMap.get(measurement.measurementTypeId) || <span className="text-muted-foreground font-normal">No disponible</span>}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-primary font-semibold">{measurement.value}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{measurement.unit}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{measurement.productionBatchId ? batchesMap.get(measurement.productionBatchId) || 'No disp.' : '-'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{measurement.productionContainerId ? containersMap.get(measurement.productionContainerId) || 'No disp.' : '-'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{measurement.productionWorkId ? worksMap.get(measurement.productionWorkId) || 'No disp.' : '-'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{measurement.participantId ? participantsMap.get(measurement.participantId) || 'No disp.' : '-'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={measurement.observations || ''}>{measurement.observations || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(measurement.id)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page} de {meta.totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}>Siguiente</Button>
            </div>
          )}
        </div>
      )}

      {createOpen && <CreateMeasurementDialog open={createOpen} onOpenChange={setCreateOpen} />}
      {detailId && <MeasurementDetailDialog id={detailId} open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)} />}
    </div>
  );
}
