import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrdersView } from '@/features/production/components/orders/OrdersView';
import { CatalogsView } from '@/features/production/components/catalogs/CatalogsView';
import { ReceptionsView } from '@/features/production/components/receptions/ReceptionsView';
import { BatchesView } from '@/features/production/components/batches/BatchesView';
import { WorksView } from '@/features/production/components/works/WorksView';
import { MeasurementsView } from '@/features/production/components/measurements/MeasurementsView';
import { TransformationsView } from '@/features/production/components/transformations/TransformationsView';
import { ContainersView } from '@/features/production/components/containers/ContainersView';
import { useAuth } from '@/auth/AuthContext';

export default function ProduccionPage() {
  const { can } = useAuth();
  const canReadProduction = can('production:read');

  if (!canReadProduction) return null;

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto py-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Producción"
        description="Gestión de órdenes, trabajos en planta, mediciones, recepciones y lotes."
      />

      <Tabs defaultValue="trabajos" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-none border-b">
          <TabsList className="mb-0 min-w-max h-auto p-0 bg-transparent gap-6 rounded-none">
            <TabsTrigger value="trabajos" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-trabajos">Trabajos</TabsTrigger>
            <TabsTrigger value="mediciones" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-mediciones">Mediciones</TabsTrigger>
            <TabsTrigger value="transformaciones" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-transformaciones">Transformaciones</TabsTrigger>
            <TabsTrigger value="recepciones" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-recepciones">Recepciones</TabsTrigger>
            <TabsTrigger value="lotes" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-lotes">Lotes</TabsTrigger>
            <TabsTrigger value="recipientes" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-recipientes">Recipientes</TabsTrigger>
            <TabsTrigger value="ordenes" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-ordenes">Órdenes</TabsTrigger>
            <TabsTrigger value="catalogos" className="px-1 py-3 h-auto data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" data-testid="tab-catalogos">Catálogos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="trabajos" className="mt-6 focus-visible:outline-none">
          <WorksView />
        </TabsContent>

        <TabsContent value="mediciones" className="mt-6 focus-visible:outline-none">
          <MeasurementsView />
        </TabsContent>

        <TabsContent value="transformaciones" className="mt-6 focus-visible:outline-none">
          <TransformationsView />
        </TabsContent>

        <TabsContent value="recepciones" className="mt-6 focus-visible:outline-none">
          <ReceptionsView />
        </TabsContent>

        <TabsContent value="lotes" className="mt-6 focus-visible:outline-none">
          <BatchesView />
        </TabsContent>

        <TabsContent value="recipientes" className="mt-6 focus-visible:outline-none">
          <ContainersView />
        </TabsContent>

        <TabsContent value="ordenes" className="mt-6 focus-visible:outline-none">
          <OrdersView />
        </TabsContent>

        <TabsContent value="catalogos" className="mt-6 focus-visible:outline-none">
          <CatalogsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
