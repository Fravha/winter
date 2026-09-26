import { useState } from 'react';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCompras, useCompra } from '../../features/compras/api/compras.hooks';
import { CompraStatus } from '../../features/compras/types/compra.types';
import { mapCompraError } from '../../features/compras/api/compras.error';
import { ComprasTable } from '../../features/compras/components/ComprasTable';
import { CompraCreateEditSheet } from '../../features/compras/components/CompraCreateEditSheet';
import { CompraDetailsSheet } from '../../features/compras/components/CompraDetailsSheet';
import { CompraReceiveDialog } from '../../features/compras/components/CompraReceiveDialog';
import { CompraCancelDialog } from '../../features/compras/components/CompraCancelDialog';
import { useAuth } from '@/auth/AuthContext';

function DetailLoadingErrorModal({ open, onOpenChange, isLoading, error, onRetry }: {
  open: boolean; onOpenChange: (open: boolean) => void; isLoading: boolean; error: Error | null; onRetry: () => void;
}) {
  const mapped = error ? mapCompraError(error) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cargando Detalles</DialogTitle>
          <DialogDescription className="sr-only">Estado de carga de la compra</DialogDescription>
        </DialogHeader>
        <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
          {isLoading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Obteniendo información...</p>
            </>
          ) : mapped ? (
             <>
               <AlertCircle className="h-8 w-8 text-destructive" />
               <p className="text-sm text-destructive font-medium">{mapped.userMessage}</p>
               {mapped.requestId && <p className="text-xs text-muted-foreground">Req ID: {mapped.requestId}</p>}
               <Button onClick={onRetry} variant="outline" size="sm">Reintentar</Button>
             </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ModalState =
  | { type: 'NONE' }
  | { type: 'CREATE' }
  | { type: 'EDIT'; id: string }
  | { type: 'VIEW'; id: string }
  | { type: 'RECEIVE'; id: string }
  | { type: 'CANCEL'; id: string };

export default function ComprasPage() {
  const { can } = useAuth();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CompraStatus | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>({ type: 'NONE' });

  // Fetch list
  const { data: listData, isLoading: isLoadingList, isFetching: isFetchingList, error: listError, refetch: refetchList } = useCompras({
    page,
    pageSize: 20,
    status: statusFilter,
  });

  // Fetch detail for active action
  const activeId = modal.type !== 'NONE' && modal.type !== 'CREATE' ? modal.id : '';
  const { data: activeCompra, isLoading: isLoadingActive, error: activeError, refetch: refetchActive } = useCompra(activeId, {
    enabled: !!activeId
  });

  const closeModal = () => setModal({ type: 'NONE' });

  const handleStatusFilterChange = (status: CompraStatus | undefined) => {
    setStatusFilter(status);
    setPage(1);
  };

  const isDetailModal = modal.type === 'EDIT' || modal.type === 'VIEW' || modal.type === 'RECEIVE' || modal.type === 'CANCEL';
  const isViewReady = modal.type === 'VIEW' && Boolean(activeCompra) && !isLoadingActive;
  const isActionReady = modal.type !== 'VIEW' && Boolean(activeCompra) && !isLoadingActive && !activeError;
  const isDetailReady = isViewReady || isActionReady;
  const requiresRegistered = modal.type === 'EDIT' || modal.type === 'RECEIVE' || modal.type === 'CANCEL';
  const hasStateConflict = requiresRegistered && isDetailReady && activeCompra !== undefined && activeCompra.status !== 'REGISTERED';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto py-6">
      <div className="flex items-start justify-between">
        <PageHeader
          eyebrow="Operaciones"
          title="Compras"
          description="Registro, recepción y seguimiento de compras a proveedores."
        />

        {can('compras:create') && (
          <Button
            onClick={() => setModal({ type: 'CREATE' })}
            data-testid="button-create-compra"
            className="shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva Compra
          </Button>
        )}
      </div>

      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <ComprasTable
          compras={listData?.items || []}
          isLoading={isLoadingList}
          isFetching={isFetchingList}
          error={listError}
          hasLoadedData={Boolean(listData)}
          onRetry={refetchList}
          page={listData?.meta.page || 1}
          totalPages={listData?.meta.totalPages || 1}
          totalCount={listData?.meta.total || 0}
          onPageChange={setPage}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          onView={(id) => setModal({ type: 'VIEW', id })}
          onEdit={(id) => setModal({ type: 'EDIT', id })}
          onReceive={(id) => setModal({ type: 'RECEIVE', id })}
          onCancel={(id) => setModal({ type: 'CANCEL', id })}
          canCreate={can('compras:create')}
          onCreate={() => setModal({ type: 'CREATE' })}
        />
      </div>

      {modal.type === 'CREATE' && (
        <CompraCreateEditSheet
          mode="CREATE"
          compra={null}
          open={true}
          onOpenChange={(open) => !open && closeModal()}
        />
      )}

      {isDetailModal && !isDetailReady && (
        <DetailLoadingErrorModal
          open={true}
          onOpenChange={(open) => !open && closeModal()}
          isLoading={isLoadingActive}
          error={activeError}
          onRetry={refetchActive}
        />
      )}

      {hasStateConflict && (
        <Dialog open onOpenChange={(open) => !open && closeModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>La compra cambió de estado</DialogTitle>
              <DialogDescription>
                Esta acción solo está disponible para compras registradas. El estado actual es{' '}
                {activeCompra?.status === 'RECEIVED' ? 'Recibida' : 'Cancelada'}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={closeModal} data-testid="button-close-state-conflict">
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isDetailModal && isDetailReady && !hasStateConflict && (
        <>
          {modal.type === 'EDIT' && (
            <CompraCreateEditSheet
              mode="EDIT"
              compra={activeCompra ?? null}
              open={true}
              onOpenChange={(open) => !open && closeModal()}
            />
          )}
          {modal.type === 'VIEW' && (
            <CompraDetailsSheet
              compra={activeCompra ?? null}
              open={true}
              onOpenChange={(open) => !open && closeModal()}
              refreshError={activeError}
              onRetry={refetchActive}
            />
          )}
          {modal.type === 'RECEIVE' && (
            <CompraReceiveDialog
              compra={activeCompra ?? null}
              open={true}
              onOpenChange={(open) => !open && closeModal()}
            />
          )}
          {modal.type === 'CANCEL' && (
            <CompraCancelDialog
              compra={activeCompra ?? null}
              open={true}
              onOpenChange={(open) => !open && closeModal()}
            />
          )}
        </>
      )}
    </div>
  );
}
