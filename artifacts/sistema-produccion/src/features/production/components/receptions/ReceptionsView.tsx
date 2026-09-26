import { useState, useMemo } from 'react';
import { useGrapeReceptions, useGrapeVarieties, useProducers, useProductionOrders } from '../../api/production.hooks';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, AlertCircle, Plus, ChevronRight } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { useAuth } from '@/auth/AuthContext';
import { CreateReceptionDialog } from './CreateReceptionDialog';
import { ReceptionDetailDialog } from './ReceptionDetailDialog';

export function ReceptionsView() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { can } = useAuth();
  const canCreate = can('production:reception_create');

  const { data, isLoading, error, refetch, isFetching } = useGrapeReceptions({ page, pageSize: 10 });

  // Preheat bounding catalogs to show human names
  const { data: varieties } = useGrapeVarieties({ active: true, pageSize: 100 });
  const { data: producers } = useProducers({ active: true, pageSize: 100 });
  const { data: orders } = useProductionOrders({ page: 1, pageSize: 100 });

  const varietiesMap = useMemo(() => new Map(varieties?.data?.map(v => [v.id, v.name])), [varieties]);
  const producersMap = useMemo(() => new Map(producers?.data?.map(p => [p.id, p.name])), [producers]);
  const ordersMap = useMemo(() => new Map(orders?.data?.map(o => [o.id, o.code])), [orders]);

  const receptions = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0, totalPages: 1 };
  const mappedError = error ? mapProductionError(error) : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Recepciones de Uva</h2>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar" className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto" data-testid="btn-new-reception">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Recepción
          </Button>
        )}
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
                  <TableHead>Fecha Recepción</TableHead>
                  <TableHead>Productor</TableHead>
                  <TableHead>Orden Producción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ítems</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : receptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <p>No hay recepciones registradas.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  receptions.map((rec) => (
                    <TableRow key={rec.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap" data-testid={`reception-date-${rec.id}`}>
                        {new Date(rec.receivedAt).toLocaleString('es-BO')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {rec.producerId ? producersMap.get(rec.producerId) || <span className="text-muted-foreground text-xs">No disponible</span> : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {ordersMap.get(rec.productionOrderId) || <span className="text-muted-foreground font-normal">No disponible</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          rec.status === 'ACCEPTED' ? 'bg-success/10 text-success border border-success/20' : 
                          'bg-warning/10 text-warning border border-warning/20'
                        }`}>
                          {rec.status === 'ACCEPTED' ? 'Aceptada' : 'Con Observaciones'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {rec.items?.length ?? '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={rec.observations || ''}>
                        {rec.observations || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(rec.id)} data-testid={`reception-detail-${rec.id}`}>
                          Ver Detalles
                          <ChevronRight className="h-4 w-4 ml-1" />
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
                data-testid="reception-list-prev"
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
                data-testid="reception-list-next"
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <CreateReceptionDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={(id) => { setCreateOpen(false); setDetailId(id); }} />
      )}

      {detailId && (
        <ReceptionDetailDialog id={detailId} open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)} varietiesMap={varietiesMap} producersMap={producersMap} />
      )}
    </div>
  );
}
