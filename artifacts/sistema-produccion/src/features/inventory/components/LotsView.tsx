import { useState, useEffect } from 'react';
import { useInventoryLot, useClassifyLot } from '../api/inventory.hooks';
import { useArticulo } from '../../articulos/api/articulos.hooks';
import { LOT_CLASSIFICATIONS, type LotClassification } from '../types/inventory.types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, AlertCircle, Tag, Calendar, FileText, BarChart3, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mapInventoryError } from '../api/inventory.error';
import { useToast } from '@/hooks/use-toast';

const SPANISH_CLASSIFICATIONS: Record<LotClassification, string> = {
  PRODUCTO_ENVASADO: 'Producto Envasado',
  PRODUCTO_TERMINADO: 'Producto Terminado',
  PRODUCTO_TERMINADO_EXPORTACION: 'Producto Terminado (Exportación)'
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function LotDetails({ lot }: { lot: NonNullable<ReturnType<typeof useInventoryLot>['data']> }) {
  const { data: articulo, isLoading } = useArticulo(lot.articuloId);
  const { can } = useAuth();
  const { toast } = useToast();
  
  const [classification, setClassification] = useState<LotClassification>(lot.classification);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);
  
  const [reqId, setReqId] = useState<string | null>(null);
  
  const [idempotencyState, setIdempotencyState] = useState({
    key: crypto.randomUUID(),
    payload: '',
    isRetry: false
  });

  // Reset local state when lot ID changes
  useEffect(() => {
    setClassification(lot.classification);
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);
    setIdempotencyState({ key: crypto.randomUUID(), payload: '', isRetry: false });
  }, [lot.id, lot.classification]);

  const getAvailableTransitions = (current: LotClassification) => {
    const idx = LOT_CLASSIFICATIONS.indexOf(current);
    if (idx === -1 || idx === LOT_CLASSIFICATIONS.length - 1) return [];
    return [LOT_CLASSIFICATIONS[idx + 1]];
  };

  const availableTransitions = getAvailableTransitions(lot.classification);
  const canClassify = can('inventory:lot_classify') && availableTransitions.length > 0;

  const classifyMutation = useClassifyLot({
    onSuccess: (res) => {
      toast({ title: 'Lote reclasificado exitosamente' });
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);
      setIdempotencyState({ key: crypto.randomUUID(), payload: '', isRetry: false });
    },
    onError: (err, variables) => {
      const mapped = mapInventoryError(err);
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
      setValidationDetails(mapped.details ?? null);
      if (mapped.status === 0) {
        setIdempotencyState(prev => ({
          ...prev,
          payload: JSON.stringify({
            inventoryLotId: variables.inventoryLotId,
            classification: variables.command.input.classification,
          }),
          isRetry: true,
        }));
      } else {
        setIdempotencyState({ key: crypto.randomUUID(), payload: '', isRetry: false });
      }
    }
  });

  const handleClassify = () => {
    if (classification !== lot.classification) {
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);
      
      const payloadString = JSON.stringify({ inventoryLotId: lot.id, classification });
      let key = idempotencyState.key;
      if (idempotencyState.isRetry && idempotencyState.payload === payloadString) {
        // retain key
      } else {
        key = crypto.randomUUID();
        setIdempotencyState({ key, payload: payloadString, isRetry: false });
      }

      classifyMutation.mutate({
        inventoryLotId: lot.id,
        command: {
          idempotencyKey: key,
          input: { classification }
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Tag className="mr-2 h-4 w-4" /> Código de Lote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono font-medium">{lot.lotCode}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{lot.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <BarChart3 className="mr-2 h-4 w-4" /> Artículo Asociado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : articulo ? (
              <div>
                <p className="font-medium">{articulo.codigo} - {articulo.nombre}</p>
                <Badge variant="outline" className="mt-1">{articulo.clasificacion}</Badge>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm font-mono">{lot.articuloId}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Calendar className="mr-2 h-4 w-4" /> Ingreso y Trazabilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Fecha de Ingreso</span>
              <p className="font-medium text-sm">{formatDate(lot.fechaIngreso)}</p>
            </div>
            {lot.originProductionBatchId && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Lote Producción Origen</span>
                <p className="font-mono text-xs break-all">{lot.originProductionBatchId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <FileText className="mr-2 h-4 w-4" /> Estado y Observaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Clasificación Actual</span>
              <Badge variant="secondary">{SPANISH_CLASSIFICATIONS[lot.classification]}</Badge>
            </div>
            {lot.observations && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Observaciones</span>
                <p className="text-sm">{lot.observations}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Fechas</span>
              <p className="text-xs text-muted-foreground">Creado: {formatDate(lot.createdAt)}</p>
              <p className="text-xs text-muted-foreground">Actualizado: {formatDate(lot.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {canClassify && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              Reclasificar Lote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2 flex-1 w-full max-w-sm">
                <Select value={classification} onValueChange={(v) => setClassification(v as LotClassification)}>
                  <SelectTrigger disabled={classifyMutation.isPending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={lot.classification}>{SPANISH_CLASSIFICATIONS[lot.classification]} (Actual)</SelectItem>
                    {availableTransitions.map(c => (
                      <SelectItem key={c} value={c}>{SPANISH_CLASSIFICATIONS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleClassify} 
                disabled={classification === lot.classification || classifyMutation.isPending}
              >
                {classifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Actualizar Clasificación
              </Button>
            </div>
            {errorMsg && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20 flex flex-col items-start gap-1">
                <div className="flex items-center font-medium"><AlertCircle className="h-4 w-4 mr-2" /> {errorMsg}</div>
                {idempotencyState.isRetry && (
                  <p className="text-xs font-semibold mt-1">Reintente haciendo clic en actualizar nuevamente.</p>
                )}
                {reqId && <span className="text-xs font-mono opacity-80 mt-1">Req ID: {reqId}</span>}
                {Boolean(validationDetails) && (
                  <div className="mt-2 text-xs bg-destructive/20 p-2 rounded max-h-32 overflow-y-auto font-mono w-full">
                    {Array.isArray(validationDetails)
                      ? validationDetails.map((d, i) => <div key={i}>• {typeof d === 'string' ? d : JSON.stringify(d)}</div>)
                      : typeof validationDetails === 'object'
                      ? <pre className="whitespace-pre-wrap">{JSON.stringify(validationDetails, null, 2)}</pre>
                      : String(validationDetails)
                    }
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function LotsView() {
  const [searchId, setSearchId] = useState('');
  const [activeId, setActiveId] = useState('');

  const { data: lot, isLoading, error, isFetching, refetch } = useInventoryLot(activeId, {
    enabled: Boolean(activeId),
    retry: false
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim() && searchId.length > 30) {
      setActiveId(searchId.trim());
    }
  };

  const mappedError = error ? mapInventoryError(error) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consultar Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4 items-end max-w-xl">
            <div className="space-y-2 flex-1">
              <Input
                placeholder="Ingrese el UUID del Lote"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-lot-search"
              />
            </div>
            <Button type="submit" disabled={!searchId.trim() || isLoading || isFetching} data-testid="button-lot-search">
              <Search className="mr-2 h-4 w-4" /> Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      {(isLoading || isFetching) && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Buscando información del lote...</p>
        </div>
      )}

      {!isLoading && !isFetching && mappedError && !lot && (
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex flex-col items-center text-center">
          <AlertCircle className="h-10 w-10 mb-2 opacity-80" />
          <p className="font-medium text-lg">{mappedError.userMessage}</p>
          <p className="text-sm mt-1 opacity-80 mb-2">Verifique que el identificador ingresado sea correcto.</p>
          {mappedError.requestId && <p className="text-xs font-mono opacity-80 mb-4">Req ID: {mappedError.requestId}</p>}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-destructive/30 text-destructive hover:bg-destructive/20">Reintentar Búsqueda</Button>
        </div>
      )}

      {lot && (
        <div className="space-y-4">
          {mappedError && (
             <div className="p-3 bg-warning/10 border border-warning/20 rounded-md text-warning flex items-center justify-between">
               <div className="flex flex-col">
                 <span className="flex items-center text-sm font-medium"><AlertCircle className="h-4 w-4 mr-2" /> No se pudo actualizar la información del lote.</span>
                 {mappedError.requestId && <span className="text-[10px] font-mono mt-0.5">Req ID: {mappedError.requestId}</span>}
               </div>
               <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-warning"><RefreshCw className="h-4 w-4 mr-2" /> Reintentar</Button>
             </div>
          )}
          <LotDetails key={lot.id} lot={lot} />
        </div>
      )}
      
      {!isLoading && !isFetching && !activeId && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          <Tag className="h-8 w-8 mb-2 opacity-50" />
          <p>Ingrese un UUID de lote para ver su trazabilidad y detalles.</p>
        </div>
      )}
    </div>
  );
}
