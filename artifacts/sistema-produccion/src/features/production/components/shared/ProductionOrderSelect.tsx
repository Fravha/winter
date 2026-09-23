import { useState } from 'react';
import { useProductionOrders } from '../../api/production.hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ProductionOrderSelect({ value, onValueChange, disabled }: Props) {
  const [page, setPage] = useState(1);
  // Solo cargamos OPEN por defecto, ya que para transformar normalmente debe estar abierta.
  // Pero si el contrato lo exige, podríamos cargar todas, dejemos status=OPEN por defecto
  const { data, isLoading, error, refetch } = useProductionOrders({ page, pageSize: 20, status: 'OPEN' });

  const items = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 20, total: 0, totalPages: 1 };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger data-testid="select-production-order">
        <SelectValue placeholder="Seleccione una orden de producción..." />
      </SelectTrigger>
      <SelectContent>
        {isLoading && items.length === 0 ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-destructive">
            {mapProductionError(error).code}: {mapProductionError(error).userMessage}
            <div className="mt-2 mb-2 text-[10px] opacity-70">
              Req: {mapProductionError(error).requestId || 'N/A'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); refetch(); }}
              className="w-full text-xs"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Reintentar
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No hay órdenes disponibles.
          </div>
        ) : (
          <>
            {items.map(order => (
              <SelectItem key={order.id} value={order.id}>
                {order.code} - {new Date(order.startDate).toLocaleDateString('es-BO')}
              </SelectItem>
            ))}

            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-2 border-t mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  aria-label="Página anterior"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPage(p => Math.max(1, p - 1)); }}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">{page} / {meta.totalPages}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  aria-label="Página siguiente"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPage(p => Math.min(meta.totalPages, p + 1)); }}
                  disabled={page >= meta.totalPages}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
