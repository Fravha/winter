import { useState } from 'react';
import { useWarehouses, useActivateWarehouse, useDeactivateWarehouse } from '../api/inventory.hooks';
import { Warehouse } from '../types/inventory.types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, MoreHorizontal, Plus, Power, PowerOff, Edit2, AlertCircle } from 'lucide-react';
import { WarehouseFormSheet } from './WarehouseFormSheet';
import { mapInventoryError } from '../api/inventory.error';
import { useToast } from '@/hooks/use-toast';

export function WarehousesView() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: warehouses, isLoading, error, refetch } = useWarehouses({ page, pageSize });

  const [formState, setFormState] = useState<{ mode: 'CREATE' | 'EDIT'; warehouse: Warehouse | null; open: boolean }>({ mode: 'CREATE', warehouse: null, open: false });
  const [deactivateAlert, setDeactivateAlert] = useState<{ open: boolean; warehouse: Warehouse | null }>({ open: false, warehouse: null });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);

  const activateMutation = useActivateWarehouse({
    onSuccess: () => toast({ title: 'Almacén activado' }),
    onError: (err) => {
      const mapped = mapInventoryError(err);
      toast({ title: 'Error', description: `${mapped.userMessage}${mapped.requestId ? ` (Req ID: ${mapped.requestId})` : ''}`, variant: 'destructive' });
    }
  });

  const deactivateMutation = useDeactivateWarehouse({
    onSuccess: () => {
      toast({ title: 'Almacén desactivado' });
      setDeactivateAlert({ open: false, warehouse: null });
      setErrorMsg(null);
      setReqId(null);
    },
    onError: (err) => {
      const mapped = mapInventoryError(err);
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
    }
  });

  const handleDeactivateConfirm = () => {
    if (deactivateAlert.warehouse) {
      setErrorMsg(null);
      setReqId(null);
      deactivateMutation.mutate(deactivateAlert.warehouse.id);
    }
  };

  const hasNextPage = warehouses && warehouses.length === pageSize;
  const hasPrevPage = page > 1;

  const mappedError = error ? mapInventoryError(error) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium tracking-tight">Gestión de Almacenes</h3>
        {can('inventory:warehouse_create') && (
          <Button onClick={() => setFormState({ mode: 'CREATE', warehouse: null, open: true })} size="sm" data-testid="button-new-warehouse">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Almacén
          </Button>
        )}
      </div>

      {mappedError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex flex-col gap-2 items-start">
          <div className="flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> {mappedError.userMessage}</div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Reintentar</Button>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : warehouses?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No se encontraron almacenes.
                </TableCell>
              </TableRow>
            ) : (
              warehouses?.map((w) => (
                <TableRow key={w.id} data-testid={`row-warehouse-${w.codigo}`}>
                  <TableCell className="font-mono text-xs">{w.codigo}</TableCell>
                  <TableCell className="font-medium">{w.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{w.ubicacion || '-'}</TableCell>
                  <TableCell>
                    {w.activo ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">Activo</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${w.codigo}`}>
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {can('inventory:warehouse_update') && (
                          <DropdownMenuItem onClick={() => setFormState({ mode: 'EDIT', warehouse: w, open: true })}>
                            <Edit2 className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                        )}
                        {can('inventory:warehouse_activate') && !w.activo && (
                          <DropdownMenuItem disabled={activateMutation.isPending || deactivateMutation.isPending} onClick={() => activateMutation.mutate(w.id)}>
                            <Power className="mr-2 h-4 w-4 text-success" /> Activar
                          </DropdownMenuItem>
                        )}
                        {can('inventory:warehouse_deactivate') && w.activo && (
                          <DropdownMenuItem disabled={activateMutation.isPending || deactivateMutation.isPending} onClick={() => {
                            setErrorMsg(null);
                            setReqId(null);
                            setDeactivateAlert({ open: true, warehouse: w });
                          }} className="text-destructive focus:text-destructive">
                            <PowerOff className="mr-2 h-4 w-4" /> Desactivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={!hasPrevPage || isLoading}
        >
          Anterior
        </Button>
        <div className="text-sm font-medium px-2 text-muted-foreground">Página {page}</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasNextPage || isLoading}
        >
          Siguiente
        </Button>
      </div>

      <WarehouseFormSheet
        mode={formState.mode}
        warehouse={formState.warehouse}
        open={formState.open}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
      />

      <AlertDialog 
        open={deactivateAlert.open} 
        onOpenChange={(open) => {
          if (!deactivateMutation.isPending && !open) {
            setDeactivateAlert({ open: false, warehouse: null });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar almacén?</AlertDialogTitle>
            <AlertDialogDescription>
              El almacén <strong>{deactivateAlert.warehouse?.nombre}</strong> ya no estará disponible para nuevas operaciones de inventario.
              Esta acción fallará si el almacén aún contiene stock físico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMsg && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex flex-col items-start gap-1">
              <span className="flex items-center"><AlertCircle className="h-4 w-4 mr-2 shrink-0" /> {errorMsg}</span>
              {reqId && <span className="text-xs font-mono opacity-80 mt-1">Req ID: {reqId}</span>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeactivateConfirm(); }}
              disabled={deactivateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
