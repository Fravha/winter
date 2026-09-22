import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ArticuloActions } from './ArticuloActions';
import type { Articulo } from '../types/articulo.types';
import { CLASIFICACION_OPTIONS, UNIDAD_MEDIDA_OPTIONS } from '../types/articulo.options';

type ArticulosTableProps = {
  articulos?: Articulo[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  canCreate: boolean;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onCreate: () => void;
};

export function ArticulosTable({ 
  articulos, 
  isLoading, 
  hasActiveFilters,
  canCreate,
  onEdit, 
  onView,
  onCreate 
}: ArticulosTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>U.M.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!articulos?.length) {
    if (hasActiveFilters) {
      return (
        <div className="rounded-md border border-border bg-card shadow-sm p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <p className="font-medium text-foreground">No se encontraron resultados</p>
          <p className="text-sm">No hay artículos que coincidan con los filtros actuales.</p>
        </div>
      );
    }
    
    return (
      <div className="rounded-md border border-border bg-card shadow-sm p-12 text-center flex flex-col items-center gap-4">
        <div className="text-muted-foreground">
          <p className="font-medium text-foreground">El catálogo está vacío</p>
          <p className="text-sm">Aún no se han registrado artículos en el sistema.</p>
        </div>
        {canCreate && (
          <Button onClick={onCreate} data-testid="btn-empty-create">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Artículo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="font-semibold text-foreground">Código</TableHead>
            <TableHead className="font-semibold text-foreground">Nombre</TableHead>
            <TableHead className="font-semibold text-foreground">Clasificación</TableHead>
            <TableHead className="font-semibold text-foreground">U.M.</TableHead>
            <TableHead className="font-semibold text-foreground">Estado</TableHead>
            <TableHead className="w-[80px] text-right font-semibold text-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articulos.map((articulo) => {
            const clasificacionLabel = CLASIFICACION_OPTIONS.find(o => o.value === articulo.clasificacion)?.label || articulo.clasificacion;
            const umLabel = UNIDAD_MEDIDA_OPTIONS.find(o => o.value === articulo.unidadMedida)?.label || articulo.unidadMedida;

            return (
              <TableRow key={articulo.id} data-testid={`row-articulo-${articulo.id}`} className="group">
                <TableCell>
                  <div className="font-mono text-sm font-medium text-foreground">{articulo.codigo}</div>
                  {articulo.codigoExterno && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span title="Código Externo">Ext:</span> {articulo.codigoExterno}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-foreground">{articulo.nombre}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal text-xs bg-muted/50 text-muted-foreground">
                    {clasificacionLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-foreground">{umLabel}</TableCell>
                <TableCell>
                  {articulo.activo ? (
                    <Badge variant="default" className="bg-success text-success-foreground hover:bg-success border-success font-normal">
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ArticuloActions 
                    articulo={articulo} 
                    onEdit={() => onEdit(articulo.id)} 
                    onView={() => onView(articulo.id)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
