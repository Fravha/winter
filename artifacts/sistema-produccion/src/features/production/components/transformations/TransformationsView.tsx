import { useState } from 'react';
import { useTransformations } from '../../api/production.hooks';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TransformationList } from './TransformationList';
import { CreateTransformationDialog } from './CreateTransformationDialog';
import { TransformationDetailDialog } from './TransformationDetailDialog';
import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';

export function TransformationsView() {
  const [page, setPage] = useState(1);
  const [productionOrderId, setProductionOrderId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, error, isFetching, refetch } = useTransformations({
    page,
    pageSize: 10,
    productionOrderId: productionOrderId || undefined
  });

  const { can } = useAuth();
  const canCreate = can('production:transformation_create');

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex min-w-0 w-full sm:w-auto sm:flex-1 sm:max-w-sm items-center gap-2">
          <ProductionOrderSelect 
            value={productionOrderId} 
            onValueChange={v => { setProductionOrderId(v); setPage(1); }}
          />
          {productionOrderId && (
            <Button variant="ghost" size="sm" onClick={() => { setProductionOrderId(''); setPage(1); }}>
              Limpiar
            </Button>
          )}
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Transformación
          </Button>
        )}
      </div>

      <TransformationList 
        data={data}
        isLoading={isLoading}
        error={error}
        isFetching={isFetching}
        isFiltered={!!productionOrderId}
        onRetry={refetch}
        onPageChange={setPage}
        onRowClick={(item) => setDetailId(item.id)}
      />

      <CreateTransformationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(id) => {
          setCreateOpen(false);
          setDetailId(id);
        }}
      />

      <TransformationDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
