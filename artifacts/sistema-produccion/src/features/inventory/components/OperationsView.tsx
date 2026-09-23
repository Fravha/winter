import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InboundForm, OutboundForm, TransferForm, AdjustForm } from './MovementForm';
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, SlidersHorizontal } from 'lucide-react';

export function OperationsView() {
  const { can } = useAuth();
  
  const canInbound = can('inventory:inbound');
  const canOutbound = can('inventory:outbound');
  const canTransfer = can('inventory:transfer');
  const canAdjust = can('inventory:adjust');

  const defaultTab = canInbound ? 'inbound' : canOutbound ? 'outbound' : canTransfer ? 'transfer' : canAdjust ? 'adjust' : '';

  if (!defaultTab) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
        No tienes permisos para realizar operaciones físicas en el inventario.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto gap-2 bg-transparent p-0">
          <TabsTrigger 
            value="inbound" 
            disabled={!canInbound}
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border flex-col items-center justify-center py-3 h-auto"
          >
            <ArrowDownRight className="h-5 w-5 mb-1 text-success" />
            <span className="font-medium">Entrada</span>
          </TabsTrigger>
          <TabsTrigger 
            value="outbound" 
            disabled={!canOutbound}
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border flex-col items-center justify-center py-3 h-auto"
          >
            <ArrowUpRight className="h-5 w-5 mb-1 text-destructive" />
            <span className="font-medium">Salida</span>
          </TabsTrigger>
          <TabsTrigger 
            value="transfer" 
            disabled={!canTransfer}
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border flex-col items-center justify-center py-3 h-auto"
          >
            <ArrowRightLeft className="h-5 w-5 mb-1 text-info" />
            <span className="font-medium">Transferencia</span>
          </TabsTrigger>
          <TabsTrigger 
            value="adjust" 
            disabled={!canAdjust}
            className="data-[state=active]:bg-card data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border flex-col items-center justify-center py-3 h-auto"
          >
            <SlidersHorizontal className="h-5 w-5 mb-1 text-warning" />
            <span className="font-medium">Ajuste</span>
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          {canInbound && (
            <TabsContent value="inbound" className="m-0 focus-visible:outline-none">
              <InboundForm title="Registrar Entrada" description="Ingreso físico de mercadería al almacén (no asociado a orden de compra automatizada)." />
            </TabsContent>
          )}
          {canOutbound && (
            <TabsContent value="outbound" className="m-0 focus-visible:outline-none">
              <OutboundForm title="Registrar Salida" description="Retiro físico de mercadería del almacén." />
            </TabsContent>
          )}
          {canTransfer && (
            <TabsContent value="transfer" className="m-0 focus-visible:outline-none">
              <TransferForm title="Transferencia entre Almacenes" description="Mover mercadería de un almacén a otro." />
            </TabsContent>
          )}
          {canAdjust && (
            <TabsContent value="adjust" className="m-0 focus-visible:outline-none">
              <AdjustForm title="Ajuste de Inventario" description="Corrección de stock por conteo físico o mermas no registradas." />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
