import { PageHeader } from '@/components/shared/PageHeader';
import { BatchTraceView } from '@/features/production/components/batches/BatchTraceView';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const BATCH_TRACE_PERMISSION = 'production:read' as const;

export default function BatchTracePage({ batchId }: { batchId: string }) {
  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Link href="/produccion" className="shrink-0">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="trace-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          eyebrow="Trazabilidad"
          title="Historial de Lote"
          description="Visualización completa de la historia del lote y sus relaciones."
        />
      </div>

      <BatchTraceView batchId={batchId} />
    </div>
  );
}
