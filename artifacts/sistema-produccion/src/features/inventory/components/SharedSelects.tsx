import { useState, useEffect } from 'react';
import { useArticulos } from '../../articulos/api/articulos.hooks';
import { Articulo } from '../../articulos/types/articulo.types';
import { useActiveWarehouses } from '../api/inventory.hooks';
import type { Warehouse } from '../types/inventory.types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mapInventoryError } from '../api/inventory.error';

export function ArticuloSelect({ value, onChange, disabled, onArticuloLoaded }: { value: string, onChange: (v: string) => void, disabled?: boolean, onArticuloLoaded?: (articulos: Articulo[]) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, error, isFetching, refetch } = useArticulos({ activo: true, pageSize: 100, search: debouncedSearch });
  const mappedError = error ? mapInventoryError(error) : null;
  const hasData = !!data?.items;

  useEffect(() => {
    if (data?.items && onArticuloLoaded) {
      onArticuloLoaded(data.items);
    }
  }, [data?.items, onArticuloLoaded]);

  return (
    <div className="space-y-2">
      <Input 
        placeholder="Buscar artículo (nombre o código)..." 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={disabled}
        className="w-full text-sm"
      />
      
      {mappedError && !hasData ? (
        <div className="text-xs text-destructive flex items-center bg-destructive/10 p-2 rounded border border-destructive/20">
          <AlertCircle className="h-4 w-4 mr-2 shrink-0" /> 
          <div className="flex-1 flex flex-col">
            <span>{mappedError.userMessage}</span>
            {mappedError.requestId && <span className="text-[10px] font-mono opacity-80">Req ID: {mappedError.requestId}</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 shrink-0 hover:bg-destructive/20 hover:text-destructive" onClick={() => refetch()} aria-label="Reintentar">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Select value={value} onValueChange={onChange} disabled={disabled || (isLoading && !hasData)}>
          <SelectTrigger>
            <SelectValue placeholder={(isLoading && !hasData) ? "Cargando..." : "Seleccione artículo"} />
          </SelectTrigger>
          <SelectContent>
            {isFetching && hasData && <div className="p-2 text-xs text-muted-foreground flex items-center justify-center border-b"><Loader2 className="h-3 w-3 animate-spin mr-2" /> Actualizando...</div>}
            {mappedError && hasData && (
              <div className="p-2 text-xs text-warning bg-warning/10 flex justify-between items-center border-b">
                <div className="flex flex-col">
                  <span className="flex items-center font-medium"><AlertCircle className="h-3 w-3 mr-1" /> Error al actualizar</span>
                  {mappedError.requestId && <span className="text-[10px] font-mono mt-0.5">Req ID: {mappedError.requestId}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-warning/20 hover:text-warning" onClick={() => refetch()} aria-label="Reintentar">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}
            {data?.items.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.codigo} - {a.nombre}</SelectItem>
            ))}
            {data?.items.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">No se encontraron artículos activos.</div>}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function WarehouseSelect({ value, onChange, disabled, placeholder = "Seleccione almacén", onWarehousesLoaded }: { value: string, onChange: (v: string) => void, disabled?: boolean, placeholder?: string, onWarehousesLoaded?: (warehouses: Warehouse[]) => void }) {
  const { data, isLoading, error, isFetching, refetch } = useActiveWarehouses();
  const mappedError = error ? mapInventoryError(error) : null;
  const hasData = !!data;

  useEffect(() => {
    if (data && onWarehousesLoaded) onWarehousesLoaded(data);
  }, [data, onWarehousesLoaded]);

  if (mappedError && !hasData) {
    return (
      <div className="text-xs text-destructive flex items-center bg-destructive/10 p-2 rounded border border-destructive/20">
        <AlertCircle className="h-4 w-4 mr-2 shrink-0" /> 
        <div className="flex-1 flex flex-col">
          <span>Error al cargar almacenes: {mappedError.userMessage}</span>
          {mappedError.requestId && <span className="text-[10px] font-mono opacity-80">Req ID: {mappedError.requestId}</span>}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 ml-2 shrink-0 hover:bg-destructive/20 hover:text-destructive" onClick={() => refetch()} aria-label="Reintentar">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || (isLoading && !hasData)}>
      <SelectTrigger>
        <SelectValue placeholder={(isLoading && !hasData) ? "Cargando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isFetching && hasData && <div className="p-2 text-xs text-muted-foreground flex items-center justify-center border-b"><Loader2 className="h-3 w-3 animate-spin mr-2" /> Actualizando...</div>}
        {mappedError && hasData && (
          <div className="p-2 text-xs text-warning bg-warning/10 flex justify-between items-center border-b">
            <div className="flex flex-col">
              <span className="flex items-center font-medium"><AlertCircle className="h-3 w-3 mr-1" /> Error al actualizar</span>
              {mappedError.requestId && <span className="text-[10px] font-mono mt-0.5">Req ID: {mappedError.requestId}</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-warning/20 hover:text-warning" onClick={() => refetch()} aria-label="Reintentar">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        )}
        {data?.map(w => (
          <SelectItem key={w.id} value={w.id}>{w.codigo} - {w.nombre}</SelectItem>
        ))}
        {data?.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">No hay almacenes activos.</div>}
      </SelectContent>
    </Select>
  );
}
