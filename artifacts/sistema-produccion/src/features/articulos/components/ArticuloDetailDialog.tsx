import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useArticulo } from '../api/articulos.hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getClasificacionLabel, UNIDAD_MEDIDA_OPTIONS } from '../types/articulo.options';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '@/lib/api/api-error';

type ArticuloDetailDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  articuloId?: string | null;
};

export function ArticuloDetailDialog({ isOpen, onClose, articuloId }: ArticuloDetailDialogProps) {
  const { data: articulo, isLoading, error, refetch } = useArticulo(articuloId as string, {
    enabled: Boolean(articuloId) && isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Detalle del Artículo</DialogTitle>
          <DialogDescription>
            Información completa del artículo en el catálogo maestro.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-4">
            <AlertCircle className="h-10 w-10 text-destructive opacity-80" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Error al cargar el artículo</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof ApiError && error.code === 'ARTICULO_NOT_FOUND'
                  ? 'El artículo solicitado no existe o ya no está disponible.'
                  : 'No fue posible obtener la información del artículo.'}
              </p>
              {error instanceof ApiError && error.requestId && (
                <p className="text-xs text-muted-foreground font-mono mt-1" data-testid="detail-error-reqid">Req ID: {error.requestId}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2" data-testid="btn-retry-detail">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : articulo ? (
          <div className="space-y-6 py-4 text-sm" data-testid="articulo-detail-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Código Interno</p>
                <p className="font-mono text-foreground" data-testid="detail-codigo">{articulo.codigo}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-1">Código Externo</p>
                <p className="font-mono text-foreground" data-testid="detail-codigo-externo">{articulo.codigoExterno || '-'}</p>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground font-medium mb-1">Nombre o Descripción</p>
              <p className="text-foreground text-base" data-testid="detail-nombre">{articulo.nombre}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground font-medium mb-1">Clasificación</p>
                <p className="text-foreground" data-testid="detail-clasificacion">
                  {getClasificacionLabel(articulo.clasificacion)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-1">Unidad de Medida</p>
                <p className="text-foreground" data-testid="detail-unidad">
                  {UNIDAD_MEDIDA_OPTIONS.find(o => o.value === articulo.unidadMedida)?.label || articulo.unidadMedida}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4 mt-4">
              <div className="md:col-span-2">
                <p className="text-muted-foreground font-medium mb-1">Estado</p>
                {articulo.activo ? (
                  <Badge variant="default" className="bg-success text-success-foreground border-success font-normal" data-testid="detail-estado-activo">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal" data-testid="detail-estado-inactivo">
                    Inactivo
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-1">Fecha de Creación</p>
                <p className="text-foreground" data-testid="detail-created-at">
                  {new Date(articulo.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium mb-1">Última Actualización</p>
                <p className="text-foreground" data-testid="detail-updated-at">
                  {new Date(articulo.updatedAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="outline" data-testid="btn-close-detail">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
