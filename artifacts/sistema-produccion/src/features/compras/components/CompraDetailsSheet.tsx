import type { Compra } from '../types/compra.types';
import { CompraStatusBadge } from './CompraStatusBadge';
import { useArticulos } from '../../articulos/api/articulos.hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapCompraError } from '../api/compras.error';

interface CompraDetailsSheetProps {
  compra: Compra | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshError?: Error | null;
  onRetry: () => void;
}

export function CompraDetailsSheet({ compra, open, onOpenChange, refreshError, onRetry }: CompraDetailsSheetProps) {
  const { data: articulosData, isLoading: isLoadingArticulos, error: articulosError, refetch: refetchArticulos } = useArticulos({ page: 1, pageSize: 100 }, { enabled: open });
  const articulosMap = new Map(articulosData?.items.map(a => [a.id, a]) || []);
  const mappedArticulosError = articulosError ? mapCompraError(articulosError) : null;
  const mappedRefreshError = refreshError ? mapCompraError(refreshError) : null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Intl.DateTimeFormat('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Intl.DateTimeFormat('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-2xl overflow-y-auto" data-testid="sheet-compra-details">
        <SheetHeader className="mb-6">
          <SheetTitle>Detalles de Compra</SheetTitle>
          <SheetDescription>
            Información completa y artículos de la compra.
          </SheetDescription>
        </SheetHeader>

        {mappedRefreshError && (
          <div className="mb-4 flex flex-col gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>
              No se pudo actualizar el detalle. Se mantienen los últimos datos disponibles.
              {mappedRefreshError.requestId && (
                <span className="ml-2 font-mono text-xs">Req ID: {mappedRefreshError.requestId}</span>
              )}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
          </div>
        )}

        {!compra ? (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-bold">{compra.supplierName}</h3>
                <p className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono text-xs">{compra.id}</span></p>
              </div>
              <CompraStatusBadge status={compra.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">NIT / CI</span>
                <span className="font-medium">{compra.supplierTaxId || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Documento</span>
                <span className="font-medium">{compra.documentNumber || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Fecha Documento</span>
                <span className="font-medium">{formatDate(compra.documentDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Moneda</span>
                <span className="font-medium">{compra.currency || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Fecha Registro</span>
                <span className="font-medium">{formatDateTime(compra.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Última Actualización</span>
                <span className="font-medium">{formatDateTime(compra.updatedAt)}</span>
              </div>
            </div>

            {compra.observations && (
              <div>
                <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-2">Observaciones</span>
                <p className="text-sm bg-muted/30 p-3 rounded-md border text-foreground leading-relaxed whitespace-pre-wrap">
                  {compra.observations}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold tracking-tight">Artículos Solicitados ({compra.items.length})</h4>
              </div>

              {articulosError && (
                <div className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md flex flex-col gap-2 border border-destructive/20 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">
                    <span className="flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> No fue posible actualizar los datos de artículos.</span>
                    {mappedArticulosError?.requestId && (
                      <span className="mt-1 block font-mono text-xs">Req ID: {mappedArticulosError.requestId}</span>
                    )}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchArticulos()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Reintentar</Button>
                </div>
              )}

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Artículo</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compra.items.map((item) => {
                      const art = articulosMap.get(item.articuloId);
                      const missingArt = !art && !isLoadingArticulos && !articulosError;

                      const artName = art
                        ? `${art.codigo} - ${art.nombre}`
                        : (
                          <span className="font-mono text-xs opacity-50 flex items-center gap-1">
                            {item.articuloId}
                            {isLoadingArticulos && <Loader2 className="h-3 w-3 animate-spin" />}
                            {missingArt && <AlertCircle className="h-3 w-3 text-warning" aria-label="Artículo no encontrado" />}
                          </span>
                        );

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{artName}</TableCell>
                          <TableCell>{item.brand || '-'}</TableCell>
                          <TableCell className="text-right">{item.requestedQuantity}</TableCell>
                          <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                          <TableCell className="text-right">{item.unitPrice || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
