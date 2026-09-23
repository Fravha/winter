import { useState, useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArticuloSelect, WarehouseSelect } from './SharedSelects';
import { useMovements } from '../api/inventory.hooks';
import { MovementType } from '../types/inventory.types';
import { AlertCircle, Filter, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { mapInventoryError } from '../api/inventory.error';

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  INBOUND: 'Entrada',
  OUTBOUND: 'Salida',
  TRANSFER: 'Transferencia',
  ADJUSTMENT: 'Ajuste',
};

export function MovementsView() {
  const { can } = useAuth();
  
  // Pending filters (what the user is currently selecting)
  const [articuloId, setArticuloId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');
  
  // Committed filters (what the query actually uses)
  const [committedFilters, setCommittedFilters] = useState<{ articuloId: string; warehouseId?: string; type?: MovementType } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo(() => {
    if (!committedFilters) return null;
    return {
      articuloId: committedFilters.articuloId,
      warehouseId: committedFilters.warehouseId,
      type: committedFilters.type,
      page,
      pageSize,
    };
  }, [committedFilters, page, pageSize]);

  const { data, isLoading, isFetching, error, refetch } = useMovements(
    filters || { articuloId: '' },
    { enabled: !!filters }
  );

  const mappedError = error ? mapInventoryError(error) : null;

  const handleApplyFilters = () => {
    if (!articuloId) return;
    setCommittedFilters({
      articuloId,
      warehouseId: warehouseId === 'ALL' ? undefined : warehouseId,
      type: type === 'ALL' ? undefined : (type as MovementType),
    });
    setPage(1);
  };

  const handleClearFilters = () => {
    setArticuloId('');
    setWarehouseId('ALL');
    setType('ALL');
    setCommittedFilters(null);
    setPage(1);
  };

  if (!can('inventory:read')) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">Acceso denegado</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              No tienes los permisos necesarios para consultar los movimientos de inventario.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/La_Paz'
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Historial de Movimientos</CardTitle>
          <CardDescription>Consulta el kárdex de un artículo específico.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4 space-y-2">
              <Label>Artículo *</Label>
              <ArticuloSelect value={articuloId} onChange={setArticuloId} />
            </div>
            
            <div className="md:col-span-3 space-y-2">
              <Label>Almacén</Label>
              <WarehouseSelect 
                value={warehouseId} 
                onChange={setWarehouseId} 
                allowAll
                allLabel="Todos los almacenes"
              />
            </div>
            
            <div className="md:col-span-3 space-y-2">
              <Label>Tipo de movimiento</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los tipos</SelectItem>
                  <SelectItem value="INBOUND">Entrada</SelectItem>
                  <SelectItem value="OUTBOUND">Salida</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2 flex gap-2">
              <Button 
                className="w-full" 
                onClick={handleApplyFilters}
                disabled={!articuloId || isLoading}
              >
                <Filter className="h-4 w-4 mr-2" /> Consultar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!committedFilters ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/20">
              <Filter className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg">Selecciona un artículo para consultar sus movimientos.</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/20">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Cargando movimientos...</p>
            </div>
          ) : mappedError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md border border-destructive/20">
                <AlertCircle className="h-10 w-10 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
                <p className="text-sm mb-4">{mappedError.userMessage}</p>
                {mappedError.requestId && (
                  <p className="text-xs font-mono opacity-80 mb-4">Req ID: {mappedError.requestId}</p>
                )}
                <Button variant="outline" onClick={() => refetch()} className="border-destructive/30 hover:bg-destructive/20">
                  <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
                </Button>
              </div>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/20">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Filter className="h-6 w-6 opacity-50" />
              </div>
              <p className="text-lg font-medium text-foreground">No se encontraron movimientos</p>
              <p className="text-sm mt-1">No hay resultados para los filtros seleccionados.</p>
              <Button variant="link" onClick={handleClearFilters} className="mt-4">
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <div className="relative">
              {isFetching && !isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="bg-background shadow-md border px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Actualizando...
                  </div>
                </div>
              )}
              
              <div className="w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Fecha</TableHead>
                      <TableHead className="whitespace-nowrap">Tipo</TableHead>
                      <TableHead className="whitespace-nowrap">Artículo</TableHead>
                      <TableHead className="whitespace-nowrap">Almacén Origen</TableHead>
                      <TableHead className="whitespace-nowrap">Almacén Destino</TableHead>
                      <TableHead className="whitespace-nowrap">Lote</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Cantidad</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Saldo Ant.</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Saldo Res.</TableHead>
                      <TableHead className="whitespace-nowrap">Fuente</TableHead>
                      <TableHead className="min-w-[200px]">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(mov.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-xs">
                          <span className={`inline-flex px-2 py-1 rounded-full border ${
                            mov.type === 'INBOUND' ? 'bg-success/10 text-success border-success/20' :
                            mov.type === 'OUTBOUND' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            mov.type === 'TRANSFER' ? 'bg-info/10 text-info border-info/20' :
                            'bg-warning/10 text-warning-foreground border-warning/20'
                          }`}>
                            {MOVEMENT_TYPE_LABELS[mov.type] || mov.type}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <span className="font-mono font-medium">{mov.articulo.codigo}</span> - {mov.articulo.nombre}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {mov.warehouse.codigo} - {mov.warehouse.nombre}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {mov.destinationWarehouse ? `${mov.destinationWarehouse.codigo} - ${mov.destinationWarehouse.nombre}` : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-mono">
                          {mov.lot ? mov.lot.lotCode : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono font-semibold">
                          <span className={
                            mov.type === 'INBOUND' ? 'text-success' :
                            mov.type === 'OUTBOUND' ? 'text-destructive' :
                            mov.type === 'ADJUSTMENT' && Number(mov.quantity) > 0 ? 'text-success' :
                            mov.type === 'ADJUSTMENT' && Number(mov.quantity) < 0 ? 'text-destructive' : ''
                          }>
                            {mov.type === 'OUTBOUND' ? '-' : (mov.type === 'INBOUND' ? '+' : '')}{mov.quantity}
                          </span>
                          <span className="text-muted-foreground font-sans text-[10px] ml-1">{mov.unit}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                          {mov.stockBefore}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono font-bold text-xs">
                          {mov.resultingStock}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs max-w-[150px] truncate" title={mov.source}>
                          {mov.source}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {mov.reason || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {data?.pagination && data.pagination.totalPages > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/5">
                  <div className="text-sm text-muted-foreground">
                    Mostrando página <span className="font-medium text-foreground">{data.pagination.page}</span> de <span className="font-medium text-foreground">{data.pagination.totalPages}</span>
                    <span className="mx-2">•</span>
                    <span className="font-medium text-foreground">{data.pagination.total}</span> resultados
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={data.pagination.page <= 1 || isFetching}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={data.pagination.page >= data.pagination.totalPages || isFetching}
                    >
                      Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
