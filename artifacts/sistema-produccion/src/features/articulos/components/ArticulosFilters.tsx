import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CLASIFICACION_OPTIONS } from '../types/articulo.options';
import type { ArticulosListFilters, Clasificacion } from '../types/articulo.types';
import { useEffect, useState, useRef } from 'react';

type ArticulosFiltersProps = {
  filters: ArticulosListFilters;
  onChange: (filters: ArticulosListFilters) => void;
};

export function ArticulosFilters({ filters, onChange }: ArticulosFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const onChangeRef = useRef(onChange);
  const filtersRef = useRef(filters);
  onChangeRef.current = onChange;
  filtersRef.current = filters;

  useEffect(() => {
    const timer = setTimeout(() => {
      onChangeRef.current({
        ...filtersRef.current,
        search: searchValue.trim() || undefined,
        page: 1,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleClasificacionChange = (value: string) => {
    onChange({ 
      ...filters, 
      clasificacion: value === 'ALL' ? undefined : (value as Clasificacion),
      page: 1 
    });
  };

  const handleActivoChange = (value: string) => {
    let activo: boolean | undefined = undefined;
    if (value === 'true') activo = true;
    if (value === 'false') activo = false;
    
    onChange({ ...filters, activo, page: 1 });
  };

  const clearFilters = () => {
    setSearchValue('');
    onChange({ page: 1, pageSize: filters.pageSize });
  };

  const hasActiveFilters = Boolean(
    searchValue || filters.clasificacion || filters.activo !== undefined
  );

  return (
    <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
      <div className="relative flex-1">
        <label htmlFor="articulos-search" className="sr-only">
          Buscar artículos
        </label>
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="articulos-search"
          aria-label="Buscar artículos"
          placeholder="Buscar por código, nombre o código externo..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
          data-testid="input-search-articulos"
        />
      </div>
      
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-nowrap sm:items-center">
        <Select 
          value={filters.clasificacion || 'ALL'} 
          onValueChange={handleClasificacionChange}
        >
          <SelectTrigger
            className="w-full sm:w-[180px]"
            aria-label="Filtrar por clasificación"
            data-testid="select-clasificacion"
          >
            <SelectValue placeholder="Clasificación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las clasificaciones</SelectItem>
            {CLASIFICACION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filters.activo === undefined ? 'ALL' : String(filters.activo)} 
          onValueChange={handleActivoChange}
        >
          <SelectTrigger
            className="w-full sm:w-[140px]"
            aria-label="Filtrar por estado"
            data-testid="select-estado"
          >
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={clearFilters}
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
