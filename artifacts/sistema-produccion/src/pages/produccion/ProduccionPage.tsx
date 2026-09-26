import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { OrdersView } from '@/features/production/components/orders/OrdersView';
import { CatalogsView } from '@/features/production/components/catalogs/CatalogsView';
import { ReceptionsView } from '@/features/production/components/receptions/ReceptionsView';
import { BatchesView } from '@/features/production/components/batches/BatchesView';
import { WorksView } from '@/features/production/components/works/WorksView';
import { MeasurementsView } from '@/features/production/components/measurements/MeasurementsView';
import { TransformationsView } from '@/features/production/components/transformations/TransformationsView';
import { ContainersView } from '@/features/production/components/containers/ContainersView';
import { useAuth } from '@/auth/AuthContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProduccionPage() {
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const { can } = useAuth();
  const canReadProduction = can('production:read');

  useEffect(() => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) return;

    const updateScrollEdges = () => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      setScrollEdges((current) => {
        const next = {
          left: scroller.scrollLeft > 1,
          right: maxScrollLeft - scroller.scrollLeft > 1,
        };
        return current.left === next.left && current.right === next.right ? current : next;
      });
    };

    updateScrollEdges();
    scroller.addEventListener('scroll', updateScrollEdges, { passive: true });
    window.addEventListener('resize', updateScrollEdges);

    const resizeObserver = new ResizeObserver(updateScrollEdges);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) resizeObserver.observe(scroller.firstElementChild);

    return () => {
      scroller.removeEventListener('scroll', updateScrollEdges);
      window.removeEventListener('resize', updateScrollEdges);
      resizeObserver.disconnect();
    };
  }, []);

  const scrollTabs = (direction: -1 | 1) => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * Math.max(scroller.clientWidth * 0.75, 120),
      behavior: 'smooth',
    });
  };

  if (!canReadProduction) return null;

  return (
    <div className="flex min-w-0 flex-col gap-6 max-w-[1400px] mx-auto py-6">
      <PageHeader
        eyebrow="Operaciones"
        title="Producción"
        description="Gestión de órdenes, trabajos en planta, mediciones, recepciones y lotes."
      />

      <Tabs defaultValue="trabajos" className="w-full min-w-0">
        <div className="w-full min-w-0">
          <div
            ref={tabsScrollerRef}
            id="production-tabs-scroll-region"
            className="w-full overflow-x-auto pb-2 scrollbar-none border-b"
          >
            <TabsList className="mb-0 min-w-max h-auto p-0 bg-transparent gap-4 sm:gap-6 rounded-none" aria-describedby="production-tabs-scroll-hint">
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
          <div className="flex items-center justify-between gap-2 pt-2">
            <p id="production-tabs-scroll-hint" className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground" aria-label="Las ocho secciones de Producción están disponibles en la barra horizontal; desliza para recorrerlas todas">
              <span>Usa las flechas o desliza para ver las 8 secciones</span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </p>
            {(scrollEdges.left || scrollEdges.right) && (
              <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Controles para desplazar las secciones">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Desplazar pestañas a la izquierda"
                  aria-controls="production-tabs-scroll-region"
                  data-testid="button-scroll-production-tabs-left"
                  disabled={!scrollEdges.left}
                  onClick={() => scrollTabs(-1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Desplazar pestañas a la derecha"
                  aria-controls="production-tabs-scroll-region"
                  data-testid="button-scroll-production-tabs-right"
                  disabled={!scrollEdges.right}
                  onClick={() => scrollTabs(1)}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
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
