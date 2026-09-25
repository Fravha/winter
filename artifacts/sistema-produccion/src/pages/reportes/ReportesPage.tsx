import { useState } from 'react';
import { ArrowDownToLine, Check, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { ApiError } from '@/lib/api/api-error';
import { exportReport } from '@/features/reports/api/export-report';
import { ReportField, type FieldName } from '@/features/reports/components/ReportFields';
import { validateReport, type ReportFilters, type ReportKind } from '@/features/reports/schemas/report.schema';

type ReportDefinition = { kind: ReportKind; title: string; description: string; fields: FieldName[]; note?: string };
const definitions: ReportDefinition[] = [
  { kind: 'stock', title: 'Stock actual', description: 'Existencias disponibles por almacén, artículo y lote de inventario.', fields: ['warehouseId', 'articuloId', 'classification'] },
  { kind: 'movements', title: 'Movimientos de inventario', description: 'Entradas, salidas, transferencias y ajustes en un período.', fields: ['from', 'to', 'warehouseId', 'articuloId', 'movementType'] },
  { kind: 'purchases', title: 'Compras', description: 'Compras y artículos solicitados, con sus precios referenciales.', fields: ['from', 'to', 'status', 'supplier', 'articuloId'] },
  { kind: 'works', title: 'Trabajos de producción', description: 'Actividad registrada en las órdenes, con sus relaciones operativas.', fields: ['productionOrderId', 'transformationOrderId', 'from', 'to', 'workTypeId', 'productionBatchId', 'containerId'], note: 'Filtra por orden o período para encontrar los trabajos que necesitas.' },
  { kind: 'transformations', title: 'Transformaciones', description: 'Entradas, salidas y pérdidas de las transformaciones registradas.', fields: ['productionOrderId', 'transformationOrderId', 'from', 'to', 'productionBatchId'] },
  { kind: 'traceability', title: 'Trazabilidad', description: 'Recorrido documentado de un batch de producción y sus relaciones.', fields: ['productionBatchId'], note: 'Selecciona un batch para generar su trazabilidad.' },
];

function ReportCard({ definition, index }: { definition: ReportDefinition; index: number }) {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [filename, setFilename] = useState('');
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const update = (name: FieldName, value: string) => {
    setFilters(current => {
      const next = { ...current, [name]: value };
      if (name === 'productionOrderId' && current.productionOrderId !== value) {
        next.transformationOrderId = '';
        next.productionBatchId = '';
      }
      return next;
    });
    setErrors(current => ({ ...current, [name]: '' }));
    if (status !== 'downloading') setStatus('idle');
  };
  const download = async () => {
    const parsed = validateReport(definition.kind, filters);
    setErrors(parsed.errors);
    if (!parsed.values) { setStatus('idle'); setFilename(''); return; }
    setStatus('downloading'); setApiError(null); setFilename('');
    try {
      const name = await exportReport(definition.kind, parsed.values);
      setFilename(name); setStatus('success');
    } catch (error) {
      const compatible = error && typeof error === 'object' ? error as Partial<ApiError> : null;
      setApiError(error instanceof ApiError ? error : new ApiError({
        status: compatible?.status ?? 0, code: compatible?.code ?? 'DOWNLOAD_FAILED', message: error instanceof Error ? error.message : 'No se pudo descargar el reporte.',
        requestId: compatible?.requestId, details: compatible?.details,
      }));
      setStatus('error');
    }
  };
  return (
    <article className={`report-card ${index === 3 ? 'report-card-featured' : ''}`} data-testid={`card-report-${definition.kind}`}>
      <div className="report-card-heading">
        <span className="report-card-index">{String(index + 1).padStart(2, '0')} / 06</span>
        <FileSpreadsheet className="size-5 text-primary/65" aria-hidden="true" />
      </div>
      <h2 className="font-serif text-xl font-semibold tracking-tight">{definition.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{definition.description}</p>
      {definition.note && <p className="report-card-note">{definition.note}</p>}
      <div className="report-card-fields">
        {definition.fields.map(name => <ReportField key={name} name={name} value={filters[name] ?? ''} onChange={value => update(name, value)} error={errors[name]} required={definition.kind === 'traceability' && name === 'productionBatchId'} productionOrderId={filters.productionOrderId} />)}
      </div>
      <div className="report-card-footer">
        <Button type="button" className="w-full sm:w-auto" disabled={status === 'downloading'} onClick={download} data-testid={`download-${definition.kind}`}>
          <ArrowDownToLine className="size-4" />
          {status === 'downloading' ? 'Generando reporte...' : 'Descargar Excel'}
        </Button>
        <div aria-live="polite" className="min-w-0">
          {status === 'success' && <p className="flex items-center gap-1.5 text-xs text-success" data-testid={`status-${definition.kind}`}><Check className="size-3.5 shrink-0" /> Archivo listo: {filename}</p>}
          {status === 'error' && apiError && <div className="text-xs text-destructive space-y-1" role="alert" data-testid={`status-${definition.kind}`}>
            <p>{apiError.message}</p>
            <p className="font-mono opacity-80">HTTP {apiError.status} · {apiError.code}{apiError.requestId ? ` · Ref. ${apiError.requestId}` : ''}</p>
            {apiError.details != null && <p className="break-words">Detalle: {typeof apiError.details === 'string' ? apiError.details : JSON.stringify(apiError.details)}</p>}
            <button type="button" className="inline-flex items-center gap-1 underline underline-offset-2" onClick={download} data-testid={`retry-${definition.kind}`}><RefreshCw className="size-3" /> Reintentar</button>
          </div>}
        </div>
      </div>
    </article>
  );
}

export default function ReportesPage() {
  return (
    <main className="reportes-page min-h-[100dvh]">
      <PageHeader eyebrow="OPERACIONES / EXPORTACIÓN" title="Reportes" description="Exporta información operativa de Winter en formato Excel." />
      <div className="reportes-intro"><div><span className="reportes-kicker">ARCHIVO OPERATIVO</span><h2>La información,<br /><em>lista para trabajar.</em></h2></div><p>Selecciona los filtros que necesitas. Cada archivo se genera al momento de la descarga, con los datos disponibles en Winter.</p></div>
      <div className="reportes-section-title"><span>EXPORTACIONES DISPONIBLES</span><span>06 FORMATOS XLSX</span></div>
      <div className="reportes-grid">{definitions.map((definition, index) => <ReportCard key={definition.kind} definition={definition} index={index} />)}</div>
      <p className="reportes-footnote">Los archivos se generan en el servidor. No se muestran resultados en esta página.</p>
    </main>
  );
}