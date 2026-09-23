import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionOrderList } from './ProductionOrderList';
import { TransformationOrderList } from './TransformationOrderList';

export function OrdersView() {
  return (
    <Tabs defaultValue="production" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="production" data-testid="tab-orders-production">Órdenes de Producción</TabsTrigger>
        <TabsTrigger value="transformation" data-testid="tab-orders-transformation">Órdenes de Transformación</TabsTrigger>
      </TabsList>

      <TabsContent value="production" className="mt-0 focus-visible:outline-none">
        <ProductionOrderList />
      </TabsContent>
      <TabsContent value="transformation" className="mt-0 focus-visible:outline-none">
        <TransformationOrderList />
      </TabsContent>
    </Tabs>
  );
}
