import { useState, useMemo } from 'react';
import { useProductionBatches, useProductionBatch, useProductionBatchBalance, useProductionOrders } from '../../api/production.hooks';
import { useArticulos } from '@/features/articulos/api/articulos.hooks';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, AlertCircle, FileText, Package2 } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { ArticuloSelect } from '@/features/inventory/components/SharedSelects';
import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BatchReleaseDialog } from './BatchReleaseDialog';
import { ReleaseHistory } from './ReleaseHistory';
import { useAuth } from '@/auth/AuthContext';
import { ArrowLeftRight } from 'lucide-react';

export function BatchesView() {
  const [page, setPage] = useState(1);
  const [articuloId, setArticuloId] = useState<string>('');
  const [productionOrderId, setProductionOrderId] = useState<string>('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useProductionBatches({
    page,
    pageSize: 10,
    ...(articuloId ? { articuloId } : {}),
    ...(productionOrderId ? { productionOrderId } : {}),
  });

  const { data: ordersData } = useProductionOrders({ page: 1, pageSize: 100 });
  const { data: articulosData } = useArticulos({ page: 1, pageSize: 100 });

  const ordersMap = useMemo(() => new Map(ordersData?.data.map(o => [o.id, o.code])), [ordersData]);
  const articulosMap = useMemo(() => new Map(articulosData?.items.map(a => [a.id, `${a.codigo} · ${a.nombre}`])), [articulosData]);

  const batches = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0, totalPages: 1 };
  const mappedError = error ? mapProductionError(error) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="w-full sm:w-64 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por Artículo</label>
            <ArticuloSelect
              value={articuloId}
              onChange={(val) => { setArticuloId(val === 'ALL' ? '' : val); setPage(1); }}
            />
          </div>
          <div className="w-full sm:w-64 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por Orden</label>
            <ProductionOrderSelect
              value={productionOrderId}
              onValueChange={(val) => { setProductionOrderId(val); setPage(1); }}
            />
          </div>
          {(articuloId || productionOrderId) && (
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => { setArticuloId(''); setProductionOrderId(''); setPage(1); }} className="h-9">
                Limpiar
              </Button>
            </div>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
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
                  <TableHead>Código Lote</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Artículo</TableHead>
                   <TableHead>Unidad</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Generado</TableHead>
                  <TableHead className="text-right">Consumido</TableHead>
                  <TableHead className="text-right">Separado</TableHead>
                  <TableHead className="text-right">Perdido</TableHead>
                  <TableHead className="text-right" title="Transferido a Inventario">Transf.</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                       <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : batches.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Package2 className="h-8 w-8 mb-2 opacity-20" />
                        <p>No se encontraron lotes de producción.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap" data-testid={`batch-code-${batch.id}`}>{batch.code}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{ordersMap.get(batch.productionOrderId) || <span className="text-muted-foreground font-normal">No disponible</span>}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap font-mono">{articulosMap.get(batch.articuloId) || <span className="text-muted-foreground font-normal font-sans">No disponible</span>}</TableCell>
                       <TableCell className="text-xs whitespace-nowrap">{batch.unit}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{new Date(batch.createdAt).toLocaleDateString('es-BO')}</TableCell>

                      <TableCell className="text-right tabular-nums text-xs">{batch.balance.generated} {batch.unit}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{batch.balance.consumed} {batch.unit}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{batch.balance.separated} {batch.unit}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{batch.balance.lost} {batch.unit}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{batch.balance.transferredToInventory} {batch.unit}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-primary text-xs">
                        {batch.balance.available} {batch.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(batch.id)} data-testid={`batch-detail-${batch.id}`}>
                            <FileText className="h-4 w-4 mr-2" />
                            Detalles
                          </Button>
                          <Link href={`/produccion/batches/${batch.id}/trace`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3" data-testid={`batch-trace-${batch.id}`}>
                            Trazabilidad
                          </Link>
                        </div>
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
                data-testid="batch-list-prev"
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
                data-testid="batch-list-next"
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}

      {detailId && (
        <BatchDetailDialog id={detailId} open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)} />
      )}
    </div>
  );
}

function BatchDetailDialog({ id, open, onOpenChange }: { id: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [releaseOpen, setReleaseOpen] = useState(false);
  const { can } = useAuth();
  const canRelease = can('production:inventory_release');
  const { data: batch, isLoading, error } = useProductionBatch(id, { enabled: open });
  const { data: balanceResult, isLoading: loadingBalance, error: balanceError, refetch: refetchBalance } = useProductionBatchBalance(id, { enabled: open, retry: false });

  const { data: ordersData } = useProductionOrders({ page: 1, pageSize: 100 }, { enabled: open });
  const { data: articulosData } = useArticulos({ page: 1, pageSize: 100 }, { enabled: open });

  const ordersMap = useMemo(() => new Map(ordersData?.data.map(o => [o.id, o.code])), [ordersData]);
  const articulosMap = useMemo(() => new Map(articulosData?.items.map(a => [a.id, `${a.codigo} · ${a.nombre}`])), [articulosData]);

  const mappedError = error ? mapProductionError(error) : null;
  const mappedBalanceError = balanceError ? mapProductionError(balanceError) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Detalles del Lote</DialogTitle>
            <Link
              href={`/produccion/batches/${id}/trace`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              data-testid={`batch-detail-trace-${id}`}
            >
              Ver trazabilidad
            </Link>
          </div>
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
          ) : batch ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Código</span>
                  <p className="font-medium">{batch.code}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Orden Producción</span>
                  <p className="text-sm font-medium">{batch.productionOrderId ? ordersMap.get(batch.productionOrderId) || <span className="text-muted-foreground font-normal">No disponible</span> : '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Artículo Referencia</span>
                  <p className="text-sm font-medium font-mono">{batch.articuloId ? articulosMap.get(batch.articuloId) || <span className="text-muted-foreground font-normal font-sans">No disponible</span> : '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Fecha Creación</span>
                  <p className="text-sm">{new Date(batch.createdAt).toLocaleString('es-BO')}</p>
                </div>
                 <div className="space-y-1">
                   <span className="text-xs text-muted-foreground uppercase">Unidad</span>
                   <p className="text-sm font-medium">{batch.unit}</p>
                 </div>
              </div>

              {batch.observations && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase">Observaciones</span>
                  <p className="text-sm bg-muted/50 p-3 rounded-md border">{batch.observations}</p>
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted px-4 py-2 border-b font-medium text-sm flex items-center justify-between">
                  <span>Balance Embebido del Lote</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Actualizado: {new Date(batch.balance.updatedAt).toLocaleString('es-BO')} (v{batch.balance.ledgerVersion})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-border">
                  <BalanceCard label="Generado" value={batch.balance.generated} unit={batch.unit} />
                  <BalanceCard label="Consumido" value={batch.balance.consumed} unit={batch.unit} />
                  <BalanceCard label="Separado" value={batch.balance.separated} unit={batch.unit} />
                  <BalanceCard label="Perdido" value={batch.balance.lost} unit={batch.unit} />
                  <BalanceCard label="Transferido Inv." value={batch.balance.transferredToInventory} unit={batch.unit} />
                  <BalanceCard label="Disponible" value={batch.balance.available} unit={batch.unit} highlight />
                </div>
              </div>

              {canRelease && batch && balanceResult && Number(balanceResult.available) > 0 && (
                <div className="flex justify-end">
                  <Button variant="default" onClick={() => setReleaseOpen(true)} className="gap-2">
                    <ArrowLeftRight className="w-4 h-4" /> Enviar a Inventario
                  </Button>
                </div>
              )}

              <div className="border rounded-md overflow-hidden bg-primary/5 border-primary/20">
                <div className="px-4 py-2 border-b border-primary/10 font-medium text-sm text-primary flex items-center justify-between">
                  <span>Balance Real (Endpoint Separado)</span>
                  {loadingBalance && <Loader2 className="h-3 w-3 animate-spin" />}
                </div>
                <div className="p-4">
                  {mappedBalanceError ? (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{mappedBalanceError.userMessage}</p>
                         <p className="text-[10px] font-mono mt-1 opacity-70">Código: {mappedBalanceError.code}</p>
                        {mappedBalanceError.requestId && <p className="text-[10px] font-mono mt-1 opacity-70">Req: {mappedBalanceError.requestId}</p>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => refetchBalance()} className="shrink-0 h-7 text-xs bg-background">
                        <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
                      </Button>
                    </div>
                  ) : balanceResult ? (
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">Disponible para uso:</div>
                      <div className="text-xl font-bold tabular-nums text-primary">
                        {balanceResult.available} {balanceResult.unit}
                      </div>
                    </div>
                  ) : !loadingBalance ? (
                    <div className="text-sm text-muted-foreground">No disponible</div>
                  ) : (
                    <div className="h-6 w-32 bg-primary/10 animate-pulse rounded" />
                  )}
                </div>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Historial de Envíos a Inventario</h3>
                <ReleaseHistory batchId={id} articuloId={batch.articuloId} />
              </div>
            </div>
          ) : null}
        </ScrollArea>
        {canRelease && batch && balanceResult && (
          <BatchReleaseDialog
            batchId={batch.id}
            articuloId={batch.articuloId}
            articuloName={articulosMap.get(batch.articuloId) || batch.articuloId}
            unit={balanceResult.unit}
            open={releaseOpen}
            onOpenChange={setReleaseOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BalanceCard({ label, value, unit, highlight }: { label: string, value: string, unit: string, highlight?: boolean }) {
  return (
    <div className={`p-4 bg-card flex flex-col items-center justify-center text-center ${highlight ? 'bg-primary/5 text-primary' : ''}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 whitespace-nowrap">{label}</span>
      <span className={`text-lg tabular-nums font-semibold ${highlight ? 'text-primary' : ''}`}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}