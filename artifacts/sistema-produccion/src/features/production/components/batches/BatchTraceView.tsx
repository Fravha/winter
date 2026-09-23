import { ArrowLeftRight, Database, Undo2 } from 'lucide-react';
import { Ban } from 'lucide-react';
import { useState, useMemo } from 'react';
import {
  useProductionBatchTrace, useProductionOrders, useTransformationOrders,
  useParticipants, useProducers, useGrapeVarieties, useMeasurementTypes
} from '../../api/production.hooks';
import { mapProductionError } from '../../api/production.error';
import { Link } from 'wouter';
import {
  AlertCircle, ArrowRight, ArrowDownRight, GitBranch, GitMerge, GitPullRequest, GitCommit,
  RefreshCw, Loader2, Package2, Beaker, Truck, FileText, ClipboardList,
  Scale, Box, AlertTriangle, XCircle, Droplets, Clock, User, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ProductionBatchTraceDto, CorrectionDto } from '../../types/production.types';
import { Separator } from '@/components/ui/separator';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-BO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDecimal(val: string | number | null | undefined) {
  if (val === null || val === undefined) return '-';
  return String(val);
}

export function BatchTraceView({ batchId }: { batchId: string }) {
  const { data: trace, isLoading, error, refetch, isFetching } = useProductionBatchTrace(batchId);
  const { data: ordersData } = useProductionOrders({ page: 1, pageSize: 100 });
  const { data: tfOrdersData } = useTransformationOrders({ page: 1, pageSize: 100 });
  const { data: participantsData } = useParticipants({ page: 1, pageSize: 100 });
  const { data: producersData } = useProducers({ page: 1, pageSize: 100 });
  const { data: varietiesData } = useGrapeVarieties({ page: 1, pageSize: 100 });
  const { data: measurementTypesData } = useMeasurementTypes({ page: 1, pageSize: 100 });

  const articulosMap = useMemo(
    () => new Map(trace?.batches.flatMap(batch => batch.article
      ? [[batch.article.id, `${batch.article.codigo} · ${batch.article.nombre}`] as const]
      : [])),
    [trace],
  );
  const ordersMap = useMemo(() => new Map(ordersData?.data.map(o => [o.id, o.code])), [ordersData]);
  const tfOrdersMap = useMemo(() => new Map(tfOrdersData?.data.map(o => [o.id, o.code])), [tfOrdersData]);
  const participantsMap = useMemo(() => new Map(participantsData?.data.map(p => [p.id, p.name])), [participantsData]);
  const producersMap = useMemo(() => new Map(producersData?.data.map(p => [p.id, p.name])), [producersData]);
  const varietiesMap = useMemo(() => new Map(varietiesData?.data.map(v => [v.id, v.name])), [varietiesData]);
  const measurementTypesMap = useMemo(() => new Map(measurementTypesData?.data.map(m => [m.id, `${m.name} (${m.code})`])), [measurementTypesData]);

  const mappedError = error ? mapProductionError(error) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Cargando trazabilidad completa...</p>
      </div>
    );
  }

  if (mappedError) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-lg flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-10 w-10 mb-4 opacity-80" />
        <h3 className="text-lg font-semibold mb-2">{mappedError.userMessage}</h3>
        {mappedError.requestId && (
          <p className="text-sm font-mono opacity-80 mb-6">Req: {mappedError.requestId}</p>
        )}
        <Button variant="outline" onClick={() => refetch()} className="bg-background text-foreground border-destructive/20 hover:bg-destructive/10">
          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
        </Button>
      </div>
    );
  }

  if (!trace) return null;

  return (
    <BatchTraceContent
      trace={trace}
      articulosMap={articulosMap}
      ordersMap={ordersMap}
      tfOrdersMap={tfOrdersMap}
      participantsMap={participantsMap}
      producersMap={producersMap}
      varietiesMap={varietiesMap}
      measurementTypesMap={measurementTypesMap}
      isFetching={isFetching}
    />
  );
}

export function BatchTraceContent({
  trace,
  articulosMap = new Map(),
  ordersMap = new Map(),
  tfOrdersMap = new Map(),
  participantsMap = new Map(),
  producersMap = new Map(),
  varietiesMap = new Map(),
  measurementTypesMap = new Map(),
  isFetching = false
}: {
  trace: ProductionBatchTraceDto,
  articulosMap?: Map<string, string>,
  ordersMap?: Map<string, string>,
  tfOrdersMap?: Map<string, string>,
  participantsMap?: Map<string, string>,
  producersMap?: Map<string, string>,
  varietiesMap?: Map<string, string>,
  measurementTypesMap?: Map<string, string>,
  isFetching?: boolean
}) {
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif text-foreground/90 flex items-center gap-2">
          <GitCommit className="text-primary h-6 w-6" />
          Trazabilidad
        </h2>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {trace.warnings.length > 0 && <TraceWarnings warnings={trace.warnings} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <TraceHeader trace={trace} ordersMap={ordersMap} />
          <TraceLineage trace={trace} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Accordion type="multiple" defaultValue={['receptions', 'transformations', 'works', 'measurements', 'releases', 'containers', 'inventory', 'losses']} className="w-full space-y-4">
            <TraceReceptions trace={trace} articulosMap={articulosMap} producersMap={producersMap} varietiesMap={varietiesMap} />
            <TraceTransformations trace={trace} articulosMap={articulosMap} ordersMap={ordersMap} tfOrdersMap={tfOrdersMap} />
            <TraceWorks trace={trace} articulosMap={articulosMap} participantsMap={participantsMap} />
            <TraceMeasurements trace={trace} measurementTypesMap={measurementTypesMap} participantsMap={participantsMap} />
            <TraceReleases trace={trace} articulosMap={articulosMap} />
        <TraceContainers trace={trace} />
            <TraceInventory trace={trace} articulosMap={articulosMap} />
            <TraceLosses trace={trace} />
          </Accordion>

          {(trace.receptions.length + trace.transformations.length + trace.works.length + trace.measurements.length + trace.containers.length + trace.inventory.lots.length + trace.inventory.movements.length + trace.inventory.stocks.length + trace.losses.length + trace.releases.length) === 0 && (
            <div className="bg-card rounded-xl border border-dashed shadow-sm p-12 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[300px]" data-testid="trace-empty-history">
              <History className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground mb-1">Sin historial operativo</h3>
              <p className="max-w-sm text-sm">Este lote no tiene movimientos, recepciones, transformaciones o mediciones registradas todavía.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceWarnings({ warnings }: { warnings: string[] }) {
  return (
    <Accordion type="single" collapsible className="w-full" data-testid="trace-warnings">
      <AccordionItem value="warnings" className="bg-warning/10 border-l-4 border-warning text-warning-foreground rounded-r-md shadow-sm border-y border-r">
        <AccordionTrigger className="px-4 py-3 hover:no-underline text-warning hover:bg-warning/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <h4 className="font-semibold text-sm">
              Trazabilidad parcial ({warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'})
            </h4>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-12 pb-4">
          <ul className="space-y-1 text-sm list-disc list-outside text-warning/90">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function TraceHeader({ trace, ordersMap }: { trace: ProductionBatchTraceDto, ordersMap: Map<string, string> }) {
  const rootBatch = trace.batches.find(b => b.id === trace.rootBatchId);
  if (!rootBatch) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden" data-testid="trace-header">
      <div className="bg-primary/5 p-4 border-b border-primary/10 flex justify-between items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary/70 mb-1 block">Lote Analizado</span>
          <div className="text-xl font-bold text-foreground font-mono">{rootBatch.code}</div>
        </div>
        <Badge variant="outline" className="bg-background text-primary border-primary/20">Raíz</Badge>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs text-muted-foreground uppercase mb-1">Artículo</div>
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {rootBatch.article ? `${rootBatch.article.codigo} · ${rootBatch.article.nombre}` : rootBatch.articuloId}
            </span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Orden</div>
            <div className="font-medium text-sm flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              {rootBatch.order ? rootBatch.order.code : (ordersMap.get(rootBatch.productionOrderId) || rootBatch.productionOrderId)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-1">Fecha Creación</div>
            <div className="font-medium text-sm">{formatDate(rootBatch.createdAt)}</div>
          </div>
        </div>

        {rootBatch.balance && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase">Balance Actual</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between bg-muted/30 p-1.5 rounded">
                  <span className="text-muted-foreground">Disponible:</span>
                  <span className="font-medium text-primary tabular-nums">{formatDecimal(rootBatch.balance.available)} {rootBatch.unit}</span>
                </div>
                <div className="flex justify-between bg-muted/30 p-1.5 rounded">
                  <span className="text-muted-foreground">Generado:</span>
                  <span className="font-medium tabular-nums">{formatDecimal(rootBatch.balance.generated)} {rootBatch.unit}</span>
                </div>
                <div className="flex justify-between bg-muted/30 p-1.5 rounded">
                  <span className="text-muted-foreground">Consumido:</span>
                  <span className="font-medium tabular-nums">{formatDecimal(rootBatch.balance.consumed)} {rootBatch.unit}</span>
                </div>
                <div className="flex justify-between bg-muted/30 p-1.5 rounded">
                  <span className="text-muted-foreground">Pérdidas:</span>
                  <span className="font-medium tabular-nums text-destructive">{formatDecimal(rootBatch.balance.lost)} {rootBatch.unit}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TraceLineage({ trace }: { trace: ProductionBatchTraceDto }) {
  // We want to list Parents (lineage where this batch is child) and Children (lineage where this batch is parent)
  const parents = trace.lineage.filter(l => l.childBatchId === trace.rootBatchId);
  const children = trace.lineage.filter(l => l.parentBatchId === trace.rootBatchId);

  const getBatchCode = (id: string) => trace.batches.find(b => b.id === id)?.code || id;

  // Infer relation label
  const getRelationLabel = (edge: typeof trace.lineage[0]) => {
    // Is it from a transfer? (Check containers movements where source is parent, dest is child)
    const isTransfer = trace.containers.some(c =>
      c.movements.some(m => m.sourceBatchId === edge.parentBatchId && m.destinationBatchId === edge.childBatchId)
    );
    if (isTransfer) return 'Transferencia';

    // Is it from transformation? (Check transformations inputs & outputs)
    const isTransformation = trace.transformations.some(t =>
      t.inputs.some(i => i.productionBatchId === edge.parentBatchId) &&
      t.outputs.some(o => o.productionBatchId === edge.childBatchId)
    );
    if (isTransformation) return 'Transformación';

    return 'Relación de Producción';
  };

  if (parents.length === 0 && children.length === 0) {
    return (
      <div className="bg-card rounded-xl border shadow-sm p-6 text-center text-muted-foreground" data-testid="trace-lineage-empty">
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Sin relaciones de linaje</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden" data-testid="trace-lineage">
      <div className="bg-muted/40 p-4 border-b flex items-center gap-2">
        <GitMerge className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Árbol de Linaje</h3>
      </div>

      <div className="p-0">
        {parents.length > 0 && (
          <div className="p-4 border-b">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5" /> Lotes Origen (Padres)
            </h4>
            <div className="space-y-3">
              {parents.map(p => (
                <div key={p.id} className="flex flex-col gap-1 p-2.5 rounded-lg border bg-background hover:border-primary/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <Link href={`/produccion/batches/${p.parentBatchId}/trace`} className="font-mono text-sm text-primary hover:underline font-medium">
                      {getBatchCode(p.parentBatchId)}
                    </Link>
                    {p.quantity && (
                      <span className="text-xs font-medium tabular-nums bg-muted px-1.5 py-0.5 rounded">{p.quantity} {p.unit}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="h-3 w-3" /> {getRelationLabel(p)}
                    </span>
                    <span>{formatDate(p.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {children.length > 0 && (
          <div className="p-4 bg-muted/10">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> Lotes Destino (Hijos)
            </h4>
            <div className="space-y-3">
              {children.map(c => (
                <div key={c.id} className="flex flex-col gap-1 p-2.5 rounded-lg border bg-background hover:border-primary/30 transition-colors">
                   <div className="flex justify-between items-start">
                    <Link href={`/produccion/batches/${c.childBatchId}/trace`} className="font-mono text-sm text-primary hover:underline font-medium">
                      {getBatchCode(c.childBatchId)}
                    </Link>
                    {c.quantity && (
                      <span className="text-xs font-medium tabular-nums bg-muted px-1.5 py-0.5 rounded">{c.quantity} {c.unit}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="h-3 w-3" /> {getRelationLabel(c)}
                    </span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom Accordion Item wrapper for uniform styling
function TraceSection({ value, title, icon: Icon, count, children }: { value: string, title: string, icon: any, count: number, children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <AccordionItem value={value} className="bg-card border rounded-xl shadow-sm overflow-hidden" data-testid={`trace-section-${value}`}>
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors data-[state=open]:border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className="font-semibold text-base">{title}</span>
          <Badge variant="secondary" className="ml-2 font-mono">{count}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-0">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function TraceReceptions({ trace, articulosMap, producersMap, varietiesMap }: { trace: ProductionBatchTraceDto, articulosMap: Map<string, string>, producersMap: Map<string, string>, varietiesMap: Map<string, string> }) {
  if (trace.receptions.length === 0) return null;

  return (
    <TraceSection value="receptions" title="Recepciones de Uva" icon={Truck} count={trace.receptions.length}>
      <div className="divide-y">
        {trace.receptions.map(rec => (
          <div key={rec.id} className="p-5 flex flex-col gap-4" data-testid={`trace-reception-${rec.id}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Recepción</div>
                <div className="font-medium flex items-center gap-2">
                  <span className="font-mono text-sm">{rec.id}</span>
                  <Badge variant="outline" className={rec.status === 'ACCEPTED' ? 'text-success border-success/30' : ''}>{rec.status}</Badge>
                </div>
                {rec.producerId && <div className="text-sm mt-1 text-muted-foreground">Productor: {producersMap.get(rec.producerId) || rec.producerId}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Fecha de Recepción</div>
                <div className="text-sm">{formatDate(rec.receivedAt)}</div>
              </div>
            </div>

            {rec.observations && (
              <div className="bg-muted/30 p-3 rounded-md text-sm border text-muted-foreground">
                {rec.observations}
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b">
                Ítems Recibidos ({rec.items.length})
              </div>
              <div className="divide-y bg-background">
                {rec.items.map(item => (
                  <div key={item.id} className="p-3 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Lote: <span className="font-mono">{trace.batches.find(b=>b.id === item.productionBatchId)?.code || item.productionBatchId}</span></span>
                      <span className="text-xs text-muted-foreground">Var: {varietiesMap.get(item.grapeVarietyId) || item.grapeVarietyId} | Art: {articulosMap.get(item.articuloId) || item.articuloId}</span>
                    </div>
                    <div className="font-medium tabular-nums text-primary">
                      {formatDecimal(item.quantity)} {item.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <CorrectionHistory corrections={rec.corrections} />
          </div>
        ))}
      </div>
    </TraceSection>
  );
}

function TraceTransformations({ trace, articulosMap, ordersMap, tfOrdersMap }: { trace: ProductionBatchTraceDto, articulosMap: Map<string, string>, ordersMap: Map<string, string>, tfOrdersMap: Map<string, string> }) {
  if (trace.transformations.length === 0) return null;

  const getBatchCode = (id: string) => trace.batches.find(b => b.id === id)?.code || id;

  return (
    <TraceSection value="transformations" title="Transformaciones" icon={RefreshCw} count={trace.transformations.length}>
      <div className="divide-y">
        {trace.transformations.map(tf => (
          <div key={tf.id} className="p-5 flex flex-col gap-4" data-testid={`trace-transformation-${tf.id}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Transformación</div>
                <div className="font-medium text-sm flex items-center gap-2">
                  <span className="font-mono">{tf.operationKey}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                  {tf.productionOrderId && <span>Orden Prod: <code className="bg-muted px-1 rounded">{ordersMap.get(tf.productionOrderId) || tf.productionOrderId}</code></span>}
                  {tf.transformationOrderId && <span>Orden Transf: <code className="bg-muted px-1 rounded">{tfOrdersMap.get(tf.transformationOrderId) || tf.transformationOrderId}</code></span>}
                  {tf.productionWorkId && <span>Trabajo Prod: <code className="bg-muted px-1 rounded">{trace.works.find(w=>w.id===tf.productionWorkId)?.workType.name || tf.productionWorkId}</code></span>}
                  {tf.actorUserId && <span>Registrado por: <code className="bg-muted px-1 rounded">{tf.actorUserId}</code></span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Fecha</div>
                <div className="text-sm">{formatDate(tf.performedAt)}</div>
              </div>
            </div>

            {tf.observations && (
              <div className="bg-muted/30 p-3 rounded-md text-sm border text-muted-foreground">
                {tf.observations}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md overflow-hidden bg-background">
                <div className="bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex items-center gap-2">
                   <ArrowDownRight className="h-3.5 w-3.5" /> Entradas ({tf.inputs.length})
                </div>
                <div className="divide-y">
                  {tf.inputs.map((input, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-sm">
                       <span className="font-mono">{getBatchCode(input.productionBatchId)}</span>
                       <span className="tabular-nums font-medium">{formatDecimal(input.quantity)} {input.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border rounded-md overflow-hidden bg-background">
                <div className="bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex items-center gap-2">
                   <ArrowRight className="h-3.5 w-3.5" /> Salidas ({tf.outputs.length})
                </div>
                <div className="divide-y">
                  {tf.outputs.map((output, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-sm">
                       <span className="font-mono text-primary">{getBatchCode(output.productionBatchId)}</span>
                       <span className="tabular-nums font-medium text-primary">{formatDecimal(output.quantity)} {output.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {tf.losses.length > 0 && (
              <div className="border border-destructive/20 rounded-md overflow-hidden bg-destructive/5">
                <div className="bg-destructive/10 px-3 py-2 text-xs font-semibold uppercase text-destructive border-b border-destructive/10">
                   Pérdidas ({tf.losses.length})
                </div>
                <div className="divide-y divide-destructive/10">
                  {tf.losses.map((loss, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-sm text-destructive">
                       <span className="font-mono">{loss.productionBatchId ? getBatchCode(loss.productionBatchId) : 'Sin lote'}</span>
                       <span className="tabular-nums font-medium">{formatDecimal(loss.quantity)} {loss.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </TraceSection>
  );
}

function TraceWorks({ trace, articulosMap, participantsMap }: { trace: ProductionBatchTraceDto, articulosMap: Map<string, string>, participantsMap: Map<string, string> }) {
  if (trace.works.length === 0) return null;
  return (
    <TraceSection value="works" title="Trabajos de Producción" icon={Beaker} count={trace.works.length}>
      <div className="divide-y">
        {trace.works.map(work => (
          <div key={work.id} className="p-5 flex flex-col gap-4" data-testid={`trace-work-${work.id}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Tipo de Trabajo</div>
                <div className="font-medium text-sm text-primary flex items-center gap-2">
                  {work.workType.name} <span className="text-muted-foreground text-xs font-mono">({work.workType.code})</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Realizado</div>
                <div className="text-sm">{formatDate(work.performedAt)}</div>
              </div>
            </div>

            {work.observations && (
              <div className="bg-muted/30 p-3 rounded-md text-sm border text-muted-foreground">
                {work.observations}
              </div>
            )}

            {(work.participants.length > 0 || work.containers.length > 0) && (
              <div className="flex flex-col gap-2 text-sm mt-2">
                {work.participants.length > 0 && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">{work.participants.length} Participantes:</span>
                      <ul className="list-disc list-inside mt-1">
                        {work.participants.map((p, i) => (
                          <li key={i}>{participantsMap.get(p.participantId) || p.participantId} {p.role ? <span className="italic">({p.role})</span> : ''}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {work.containers.length > 0 && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Box className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">{work.containers.length} Recipientes:</span>
                      <ul className="list-disc list-inside mt-1">
                        {work.containers.map((cid, i) => {
                          const container = trace.containers.find(c => c.id === cid);
                          return <li key={i}>{container ? `${container.code} ${container.name ? `(${container.name})` : ''}` : cid}</li>;
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {work.inputs.length > 0 && (
              <div className="border rounded-md overflow-hidden bg-background mt-2">
                <div className="bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex items-center justify-between">
                   <span>Consumos de Inventario ({work.inputs.length})</span>
                </div>
                <div className="divide-y">
                  {work.inputs.map((input) => (
                    <div key={input.id} className={`p-3 flex flex-col gap-2 ${input.status === 'REVERSED' ? 'opacity-60 bg-muted/20' : ''}`}>
                      <div className="flex justify-between items-start">
                         <div className="flex flex-col">
                           <span className="font-medium text-sm flex items-center gap-2">
                             Art: <span className="font-mono text-muted-foreground">{input.article?.nombre || articulosMap.get(input.articuloId) || input.articuloId}</span>
                             {input.status === 'REVERSED' && <Badge variant="destructive" className="text-[10px] h-4">Reversado</Badge>}
                           </span>
                           <span className="text-xs text-muted-foreground">Wh: {input.warehouseId ? (input.warehouse?.nombre || input.warehouseId) : '-'} | Lot: {input.inventoryLotId ? (trace.inventory.lots.find(l=>l.id===input.inventoryLotId)?.lotCode || input.inventoryLotId) : '-'}</span>
                         </div>
                         <div className={`tabular-nums font-medium ${input.status === 'REVERSED' ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                           {formatDecimal(input.quantity)} {input.unit}
                         </div>
                      </div>

                      {input.inventoryMovementId && (() => {
                        const mov = trace.inventory.movements.find(m => m.id === input.inventoryMovementId);
                        if (!mov) return <div className="text-[10px] text-muted-foreground">Movimiento: <code className="bg-muted px-1 rounded">{input.inventoryMovementId}</code></div>;
                        return (
                          <div className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded border border-muted flex flex-col mt-1">
                            <span className="font-semibold text-xs mb-1">Impacto en Inventario:</span>
                            <div className="flex justify-between items-center">
                              <Badge variant="outline" className="text-[9px] bg-background">{mov.type}</Badge>
                              <span className="font-mono">Stock: {formatDecimal(mov.stockBefore)} → {formatDecimal(mov.resultingStock)}</span>
                            </div>
                            <div className="mt-1 opacity-80">Origen: {mov.source} | ID: {mov.id}</div>
                          </div>
                        );
                      })()}

                      {input.operationKey && <div className="text-[10px] text-muted-foreground mt-1">Operación: <code className="bg-muted px-1 rounded">{input.operationKey}</code></div>}

                      {input.status === 'REVERSED' && (
                        <div className="text-xs text-destructive bg-destructive/5 p-2 rounded border border-destructive/10 mt-2 flex flex-col gap-1">
                          <span className="font-semibold flex items-center gap-1"><XCircle className="h-3 w-3"/> Reversado {input.reversedAt ? `el ${formatDate(input.reversedAt)}` : ''}</span>
                          <span>Motivo: {input.reversalReason || 'No especificado'}</span>

                          {input.reversalInventoryMovementId && (() => {
                            const mov = trace.inventory.movements.find(m => m.id === input.reversalInventoryMovementId);
                            if (!mov) return <div className="mt-1 opacity-80 text-[10px]">Movimiento compensatorio: <code className="bg-destructive/10 border border-destructive/20 px-1 rounded">{input.reversalInventoryMovementId}</code></div>;
                            return (
                              <div className="text-[10px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 flex flex-col mt-1">
                                <span className="font-semibold text-xs mb-1">Impacto Compensatorio:</span>
                                <div className="flex justify-between items-center">
                                  <Badge variant="outline" className="text-[9px] bg-destructive/5 text-destructive border-destructive/20">{mov.type}</Badge>
                                  <span className="font-mono">Stock: {formatDecimal(mov.stockBefore)} → {formatDecimal(mov.resultingStock)}</span>
                                </div>
                                <div className="mt-1 opacity-80">Origen: {mov.source} | ID: {mov.id}</div>
                              </div>
                            );
                          })()}

                          {input.reversalOperationKey && <div className="mt-1 opacity-80 text-[10px]">Op compensatoria: <code className="bg-destructive/10 border border-destructive/20 px-1 rounded">{input.reversalOperationKey}</code></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <CorrectionHistory corrections={work.corrections} />
          </div>
        ))}
      </div>
    </TraceSection>
  );
}

function TraceMeasurements({ trace, measurementTypesMap, participantsMap }: { trace: ProductionBatchTraceDto, measurementTypesMap: Map<string, string>, participantsMap: Map<string, string> }) {
  if (trace.measurements.length === 0) return null;
  return (
    <TraceSection value="measurements" title="Mediciones" icon={Scale} count={trace.measurements.length}>
      <div className="divide-y">
        {trace.measurements.map(m => (
          <div key={m.id} className="p-4 flex flex-col gap-3 hover:bg-muted/10 transition-colors" data-testid={`trace-measurement-${m.id}`}>
            <div className="flex justify-between items-center">
               <div className="flex flex-col gap-1">
                 <Badge variant="outline" className="w-fit">{measurementTypesMap.get(m.measurementTypeId) || m.measurementTypeId}</Badge>
                 <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                   {m.productionContainerId && <span title="Contenedor"><Box className="inline h-3 w-3 mr-1"/>{trace.containers.find(c=>c.id === m.productionContainerId)?.code || m.productionContainerId}</span>}
                   {m.productionBatchId && <span title="Lote"><Package2 className="inline h-3 w-3 mr-1"/>{trace.batches.find(b=>b.id === m.productionBatchId)?.code || m.productionBatchId}</span>}
                   {m.productionWorkId && <span title="Trabajo"><Beaker className="inline h-3 w-3 mr-1"/>{trace.works.find(w=>w.id === m.productionWorkId)?.workType.name || m.productionWorkId}</span>}
                 </div>
               </div>
               <div className="text-right">
                 <div className="font-bold text-lg tabular-nums text-foreground">{formatDecimal(m.value)} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span></div>
               </div>
            </div>

            <div className="flex justify-between items-end text-xs text-muted-foreground">
               <div>
                  {m.observations && <div className="mb-1 italic">"{m.observations}"</div>}
                  {m.participantId && <div>Por: {participantsMap.get(m.participantId) || m.participantId}</div>}
               </div>
               <div>{formatDate(m.measuredAt)}</div>
            </div>
            <CorrectionHistory corrections={m.corrections} compact />
          </div>
        ))}
      </div>
    </TraceSection>
  );
}

function TraceContainers({ trace }: { trace: ProductionBatchTraceDto }) {
  if (trace.containers.length === 0) return null;

  const relevantContainers = trace.containers;

  return (
    <TraceSection value="containers" title="Recipientes y Movimientos" icon={Droplets} count={relevantContainers.length}>
      <div className="divide-y">
        {relevantContainers.map(container => {
           // filter occupancies and movements related to THIS trace batch(es) ideally, but we show all returned for context.
           return (
             <div key={container.id} className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Recipiente</div>
                    <div className="font-bold text-base flex items-center gap-2">
                      {container.code}
                      {container.name && <span className="text-muted-foreground font-normal">({container.name})</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span>{container.type || 'Tipo N/A'}</span>
                      <span>Capacidad: <strong className="text-foreground">{formatDecimal(container.capacity)} {container.capacityUnit}</strong></span>
                    </div>
                  </div>
                  <Badge variant={container.status === 'OCUPADO' ? 'default' : 'secondary'}>{container.status}</Badge>
                </div>

                {container.occupancies.length > 0 && (
                  <div className="border rounded-md overflow-hidden bg-background">
                    <div className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex items-center gap-2">
                       <Clock className="h-3.5 w-3.5" /> Historial de Ocupación
                    </div>
                    <div className="divide-y">
                      {container.occupancies.map((occ, idx) => (
                        <div key={idx} className={`p-3 flex justify-between items-center text-sm ${!occ.closedAt ? 'bg-primary/5' : ''}`}>
                           <div className="flex flex-col">
                             <span className="font-mono font-medium flex items-center gap-2">
                               {trace.batches.find(b=>b.id===occ.batchId)?.code || occ.batchId}
                               {!occ.closedAt && <Badge variant="outline" className="text-[10px] h-4 bg-background text-primary border-primary/20">Actual</Badge>}
                             </span>
                             <span className="text-xs text-muted-foreground">{formatDate(occ.openedAt)} {occ.closedAt ? ` - ${formatDate(occ.closedAt)}` : ' - Presente'}</span>
                           </div>
                           <span className="tabular-nums font-medium">{formatDecimal(occ.quantity)} {occ.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {container.movements.length > 0 && (
                  <div className="border rounded-md overflow-hidden bg-background mt-3">
                    <div className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex items-center gap-2">
                       <ArrowRight className="h-3.5 w-3.5" /> Movimientos de Proceso
                    </div>
                    <div className="divide-y">
                      {container.movements.map((mov, idx) => (
                        <div key={idx} className="p-3 flex flex-col gap-2 text-sm" data-testid={`trace-process-movement-${mov.id}`}>
                           <div className="flex justify-between items-start">
                             <div className="flex items-center gap-2">
                               <Badge variant="outline" className="font-mono bg-background">
                                 {mov.movementType === 'ASSIGNED' ? 'Asignación' : mov.movementType === 'TRANSFERRED' ? 'Transferencia Total' : mov.movementType === 'PARTIAL_TRANSFERRED' ? 'Transferencia Parcial' : mov.movementType}
                               </Badge>
                               <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{mov.movementType}</span>
                             </div>
                             <span className="text-xs text-muted-foreground">{formatDate(mov.occurredAt)}</span>
                           </div>

                           {mov.observations && <div className="text-xs text-muted-foreground italic bg-muted/20 p-1.5 rounded">"{mov.observations}"</div>}

                           <div className="flex items-center gap-2 mt-1">
                             <div className="flex-1 border rounded p-2 bg-muted/10 text-center">
                               <div className="text-xs text-muted-foreground">Origen</div>
                               <div className="font-mono text-xs">{mov.sourceContainerId ? (trace.containers.find(c=>c.id===mov.sourceContainerId)?.code || mov.sourceContainerId) : '-'}</div>
                             </div>
                             <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                             <div className="flex-1 border rounded p-2 bg-muted/10 text-center">
                               <div className="text-xs text-muted-foreground">Destino</div>
                               <div className="font-mono text-xs">{mov.destinationContainerId ? (trace.containers.find(c=>c.id===mov.destinationContainerId)?.code || mov.destinationContainerId) : '-'}</div>
                             </div>
                           </div>

                           <div className="flex justify-between items-center mt-1">
                             <div className="text-[10px] text-muted-foreground flex flex-col">
                               {mov.productionWorkId && <span>Trabajo: <code className="bg-muted px-1 rounded">{trace.works.find(w=>w.id===mov.productionWorkId)?.workType.name || mov.productionWorkId}</code></span>}
                               {mov.actorUserId && <span>Registrado por: <code className="bg-muted px-1 rounded">{mov.actorUserId}</code></span>}
                             </div>
                             <div className="font-medium tabular-nums text-primary text-right">
                               {formatDecimal(mov.quantity)} {mov.unit}
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
           );
        })}
      </div>
    </TraceSection>
  );
}


function TraceReleases({ trace, articulosMap }: { trace: ProductionBatchTraceDto, articulosMap: Map<string, string> }) {
  const releases = trace.releases || [];
  if (releases.length === 0) return null;

  return (
    <TraceSection value="releases" title="Envíos a Inventario" icon={ArrowLeftRight} count={releases.length}>
      <div className="space-y-4 p-5">
        {releases.map(release => (
          <div key={release.releaseId} className={`border rounded-lg p-4 relative ${release.status === 'REVERSED' ? 'opacity-80 bg-muted/30' : 'bg-card'}`}>
            {release.status === 'REVERSED' && (
              <Badge variant="secondary" className="absolute top-4 right-4 bg-muted text-muted-foreground">
                <Ban className="w-3 h-3 mr-1" /> Revertido
              </Badge>
            )}

            <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-lg font-semibold ${release.status === 'REVERSED' ? 'line-through text-muted-foreground' : ''}`}>
                    {formatDecimal(release.quantity)} {release.unit}
                  </span>
                  <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Almacén: <span className="font-mono text-xs">{release.warehouseId}</span></span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Lote Inv: <span className="font-mono text-foreground">{release.inventoryLotId}</span></div>
                  <div className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Artículo: {articulosMap.get(trace.batches.find(b => b.id === trace.rootBatchId)?.articuloId || '') || trace.batches.find(b => b.id === trace.rootBatchId)?.articuloId || ''}</div>
                  <div className="flex items-center gap-1.5 opacity-80 mt-2">
                    <span className="text-xs">{formatDate(release.occurredAt)}</span>
                    <span className="mx-1">•</span>
                    <span className="text-xs">Por: <span className="font-mono">{release.actorUserId.split('-')[0]}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {release.status === 'REVERSED' && release.reversal && (
              <div className="mt-4 pt-3 border-t text-sm border-dashed">
                <div className="text-destructive font-medium mb-1 flex items-center gap-1"><Undo2 className="w-3.5 h-3.5"/> Reversión</div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">{release.reversal.reason}</span>
                  <div className="mt-1 flex items-center gap-3 text-xs opacity-80">
                    <span>{formatDate(release.reversal.occurredAt)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </TraceSection>
  );
}

function TraceInventory({ trace, articulosMap }: { trace: ProductionBatchTraceDto, articulosMap: Map<string, string> }) {
  const inv = trace.inventory;
  const count = inv.lots.length + inv.movements.length + inv.stocks.length;
  if (count === 0) return null;

  return (
    <TraceSection value="inventory" title="Relación de Inventario" icon={Package2} count={inv.lots.length}>
      <div className="p-5 space-y-6">
        {inv.lots.length > 0 && (
          <div className="space-y-3">
             <h4 className="text-xs font-semibold uppercase text-muted-foreground">Lotes de Inventario</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
               {inv.lots.map(lot => (
                 <div key={lot.id} className="border p-3 rounded-lg flex flex-col gap-2" data-testid={`trace-inv-lot-${lot.id}`}>
                   <div className="flex justify-between items-center">
                     <span className="font-mono font-bold">{lot.lotCode}</span>
                     <Badge variant="secondary">{lot.classification}</Badge>
                   </div>
                   <div className="text-xs text-muted-foreground flex justify-between">
                     <span>Art: {lot.article?.nombre || articulosMap.get(lot.articuloId) || lot.articuloId}</span>
                     <span>Ingreso: {formatDate(lot.fechaIngreso)}</span>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {inv.stocks.length > 0 && (
          <div className="space-y-3">
             <h4 className="text-xs font-semibold uppercase text-muted-foreground">Saldos de Stock</h4>
             <div className="border rounded-md divide-y">
               {inv.stocks.map(st => (
                 <div key={st.id} className="p-3 flex justify-between items-center text-sm" data-testid={`trace-inv-stock-${st.id}`}>
                   <div className="flex flex-col gap-1">
                     <span className="font-medium mr-2">Wh: <span className="font-mono text-muted-foreground">{st.warehouse?.nombre || st.warehouseId}</span></span>
                     <div className="flex gap-2 items-center">
                       <span className="text-[10px] text-muted-foreground">Art: {st.article?.nombre || articulosMap.get(st.articuloId) || st.articuloId}</span>
                       {st.inventoryLotId && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Lote: {inv.lots.find(l=>l.id===st.inventoryLotId)?.lotCode || st.inventoryLotId}</span>}
                     </div>
                   </div>
                   <span className="font-medium tabular-nums">{formatDecimal(st.quantity)} {st.unit}</span>
                 </div>
               ))}
             </div>
          </div>
        )}

        {inv.movements.length > 0 && (
          <div className="space-y-3">
             <h4 className="text-xs font-semibold uppercase text-muted-foreground">Movimientos Relacionados</h4>
             <div className="border rounded-md divide-y overflow-hidden">
               {inv.movements.map(mov => (
                 <div key={mov.id} className="p-3 flex flex-col gap-1 text-sm bg-background hover:bg-muted/20 transition-colors" data-testid={`trace-inv-mov-${mov.id}`}>
                   <div className="flex justify-between items-center">
                     <Badge variant="outline" className="bg-muted/50">{mov.type}</Badge>
                     <span className="text-xs text-muted-foreground">{formatDate(mov.createdAt)}</span>
                   </div>

                   {mov.reason && (
                     <div className="text-xs text-muted-foreground italic bg-muted/20 p-1.5 rounded mt-1 border">
                       "{mov.reason}"
                     </div>
                   )}

                   <div className="flex justify-between items-center mt-2">
                     <div className="flex flex-col text-xs text-muted-foreground">
                        <span>Origen: {mov.source}</span>
                        <span>Wh: {mov.warehouse?.nombre || mov.warehouseId}</span>
                        {mov.destinationWarehouseId && <span>Destino: {mov.destinationWarehouse?.nombre || mov.destinationWarehouseId}</span>}
                        <span>Art: {mov.article?.nombre || articulosMap.get(mov.articuloId) || mov.articuloId}</span>
                        {mov.inventoryLotId && <span>Lote: {inv.lots.find(l=>l.id===mov.inventoryLotId)?.lotCode || mov.inventoryLotId}</span>}
                     </div>
                     <div className="text-right">
                        <div className="font-medium tabular-nums text-foreground mb-0.5">{formatDecimal(mov.quantity)} {mov.unit}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">Stock: {formatDecimal(mov.stockBefore)} → {formatDecimal(mov.resultingStock)}</div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </TraceSection>
  );
}

function TraceLosses({ trace }: { trace: ProductionBatchTraceDto }) {
  if (trace.losses.length === 0) return null;
  return (
    <TraceSection value="losses" title="Pérdidas Registradas" icon={AlertTriangle} count={trace.losses.length}>
      <div className="divide-y">
        {trace.losses.map(loss => (
          <div key={loss.id} className="p-4 flex flex-col gap-2" data-testid={`trace-loss-${loss.id}`}>
            <div className="flex justify-between items-start">
               <div>
                  <div className="font-medium text-sm flex items-center gap-2 text-destructive">
                    Lote afectado: <span className="font-mono">{loss.productionBatchId ? (trace.batches.find(b=>b.id === loss.productionBatchId)?.code || loss.productionBatchId) : 'No especificado'}</span>
                  </div>
                  {loss.observations && <div className="text-sm text-muted-foreground mt-1 italic">"{loss.observations}"</div>}
               </div>
               <div className="text-right">
                 <div className="font-bold tabular-nums text-destructive">{formatDecimal(loss.quantity)} {loss.unit}</div>
                 <div className="text-xs text-muted-foreground mt-1">{formatDate(loss.occurredAt)}</div>
               </div>
            </div>
          </div>
        ))}
      </div>
    </TraceSection>
  );
}

function CorrectionHistory({ corrections, compact = false }: { corrections: CorrectionDto[], compact?: boolean }) {
  if (!corrections || corrections.length === 0) return null;

  return (
    <div className={`mt-3 ${compact ? 'border-t pt-3' : 'border rounded-md overflow-hidden bg-muted/10'}`}>
      {!compact && (
        <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground border-b flex items-center gap-2">
          <History className="h-3.5 w-3.5" /> Historial de Correcciones ({corrections.length})
        </div>
      )}
      <div className={compact ? 'space-y-2' : 'divide-y divide-border/50'}>
        {corrections.map((corr) => (
          <div key={corr.id} className={compact ? 'text-xs border-l-2 border-primary/20 pl-2' : 'p-3 text-sm'}>
            <div className="flex justify-between items-start mb-1">
              <span className="font-medium">
                {compact && <History className="h-3 w-3 inline mr-1 opacity-50" />}
                Campo: <code className="bg-muted px-1 rounded text-primary">{corr.field}</code>
              </span>
              <span className="text-[10px] text-muted-foreground">{formatDate(corr.correctedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-background border p-1.5 rounded mb-1.5">
               <span className="line-through opacity-70 truncate max-w-[120px]">{JSON.stringify(corr.previousValue)}</span>
               <ArrowRight className="h-3 w-3 shrink-0" />
               <span className="text-foreground font-medium truncate max-w-[120px]">{JSON.stringify(corr.newValue)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex justify-between items-center">
              <span className="italic">M: {corr.reason}</span>
              <span className="opacity-70 text-[10px]">v{corr.fromVersion}→v{corr.toVersion}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
