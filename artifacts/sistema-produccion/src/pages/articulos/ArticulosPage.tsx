import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { useArticulos } from '@/features/articulos/api/articulos.hooks';
import { ArticulosTable } from '@/features/articulos/components/ArticulosTable';
import { ArticulosFilters } from '@/features/articulos/components/ArticulosFilters';
import { ArticuloFormDialog } from '@/features/articulos/components/ArticuloFormDialog';
import { ArticuloDetailDialog } from '@/features/articulos/components/ArticuloDetailDialog';
import type { ArticulosListFilters } from '@/features/articulos/types/articulo.types';
import { ApiError } from '@/lib/api/api-error';

export default function ArticulosPage() {
  const { can } = useAuth();
  const canCreate = can('articulos:create');

  const [filters, setFilters] = useState<ArticulosListFilters>({
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading, isFetching, error, refetch } = useArticulos(filters);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleCreate = () => {
    setActiveId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (id: string) => {
    setActiveId(id);
    setIsFormOpen(true);
  };

  const handleView = (id: string) => {
    setActiveId(id);
    setIsDetailOpen(true);
  };

  const totalPages = data?.meta.totalPages || 1;
  const currentPage = filters.page || 1;
  const hasActiveFilters = Boolean(filters.search || filters.clasificacion || filters.activo !== undefined);

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Catálogo de Artículos"
        description="Maestro de artículos utilizados por Compras, Inventario y Producción. Mantenga una nomenclatura clara."
        actions={
          <div className="flex items-center gap-4">
            {isFetching && !isLoading && !error && (
              <div className="flex items-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Actualizando...</span>
              </div>
            )}
            {canCreate && (
              <Button onClick={handleCreate} data-testid="btn-new-articulo">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Artículo
              </Button>
            )}
          </div>
        }
      />

      <ArticulosFilters 
        filters={filters} 
        onChange={setFilters}
      />

      {error && !data ? (
        <div className="rounded-md border border-border bg-card p-12 flex flex-col items-center justify-center text-center gap-4 shadow-sm">
          <AlertCircle className="h-10 w-10 text-destructive opacity-80" />
          <div className="space-y-1">
            <p className="font-medium text-foreground text-lg">Error al cargar el catálogo</p>
            <p className="text-muted-foreground">
              No fue posible obtener los artículos. Reintenta en unos momentos.
            </p>
            {error instanceof ApiError && error.requestId && (
              <p className="text-xs text-muted-foreground font-mono mt-1" data-testid="page-error-reqid">Req ID: {error.requestId}</p>
            )}
          </div>
          <Button variant="outline" onClick={() => refetch()} className="mt-4" data-testid="btn-retry-page">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && data && (
            <div
              className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              role="status"
              data-testid="status-refresh-error"
            >
              <span>
                No se pudo actualizar el catálogo. Los últimos datos disponibles siguen visibles.
                {error instanceof ApiError && error.requestId && (
                  <span className="ml-2 font-mono text-xs" data-testid="refresh-error-reqid">
                    Req ID: {error.requestId}
                  </span>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </div>
          )}
          <ArticulosTable 
            articulos={data?.items} 
            isLoading={isLoading} 
            hasActiveFilters={hasActiveFilters}
            canCreate={canCreate}
            onEdit={handleEdit} 
            onView={handleView}
            onCreate={handleCreate}
          />

          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-end gap-4 pt-2">
              <div className="text-sm font-medium text-muted-foreground">
                Página {currentPage} de {totalPages} ({data?.meta.total || 0} resultados)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1 || isFetching}
                  onClick={() => handlePageChange(currentPage - 1)}
                  data-testid="btn-prev-page"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages || isFetching}
                  onClick={() => handlePageChange(currentPage + 1)}
                  data-testid="btn-next-page"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ArticuloFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setActiveId(null);
        }}
        articuloId={activeId}
      />

      <ArticuloDetailDialog
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setActiveId(null);
        }}
        articuloId={activeId}
      />
    </div>
  );
}
