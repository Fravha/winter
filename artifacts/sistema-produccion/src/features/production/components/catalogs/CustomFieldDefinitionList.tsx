import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { CustomFieldDefinitionCreateDialog } from './CustomFieldDefinitionCreateDialog';
import { CustomFieldDefinitionUpdateDialog } from './CustomFieldDefinitionUpdateDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CustomFieldDefinition } from '../../types/production.types';
import { useCustomFieldDefinitions, useActivateCustomFieldDefinition, useDeactivateCustomFieldDefinition } from '../../api/production.hooks';

export function CustomFieldDefinitionList() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canManage = can('production:custom_fields_manage');

  const { data: items, isLoading, error, isFetching } = useCustomFieldDefinitions();
  const activateMutation = useActivateCustomFieldDefinition();
  const deactivateMutation = useDeactivateCustomFieldDefinition();

  const [createOpen, setCreateOpen] = useState(false);
  const [updateItem, setUpdateItem] = useState<CustomFieldDefinition | null>(null);
  const [confirmStatusItem, setConfirmStatusItem] = useState<{ id: string, active: boolean } | null>(null);

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

  const mapEntityType = (type: string) => {
    const map: Record<string, string> = {
      'PRODUCER': 'Productor',
      'GRAPE_VARIETY': 'Variedad de Uva',
      'GRAPE_RECEPTION': 'Recepción de Uva'
    };
    return map[type] || type;
  };

  const mapDataType = (type: string) => {
    const map: Record<string, string> = {
      'TEXT': 'Texto',
      'INTEGER': 'Entero',
      'DECIMAL': 'Decimal',
      'BOOLEAN': 'Booleano',
      'DATE': 'Fecha',
      'SELECT': 'Selección'
    };
    return map[type] || type;
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-xl">Campos Personalizados</CardTitle>
          <CardDescription>
            Configuración de campos adicionales para diversas entidades.
          </CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto" data-testid="button-create-custom-field">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isFetching && !isLoading && (
          <div className="flex justify-end mb-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <div className="p-4 text-center text-destructive">
            Error al cargar los datos. {mapProductionError(error).code}: {mapProductionError(error).userMessage}
            <div className="mt-2 text-xs opacity-70">
              Request ID: {mapProductionError(error).requestId || 'N/A'}
            </div>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Tipo de Dato</TableHead>
                  <TableHead>Requerido</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : !items?.data || items.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      No se encontraron resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.data.map((item) => (
                    <TableRow key={item.id} data-testid={`row-custom-field-${item.id}`}>
                      <TableCell>{mapEntityType(item.entityType)}</TableCell>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell>{item.label}</TableCell>
                      <TableCell>{mapDataType(item.dataType)}</TableCell>
                      <TableCell>{item.required ? 'Sí' : 'No'}</TableCell>
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
                              data-testid={`button-edit-custom-field-${item.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmStatusItem({ id: item.id, active: item.active })}
                              aria-label={item.active ? 'Desactivar' : 'Activar'}
                              data-testid={`button-toggle-custom-field-status-${item.id}`}
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
      </CardContent>

      {createOpen && (
        <CustomFieldDefinitionCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {updateItem && (
        <CustomFieldDefinitionUpdateDialog
          open={!!updateItem}
          onOpenChange={(op) => !op && setUpdateItem(null)}
          item={updateItem}
        />
      )}

      <AlertDialog open={!!confirmStatusItem} onOpenChange={(op) => !op && setConfirmStatusItem(null)}>
        <AlertDialogContent className="w-[calc(100%_-_2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar estado?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStatusItem?.active
                ? '¿Estás seguro de que deseas desactivar este campo personalizado?'
                : '¿Estás seguro de que deseas activar este campo personalizado?'}
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
