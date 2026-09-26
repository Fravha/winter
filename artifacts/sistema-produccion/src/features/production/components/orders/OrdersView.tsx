import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionOrderList } from './ProductionOrderList';
import { TransformationOrderList } from './TransformationOrderList';

export function OrdersView() {
  return (
    <Tabs defaultValue="production" className="w-full min-w-0">
      <div className="w-full overflow-x-auto pb-2 scrollbar-none">
        <TabsList className="mb-4 min-w-max">
          <TabsTrigger value="production" data-testid="tab-orders-production">Órdenes de Producción</TabsTrigger>
          <TabsTrigger value="transformation" data-testid="tab-orders-transformation">Órdenes de Transformación</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="production" className="mt-0 focus-visible:outline-none">
        <ProductionOrderList />
      </TabsContent>
      <TabsContent value="transformation" className="mt-0 focus-visible:outline-none">
        <TransformationOrderList />
      </TabsContent>
    </Tabs>
  );
}
