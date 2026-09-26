import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Loader2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { CatalogCreateDialog } from './CatalogCreateDialog';
import { CatalogUpdateDialog } from './CatalogUpdateDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CatalogFilters, Catalog, Participant } from '../../types/production.types';

// Use generic pagination component, but standard is not fully implemented in UI folder as a single component sometimes, let's check `ls artifacts/sistema-produccion/src/components/ui/pagination.tsx`

interface CatalogListProps {
  title: string;
  managePermission: string;
  useList: any;
  useCreate: any;
  useUpdate: any;
  useActivate: any;
  useDeactivate: any;
  hasUserId?: boolean;
}

export function CatalogList({
  title,
  managePermission,
  useList,
  useCreate,
  useUpdate,
  useActivate,
  useDeactivate,
  hasUserId = false,
}: CatalogListProps) {
  const { can } = useAuth();
  const { toast } = useToast();
  const [filters, setFilters] = useState<CatalogFilters>({ page: 1, pageSize: 10, search: '' });
  const [searchValue, setSearchValue] = useState('');
  const canManage = can(managePermission);

  const { data, isLoading, isFetching, error, refetch } = useList(filters);
  const activateMutation = useActivate();
  const deactivateMutation = useDeactivate();

  const [createOpen, setCreateOpen] = useState(false);
  const [updateItem, setUpdateItem] = useState<Catalog | null>(null);

  const [confirmStatusItem, setConfirmStatusItem] = useState<{ id: string, active: boolean } | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchValue, page: 1 }));
  };

  const handleStatusChange = async () => {
    if (!confirmStatusItem) return;
    try {
      if (confirmStatusItem.active) {
        await deactivateMutation.mutateAsync(confirmStatusItem.id);
        toast({ title: 'Desactivado correctamente' });
      } else {
        await activateMutation.mutateAsync(confirmStatusItem.id);
        toast({ title: 'Activado correctamente' });
      }
    } catch (err) {
      const prodErr = mapProductionError(err);
      toast({
        title: 'Error al cambiar estado',
        description: `${prodErr.code}: ${prodErr.userMessage}${prodErr.requestId ? ` (Req: ${prodErr.requestId})` : ''}`,
        variant: 'destructive'
      });
    } finally {
      setConfirmStatusItem(null);
    }
  };

  const items: Catalog[] = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0, totalPages: 1 };

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>
            Administración de catálogo.
          </CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto" data-testid={`button-create-${title.toLowerCase()}`}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0 sm:max-w-xl">
            <form onSubmit={handleSearch} className="flex w-full min-w-0 flex-1 gap-2">
              <Input
                placeholder="Buscar..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full"
                data-testid={`input-search-${title.toLowerCase()}`}
              />
              <Button type="submit" variant="secondary" className="shrink-0" aria-label="Buscar" data-testid={`button-search-submit-${title.toLowerCase()}`}>
                <Search className="h-4 w-4" />
              </Button>
            </form>
            <Select
              value={filters.active === undefined ? 'ALL' : filters.active ? 'ACTIVE' : 'INACTIVE'}
              onValueChange={(val) => setFilters(prev => ({ ...prev, active: val === 'ALL' ? undefined : val === 'ACTIVE', page: 1 }))}
            >
              <SelectTrigger className="w-full sm:w-[140px] shrink-0" aria-label="Filtro de estado" data-testid={`select-filter-status-${title.toLowerCase()}`}>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {error ? (
          <div className="p-4 text-center text-destructive">
            Error al cargar los datos. {mapProductionError(error).userMessage}
            <div className="mt-2 text-xs opacity-70">
              Request ID: {mapProductionError(error).requestId || 'N/A'}
            </div>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  {hasUserId && <TableHead>Usuario Vinculado</TableHead>}
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? (hasUserId ? 5 : 4) : (hasUserId ? 4 : 3)} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? (hasUserId ? 5 : 4) : (hasUserId ? 4 : 3)} className="text-center py-8 text-muted-foreground">
                      {filters.search || filters.active !== undefined ? 'No se encontraron resultados para los filtros aplicados.' : 'No se encontraron resultados.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-${title.toLowerCase()}-${item.id}`}>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      {hasUserId && (
                        <TableCell className="text-muted-foreground text-sm">
                          {(item as Participant).userId || '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={item.active ? "default" : "secondary"}>
                          {item.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setUpdateItem(item)}
                              aria-label="Editar"
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmStatusItem({ id: item.id, active: item.active })}
                              aria-label={item.active ? 'Desactivar' : 'Activar'}
                              data-testid={`button-toggle-status-${item.id}`}
                            >
                              {item.active ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
              disabled={meta.page <= 1 || isLoading}
            >
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              Página {meta.page} de {meta.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página siguiente"
              onClick={() => setFilters(prev => ({ ...prev, page: Math.min(meta.totalPages, (prev.page || 1) + 1) }))}
              disabled={meta.page >= meta.totalPages || isLoading}
            >
              Siguiente
            </Button>
          </div>
        )}
      </CardContent>

      {createOpen && (
        <CatalogCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          useCreate={useCreate}
          hasUserId={hasUserId}
          title={title}
        />
      )}

      {updateItem && (
        <CatalogUpdateDialog
          open={!!updateItem}
          onOpenChange={(op) => !op && setUpdateItem(null)}
          useUpdate={useUpdate}
          item={updateItem}
          title={title}
        />
      )}

      <AlertDialog open={!!confirmStatusItem} onOpenChange={(op) => !op && setConfirmStatusItem(null)}>
        <AlertDialogContent className="w-[calc(100%_-_2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar estado?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStatusItem?.active
                ? '¿Estás seguro de que deseas desactivar este registro? No podrá ser utilizado en nuevas operaciones.'
                : '¿Estás seguro de que deseas activar este registro?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange} className={confirmStatusItem?.active ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
