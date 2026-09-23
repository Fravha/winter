import { useState } from 'react';
import { useBatchReleases } from '../../api/production.hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeftRight, Clock, User, FileText, XCircle } from 'lucide-react';
import { ReverseReleaseDialog } from './ReverseReleaseDialog';
import { useAuth } from '@/auth/AuthContext';
import type { ProductionReleaseDto, ProductionBatchTraceReleaseDto } from '../../types/production.types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { mapProductionError } from '../../api/production.error';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

export function ReleaseHistory({ batchId, articuloId }: { batchId: string; articuloId: string }) {
  const { data: releasesData, isLoading, error, refetch } = useBatchReleases(batchId);
  const releases = releasesData?.data || [];
  const { can } = useAuth();
  const canReverse = can('production:inventory_release_reverse');

  const [reversingRelease, setReversingRelease] = useState<ProductionReleaseDto | null>(null);

    if (error) {
    const mapped = mapProductionError(error);
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" /> Error al cargar el historial
        </div>
        <p className="text-sm">{mapped.userMessage}</p>
        {mapped.requestId && <p className="text-xs font-mono opacity-80">Req: {mapped.requestId}</p>}
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 bg-background text-foreground border-destructive/20 hover:bg-destructive/10">
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reintentar
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>;
  }

  if (releases.length === 0) {
    return <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
      No se han realizado envíos a inventario para este lote.
    </div>;
  }

  return (
    <div className="space-y-4">
      {releases.map(release => (
        <div key={release.releaseId} className={`border rounded-lg p-4 relative ${release.status === 'REVERSED' ? 'opacity-80 bg-muted/30' : 'bg-card'}`}>
          {release.status === 'REVERSED' && (
            <Badge variant="secondary" className="absolute top-4 right-4 bg-muted text-muted-foreground">
              <XCircle className="w-3 h-3 mr-1" /> Revertido
            </Badge>
          )}

          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-lg font-semibold ${release.status === 'REVERSED' ? 'line-through text-muted-foreground' : ''}`}>
                  {release.quantity} {release.unit}
                </span>
                <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{release.warehouse.name}</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Lote Inv: <span className="font-mono">{release.inventoryLot.lotCode}</span></div>
                <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {format(new Date(release.occurredAt), "dd/MM/yyyy HH:mm")}</div>
                <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Actor: <span className="font-mono text-xs">{release.actorUserId.split('-')[0]}</span></div>
                {release.observations && <div className="mt-2 text-sm italic">"{release.observations}"</div>}
              </div>
            </div>

            {release.status === 'ACTIVE' && release.reversible && canReverse && (
              <Button variant="outline" size="sm" onClick={() => setReversingRelease(release)}>
                Revertir Envío
              </Button>
            )}
          </div>

          {release.status === 'REVERSED' && release.reversal && (
            <div className="mt-4 pt-3 border-t text-sm border-dashed">
              <div className="text-destructive font-medium mb-1">Detalles de reversión:</div>
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{release.reversal.reason}</span>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <span>{format(new Date(release.reversal.occurredAt), "dd/MM/yyyy HH:mm")}</span>
                  <span>Por: <span className="font-mono">{release.reversal.actorUserId.split('-')[0]}</span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {reversingRelease && (
        <ReverseReleaseDialog
          batchId={batchId}
          articuloId={articuloId}
          release={reversingRelease}
          open={!!reversingRelease}
          onOpenChange={(open) => !open && setReversingRelease(null)}
        />
      )}
    </div>
  );
}
