import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compraStatusOptions } from '@/features/compras/types/compra.options';
import { LOT_CLASSIFICATIONS, MOVEMENT_TYPES } from '@/features/inventory/types/inventory.types';
import { optionLabel, reportOptionPaths, useReportOptions, type OptionField } from '../api/report-options';

export type FieldName = OptionField | 'classification' | 'movementType' | 'status' | 'supplier' | 'from' | 'to';
export const labels: Record<FieldName, string> = {
  warehouseId: 'Almacén', articuloId: 'Artículo', classification: 'Clasificación de lote',
  movementType: 'Tipo de movimiento', status: 'Estado', supplier: 'Proveedor',
  productionOrderId: 'Orden de producción', transformationOrderId: 'Orden de transformación',
  productionBatchId: 'Batch de producción', workTypeId: 'Tipo de trabajo',
  containerId: 'Recipiente', from: 'Fecha inicio', to: 'Fecha fin',
};
type FieldProps = { name: FieldName; value: string; onChange: (value: string) => void; error?: string; required?: boolean; productionOrderId?: string };

const LOT_CLASSIFICATION_LABELS = {
  PRODUCTO_ENVASADO: 'Producto envasado',
  PRODUCTO_TERMINADO: 'Producto terminado',
  PRODUCTO_TERMINADO_EXPORTACION: 'Producto terminado de Exportación',
} as const;

export const LOT_CLASSIFICATION_OPTIONS = LOT_CLASSIFICATIONS.map(value => ({
  id: value,
  label: LOT_CLASSIFICATION_LABELS[value],
}));

const choices: Partial<Record<FieldName, { id: string; label: string }[]>> = {
  classification: LOT_CLASSIFICATION_OPTIONS,
  movementType: MOVEMENT_TYPES.map(value => ({ id: value, label: ({ INBOUND: 'Entrada', OUTBOUND: 'Salida', TRANSFER: 'Transferencia', ADJUSTMENT: 'Ajuste' })[value] })),
  status: compraStatusOptions.map(option => ({ id: option.value, label: option.label })),
};

function OptionSelect({ name, value, onChange, required }: FieldProps & { name: OptionField }) {
  const [page, setPage] = useState(1);
  const [inputSearch, setInputSearch] = useState('');
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState(false);
  const [active, setActive] = useState(false);
  const knownLabels = useRef(new Map<string, string>());
  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputSearch]);
  const { data, isLoading, isFetching, error, refetch } = useReportOptions(name, page, search, active && !manual);
  data?.data.forEach(option => knownLabels.current.set(option.id, optionLabel(option)));
  const options = data?.data ?? [];
  return (
    <div className="space-y-2">
      {manual ? (
        <Input value={value} onChange={event => onChange(event.target.value)} placeholder="ID (UUID)" aria-label={`${labels[name]} ID`} data-testid={`input-${name}`} />
      ) : (
        <>
          <Input type="search" value={inputSearch} onFocus={() => setActive(true)} onChange={event => { setActive(true); setInputSearch(event.target.value); setPage(1); }} placeholder={`Buscar ${labels[name].toLowerCase()}...`} aria-label={`Buscar ${labels[name]}`} data-testid={`search-${name}`} />
          {error ? <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
            <p>No se pudo cargar el catálogo de {labels[name].toLowerCase()}.</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => refetch()} data-testid={`retry-options-${name}`}>Reintentar</Button>
          </div> : (
            <Select value={value || (required ? '' : '__all')} onValueChange={selected => onChange(selected === '__all' ? '' : selected)}>
              <SelectTrigger aria-label={labels[name]} onPointerDown={() => setActive(true)} onKeyDown={() => setActive(true)} data-testid={`select-${name}`}>
                <SelectValue placeholder={isLoading ? 'Cargando...' : `Seleccionar ${labels[name].toLowerCase()}`}>{value ? knownLabels.current.get(value) : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!required && <SelectItem value="__all">Todos</SelectItem>}
                {options.map(option => <SelectItem key={option.id} value={option.id}>{optionLabel(option)}</SelectItem>)}
                {(isLoading || isFetching) && <div className="px-2 py-2" role="status"><div className="h-3 w-32 animate-pulse rounded bg-muted" /><span className="sr-only">Cargando opciones</span></div>}
                {!isLoading && !isFetching && !options.length && <p className="px-2 py-2 text-xs text-muted-foreground">Sin resultados para esta búsqueda.</p>}
                {data && data.meta.totalPages > 1 && <div className="flex items-center justify-between border-t px-2 py-1">
                  <Button type="button" size="sm" variant="ghost" disabled={page <= 1} onClick={event => { event.preventDefault(); setPage(current => current - 1); }} data-testid={`previous-${name}`}>Anterior</Button>
                  <span className="text-xs text-muted-foreground">{page} / {data.meta.totalPages}</span>
                  <Button type="button" size="sm" variant="ghost" disabled={page >= data.meta.totalPages} onClick={event => { event.preventDefault(); setPage(current => current + 1); }} data-testid={`next-${name}`}>Siguiente</Button>
                </div>}
              </SelectContent>
            </Select>
          )}
        </>
      )}
      <button type="button" className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-primary" onClick={() => setManual(current => !current)} data-testid={`toggle-id-${name}`}>{manual ? 'Elegir del catálogo' : 'Ingresar ID manualmente'}</button>
    </div>
  );
}

export function ReportField(props: FieldProps) {
  const { name, value, onChange, error, required } = props;
  let control;
  if (name in reportOptionPaths) control = <OptionSelect {...props} name={name as OptionField} />;
  else if (choices[name]) control = (
    <Select value={value || '__all'} onValueChange={selected => onChange(selected === '__all' ? '' : selected)}>
      <SelectTrigger aria-label={labels[name]} data-testid={`select-${name}`}><SelectValue placeholder={`Seleccionar ${labels[name].toLowerCase()}`} /></SelectTrigger>
      <SelectContent><SelectItem value="__all">Todos</SelectItem>{choices[name].map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
  else control = <Input id={`report-${name}`} type={name === 'from' || name === 'to' ? 'date' : 'text'} value={value} onChange={event => onChange(event.target.value)} data-testid={`input-${name}`} />;
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={`report-${name}`} className="text-xs font-medium text-foreground/80">{labels[name]}{required ? ' *' : ''}</Label>{control}{error && <p role="alert" className="text-xs text-destructive" data-testid={`error-${name}`}>{error}</p>}</div>;
}