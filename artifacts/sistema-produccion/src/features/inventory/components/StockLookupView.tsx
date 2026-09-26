import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useStock, useAvailableStock } from '../api/inventory.hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Search, Package, CheckCircle2, RefreshCw } from 'lucide-react';
import { mapInventoryError } from '../api/inventory.error';
import { ArticuloSelect, WarehouseSelect } from './SharedSelects';

import { Articulo } from '../../articulos/types/articulo.types';
import type { Warehouse } from '../types/inventory.types';

export function StockLookupView() {
  const { can } = useAuth();
  const [warehouseId, setWarehouseId] = useState('');
  const [articuloId, setArticuloId] = useState('');
  const [lotId, setLotId] = useState('');
  
  const [filters, setFilters] = useState<{ warehouseId: string; articuloId: string; inventoryLotId?: string } | null>(null);
  const [loadedArticulos, setLoadedArticulos] = useState<Articulo[]>([]);
  const [loadedWarehouses, setLoadedWarehouses] = useState<Warehouse[]>([]);
  const [selectedArticulo, setSelectedArticulo] = useState<Articulo | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  const { data: stockData, isLoading: loadingStock, error: stockError, isFetching: fetchingStock, refetch: refetchStock } = useStock(
    filters || { warehouseId: '', articuloId: '' },
    { enabled: Boolean(filters) }
  );

  const { data: availableData, isLoading: loadingAvailable, error: availableError, isFetching: fetchingAvailable, refetch: refetchAvailable } = useAvailableStock(
    filters || { warehouseId: '', articuloId: '' },
    { enabled: Boolean(filters) }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (warehouseId && articuloId) {
      const newLotId = lotId.trim() || undefined;
      const isSame = filters?.warehouseId === warehouseId && filters?.articuloId === articuloId && filters?.inventoryLotId === newLotId;
      
      if (isSame) {
        refetchStock();
        refetchAvailable();
      } else {
        setSelectedArticulo(loadedArticulos.find((article) => article.id === articuloId) ?? selectedArticulo);
        setSelectedWarehouse(loadedWarehouses.find((warehouse) => warehouse.id === warehouseId) ?? selectedWarehouse);
        setFilters({ warehouseId, articuloId, inventoryLotId: newLotId });
      }
    }
  };

  const hasData = Boolean(stockData && availableData);
  const isInitialLoading = Boolean((loadingStock || loadingAvailable) && !hasData);
  const isRefetching = Boolean((fetchingStock || fetchingAvailable) && hasData);
  
  const hasError = stockError || availableError;
  const mappedError = hasError ? mapInventoryError(stockError || availableError) : null;
  
  const articulo = selectedArticulo ?? loadedArticulos.find(a => a.id === filters?.articuloId);
  const articuloUnit = articulo?.unidadMedida || '';
  
  const handleRetry = () => {
    refetchStock();
    refetchAvailable();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Almacén *</Label>
              <WarehouseSelect value={warehouseId} onChange={setWarehouseId} onWarehousesLoaded={setLoadedWarehouses} />
            </div>
            
            <div className="space-y-2">
              <Label>Artículo *</Label>
              <ArticuloSelect value={articuloId} onChange={setArticuloId} onArticuloLoaded={setLoadedArticulos} />
            </div>

            <div className="space-y-2">
              <Label>ID de Lote (Opcional)</Label>
              <Input 
                placeholder="UUID del lote" 
                value={lotId} 
                onChange={(e) => setLotId(e.target.value)} 
                data-testid="input-lot-id"
              />
            </div>

            <Button type="submit" disabled={!warehouseId || !articuloId || isInitialLoading || isRefetching} data-testid="button-search-stock">
              {isInitialLoading || isRefetching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      {!filters && !isInitialLoading && !mappedError && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          <Search className="h-8 w-8 mb-2 opacity-50" />
          <p>Seleccione un almacén y un artículo para consultar el stock.</p>
        </div>
      )}

      {isInitialLoading && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-4" />
          <p>Consultando stock...</p>
        </div>
      )}

      {mappedError && !hasData && (
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex flex-col items-center text-center">
          <AlertCircle className="h-10 w-10 mb-2 opacity-80" />
          <p className="font-medium text-lg">{mappedError.userMessage}</p>
          {mappedError.requestId && <p className="text-xs mt-1 opacity-80 font-mono">Req ID: {mappedError.requestId}</p>}
          <Button variant="outline" size="sm" onClick={handleRetry} className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/20">Reintentar Búsqueda</Button>
        </div>
      )}

      {hasData && stockData && availableData && (
        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex gap-2 items-center flex-wrap mb-2 text-sm">
            <span className="font-medium text-muted-foreground flex items-center bg-muted/50 px-2 py-1 rounded border border-border">
               Almacén: <span className="text-foreground ml-2 font-mono">
                 {selectedWarehouse ? `${selectedWarehouse.codigo} - ${selectedWarehouse.nombre}` : filters?.warehouseId}
               </span>
            </span>
            <span className="font-medium text-muted-foreground flex items-center bg-muted/50 px-2 py-1 rounded border border-border">
              Artículo: <span className="text-foreground ml-2 font-mono">{articulo?.codigo} - {articulo?.nombre}</span>
            </span>
            {filters?.inventoryLotId && (
              <span className="font-medium text-muted-foreground flex items-center bg-muted/50 px-2 py-1 rounded border border-border">
                Lote: <span className="text-foreground ml-2 font-mono">{filters.inventoryLotId}</span>
              </span>
            )}
          </div>
          {mappedError && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-md text-warning flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" /> 
                <span className="text-sm font-medium">No se pudo actualizar la información más reciente. Se muestran los últimos datos conocidos.</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRetry} className="text-warning"><RefreshCw className="h-4 w-4 mr-2" /> Reintentar</Button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={`border-primary/20 shadow-sm relative overflow-hidden ${isRefetching ? 'opacity-60' : ''}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Package className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Stock Físico Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono tracking-tight" data-testid="value-stock-total">
                  {stockData.quantity}
                </span>
                <span className="text-lg text-muted-foreground">{articuloUnit || stockData.unit}</span>
              </div>
              {stockData.hasNegativeStock && (
                <div className="mt-4 flex items-center gap-2 text-warning bg-warning/10 p-2 rounded-md border border-warning/20">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">¡Atención! Existen lotes con stock negativo.</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-success/20 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-success">
              <CheckCircle2 className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                Stock Disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono tracking-tight text-success" data-testid="value-stock-available">
                  {availableData!.quantity}
                </span>
                <span className="text-lg text-muted-foreground">{articuloUnit || availableData!.unit}</span>
              </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Cantidad disponible informada por el backend.
                </p>
            </CardContent>
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}
