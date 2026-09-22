import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockLookupView } from '../../features/inventory/components/StockLookupView';
import { WarehousesView } from '../../features/inventory/components/WarehousesView';
import { LotsView } from '../../features/inventory/components/LotsView';
import { OperationsView } from '../../features/inventory/components/OperationsView';

export default function InventarioPage() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto py-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Inventario"
        description="Gestión de almacenes, stock físico, trazabilidad de lotes y movimientos."
      />
      
      <Tabs defaultValue="stock" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-none">
          <TabsList className="mb-2 min-w-max">
            <TabsTrigger value="stock" className="px-6">Consulta de Stock</TabsTrigger>
            <TabsTrigger value="operaciones" className="px-6">Operaciones Físicas</TabsTrigger>
            <TabsTrigger value="almacenes" className="px-6">Almacenes</TabsTrigger>
            <TabsTrigger value="lotes" className="px-6">Lotes y Trazabilidad</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="stock" className="mt-4 focus-visible:outline-none">
          <StockLookupView />
        </TabsContent>
        <TabsContent value="operaciones" className="mt-4 focus-visible:outline-none">
          <OperationsView />
        </TabsContent>
        <TabsContent value="almacenes" className="mt-4 focus-visible:outline-none">
          <WarehousesView />
        </TabsContent>
        <TabsContent value="lotes" className="mt-4 focus-visible:outline-none">
          <LotsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
