import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useProductionContainers, useActivateProductionContainer, useDeactivateProductionContainer } from '../../api/production.hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit2, Info, ArrowLeftRight, CheckCircle2, SplitSquareHorizontal, PowerOff, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mapProductionError } from '../../api/production.error';
import { ContainerFormDialog } from './ContainerFormDialog';
import { ContainerDetailDialog } from './ContainerDetailDialog';
import { ContainerAssignDialog } from './ContainerAssignDialog';
import { ContainerTransferTotalDialog } from './ContainerTransferTotalDialog';
import { ContainerTransferPartialDialog } from './ContainerTransferPartialDialog';
import { ProductionContainer } from '../../types/production.types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function ContainersView() {
  const { can } = useAuth();
  const canManage = can('production:container_manage');
  const canAssign = can('production:container_assign');
  const canTransfer = can('production:container_transfer');

  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useProductionContainers();

  const [formOpen, setFormOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<ProductionContainer | null>(null);
  
  const [detailId, setDetailId] = useState<string | null>(null);
  
  const [assignContainer, setAssignContainer] = useState<ProductionContainer | null>(null);
  const [transferTotalSource, setTransferTotalSource] = useState<ProductionContainer | null>(null);
  const [transferPartialSource, setTransferPartialSource] = useState<ProductionContainer | null>(null);

  const activateContainer = useActivateProductionContainer();
  const deactivateContainer = useDeactivateProductionContainer();

  const mappedError = error ? mapProductionError(error) : null;
  const filtered = data?.data.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase()) || 
    (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
    c.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar recipientes..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canManage && (
          <Button onClick={() => { setEditingContainer(null); setFormOpen(true); }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Recipiente
          </Button>
        )}
      </div>

      {mappedError && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md text-sm border border-destructive/20">
          {mappedError.userMessage}
        </div>
      )}

      <div className="border rounded-md bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Recipiente</th>
                <th className="px-4 py-3 font-medium">Capacidad</th>
                <th className="px-4 py-3 font-medium">Ubicación</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Contenido Actual</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No se encontraron recipientes</td></tr>
              ) : (
                filtered?.map(container => (
                  <tr key={container.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-container-${container.code}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary cursor-pointer hover:underline" onClick={() => setDetailId(container.id)} data-testid={`link-container-${container.code}`}>
                        {container.code}
                      </div>
                      <div className="text-xs text-muted-foreground">{container.name || container.type || 'Sin nombre'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {container.capacity} <span className="text-xs text-muted-foreground">{container.capacityUnit}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {container.location || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={container.status === 'DISPONIBLE' ? 'default' : container.status === 'OCUPADO' ? 'secondary' : 'outline'} className="text-[10px]">
                        {container.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {container.currentOccupancy ? (
                        <div>
                          <div className="font-medium">{container.currentOccupancy.quantity} {container.currentOccupancy.unit}</div>
                          <div className="text-[10px] text-muted-foreground">Lote: {container.currentOccupancy.batchCode}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Vacío</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setDetailId(container.id)} data-testid={`button-detail-${container.code}`}>
                          <Info className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-medium" data-testid={`button-operate-${container.code}`}>Operar</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canAssign && container.status !== 'FUERA_DE_SERVICIO' && (
                              <DropdownMenuItem onClick={() => setAssignContainer(container)} data-testid={`menu-assign-${container.code}`}>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Asignar Contenido
                              </DropdownMenuItem>
                            )}
                            {canTransfer && container.status === 'OCUPADO' && (
                              <>
                                <DropdownMenuItem onClick={() => setTransferTotalSource(container)} data-testid={`menu-transfer-total-${container.code}`}>
                                  <ArrowLeftRight className="h-4 w-4 mr-2" /> Trasladar Todo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTransferPartialSource(container)} data-testid={`menu-transfer-partial-${container.code}`}>
                                  <SplitSquareHorizontal className="h-4 w-4 mr-2" /> Trasladar Parcial
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {canManage && (
                              <>
                                <DropdownMenuItem onClick={() => { setEditingContainer(container); setFormOpen(true); }} data-testid={`menu-edit-${container.code}`}>
                                  <Edit2 className="h-4 w-4 mr-2" /> Editar Metadatos
                                </DropdownMenuItem>
                                {container.status !== 'FUERA_DE_SERVICIO' ? (
                                  <DropdownMenuItem onClick={() => deactivateContainer.mutate(container.id)} className="text-warning" data-testid={`menu-deactivate-${container.code}`}>
                                    <PowerOff className="h-4 w-4 mr-2" /> Fuera de Servicio
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => activateContainer.mutate(container.id)} className="text-success" data-testid={`menu-activate-${container.code}`}>
                                    <Power className="h-4 w-4 mr-2" /> Habilitar
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ContainerFormDialog 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        container={editingContainer} 
      />

      {detailId && (
        <ContainerDetailDialog
          id={detailId}
          open={!!detailId}
          onOpenChange={(v) => !v && setDetailId(null)}
        />
      )}

      {assignContainer && (
        <ContainerAssignDialog
          container={assignContainer}
          open={!!assignContainer}
          onOpenChange={(v) => !v && setAssignContainer(null)}
        />
      )}

      {transferTotalSource && (
        <ContainerTransferTotalDialog
          source={transferTotalSource}
          open={!!transferTotalSource}
          onOpenChange={(v) => !v && setTransferTotalSource(null)}
        />
      )}

      {transferPartialSource && (
        <ContainerTransferPartialDialog
          source={transferPartialSource}
          open={!!transferPartialSource}
          onOpenChange={(v) => !v && setTransferPartialSource(null)}
        />
      )}
    </div>
  );
}