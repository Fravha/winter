import { useState, useMemo } from 'react';
import { useProductionWorks, useWorkTypes, useProductionOrders, useTransformationOrders } from '../../api/production.hooks';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, AlertCircle, FileText, Plus, Hammer } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';
import { WorkTypeSelect } from '../shared/ProductionSharedSelects';
import { useAuth } from '@/auth/AuthContext';
import { CreateWorkDialog } from './CreateWorkDialog';
import { WorkDetailDialog } from './WorkDetailDialog';

export function WorksView() {
  const [page, setPage] = useState(1);
  const [productionOrderId, setProductionOrderId] = useState<string>('');
  const [workTypeId, setWorkTypeId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { can } = useAuth();
  const canCreate = can('production:work_create');

  const { data, isLoading, error, refetch, isFetching } = useProductionWorks({ page, pageSize: 10, productionOrderId, workTypeId });
  const { data: workTypes } = useWorkTypes({ pageSize: 100 });
  const { data: orders } = useProductionOrders({ pageSize: 100 });
  const { data: transformOrders } = useTransformationOrders({ pageSize: 100 });

  const typesMap = useMemo(() => new Map(workTypes?.data.map(t => [t.id, t.name])), [workTypes]);
  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const transformMap = useMemo(() => new Map(transformOrders?.data.map(o => [o.id, o.code])), [transformOrders]);

  const works = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0, totalPages: 1 };
  const mappedError = error ? mapProductionError(error) : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0 lg:flex-1">
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por Orden</label>
            <ProductionOrderSelect
              value={productionOrderId}
              onValueChange={(val) => { setProductionOrderId(val); setPage(1); }}
            />
          </div>
          <div className="w-full min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por Tipo</label>
            <WorkTypeSelect
              value={workTypeId}
              onValueChange={(val) => { setWorkTypeId(val); setPage(1); }}
            />
          </div>
          {(productionOrderId || workTypeId) && (
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => { setProductionOrderId(''); setWorkTypeId(''); setPage(1); }} className="h-9">
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
              <Plus className="h-4 w-4 mr-2" /> Nuevo Trabajo
            </Button>
          )}
        </div>
      </div>

      {mappedError ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{mappedError.userMessage}</h3>
            {mappedError.requestId && (
              <p className="text-xs font-mono mt-1 opacity-80">Req: {mappedError.requestId}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 bg-background">
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Tipo de Trabajo</TableHead>
                  <TableHead>Fecha Ejecución</TableHead>
                  <TableHead>Orden Principal</TableHead>
                  <TableHead>Orden Transf.</TableHead>
                  <TableHead className="text-center">Participantes</TableHead>
                  <TableHead className="text-center">Lotes</TableHead>
                  <TableHead className="text-center">Cont.</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-8 mx-auto bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-8 mx-auto bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-8 mx-auto bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-8 w-24 ml-auto bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : works.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Hammer className="h-8 w-8 mb-2 opacity-20" />
                        <p>No se encontraron trabajos registrados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  works.map((work) => (
                    <TableRow key={work.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap">{typesMap.get(work.workTypeId) || <span className="text-muted-foreground font-normal">No disponible</span>}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(work.performedAt).toLocaleString('es-BO')}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{ordersMap.get(work.productionOrderId) || <span className="text-muted-foreground font-normal">No disponible</span>}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{work.transformationOrderId ? (transformMap.get(work.transformationOrderId) || <span className="text-muted-foreground font-normal">No disponible</span>) : '-'}</TableCell>
                      <TableCell className="text-center tabular-nums text-xs">{work.participants.length}</TableCell>
                      <TableCell className="text-center tabular-nums text-xs">{work.batchIds.length}</TableCell>
                      <TableCell className="text-center tabular-nums text-xs">{work.containerIds.length}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={work.observations || ''}>{work.observations || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(work.id)}>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}

      {createOpen && <CreateWorkDialog open={createOpen} onOpenChange={setCreateOpen} />}
      {detailId && <WorkDetailDialog id={detailId} open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)} />}
    </div>
  );
}
