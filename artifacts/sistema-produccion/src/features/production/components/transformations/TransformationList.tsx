import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Eye, Loader2 } from 'lucide-react';
import type { Transformation, ListEnvelope } from '../../types/production.types';
import { useProductionOrders, useTransformationOrders, useProductionWorks, useWorkTypes } from '../../api/production.hooks';
import { mapProductionError } from '../../api/production.error';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useMemo } from 'react';

interface Props {
  data: ListEnvelope<Transformation> | undefined;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  isFiltered: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onRowClick: (item: Transformation) => void;
}

export function TransformationList({ data, isLoading, error, isFetching, isFiltered, onRetry, onPageChange, onRowClick }: Props) {
  const { data: orders } = useProductionOrders({ pageSize: 100 });
  const { data: tOrders } = useTransformationOrders({ pageSize: 100 });
  const { data: works } = useProductionWorks({ pageSize: 100 });
  const { data: workTypes } = useWorkTypes({ pageSize: 100 });

  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const tOrdersMap = useMemo(() => new Map(tOrders?.data.map(o => [o.id, o.code])), [tOrders]);
  const worksMap = useMemo(() => new Map(works?.data.map(w => [w.id, w])), [works]);
  const workTypesMap = useMemo(() => new Map(workTypes?.data.map(w => [w.id, `${w.code} · ${w.name}`])), [workTypes]);

  if (error && !data) {
    const mapped = mapProductionError(error);
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="font-semibold">Error al cargar las transformaciones</p>
        <p className="text-sm mt-1">{mapped.userMessage}</p>
        <p className="text-xs font-mono mt-1 opacity-70">Código: {mapped.code}</p>
        {mapped.requestId && <p className="text-xs font-mono mt-1 opacity-70">Req: {mapped.requestId}</p>}
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && data && (
        <div className="p-2 text-xs text-warning bg-warning/10 flex justify-between items-center border border-warning/20 rounded-md">
          <div className="flex flex-col">
            <span className="flex items-center font-medium"><AlertCircle className="h-3 w-3 mr-1" /> Error al actualizar</span>
            <span className="text-[10px] font-mono mt-0.5">Código: {mapProductionError(error).code}</span>
            {mapProductionError(error).requestId && <span className="text-[10px] font-mono mt-0.5">Req ID: {mapProductionError(error).requestId}</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-warning/20 hover:text-warning" onClick={() => onRetry()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}

      {isFetching && !isLoading && data && (
        <div className="text-xs text-muted-foreground flex items-center justify-end">
          <Loader2 className="h-3 w-3 animate-spin mr-1" /> Actualizando...
        </div>
      )}

      <ScrollArea className="w-full whitespace-nowrap rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Orden Prod.</TableHead>
              <TableHead>Orden Transf.</TableHead>
              <TableHead>Trabajo</TableHead>
              <TableHead>Inputs</TableHead>
              <TableHead>Outputs</TableHead>
              <TableHead>Pérdidas</TableHead>
              <TableHead>Observaciones</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !data ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {isFiltered ? 'No se encontraron transformaciones para esta orden.' : 'No hay transformaciones registradas.'}
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((item) => {
                const work = item.productionWorkId ? worksMap.get(item.productionWorkId) : null;
                const workTypeName = work ? workTypesMap.get(work.workTypeId) : undefined;
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(item)}>
                    <TableCell className="font-medium">{new Date(item.performedAt).toLocaleString('es-BO')}</TableCell>
                    <TableCell>{ordersMap.get(item.productionOrderId) || 'No disponible'}</TableCell>
                    <TableCell>{item.transformationOrderId ? (tOrdersMap.get(item.transformationOrderId) || 'No disponible') : '-'}</TableCell>
                    <TableCell>{item.productionWorkId ? (work ? `${workTypeName || 'Tipo no disponible'} · ${new Date(work.performedAt).toLocaleDateString('es-BO')}` : 'No disponible') : 'No asociado'}</TableCell>
                    <TableCell>{item.inputs.length}</TableCell>
                    <TableCell>{item.outputs.length}</TableCell>
                    <TableCell>{item.losses.length}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.observations || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRowClick(item); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {data.data.length} de {data.meta.total} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.page === 1}
              onClick={() => onPageChange(data.meta.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.page === data.meta.totalPages}
              onClick={() => onPageChange(data.meta.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
