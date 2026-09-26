import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCorrectGrapeReception, useProducers } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronRight, AlertCircle, Save, AlertTriangle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { createOperationKey } from '../../utils/production-payload';
import { toLocalDateTimeInput } from '../../utils/production-date';
import { GrapeReceptionDetail, ReceptionCorrectionInput } from '../../types/production.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: GrapeReceptionDetail;
  field: 'receivedAt' | 'producerId' | 'observations' | 'status';
  producersMap: Map<string, string>;
}

export function CorrectReceptionDialog({ open, onOpenChange, reception, field, producersMap }: Props) {
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [pendingPayload, setPendingPayload] = useState<ReceptionCorrectionInput | null>(null);
  const [definitiveError, setDefinitiveError] = useState(false);

  const { data: producers } = useProducers({ active: true, pageSize: 100 });

  const schema = z.object({
    newValue: field === 'receivedAt' ? z.string().min(1, 'Requerido') :
              field === 'producerId' ? z.string().uuid('Debe seleccionar un productor') :
              field === 'status' ? z.enum(['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS']) :
              z.string().max(2000),
    reason: z.string().trim().min(5, 'Especifique un motivo detallado (mínimo 5 caracteres)').max(2000)
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      newValue: field === 'receivedAt' ? toLocalDateTimeInput(reception.receivedAt) :
                field === 'producerId' ? (reception.producerId || '') :
                field === 'status' ? reception.status :
                (reception.observations || ''),
      reason: ''
    }
  });

  const handlePreview = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    
    const values = form.getValues();
    let finalNewValue: any = values.newValue;

    if (field === 'receivedAt') {
      try {
        finalNewValue = new Date(values.newValue).toISOString();
      } catch {
        form.setError('newValue', { message: 'Fecha inválida' });
        return;
      }
    }

    if (field === 'observations' && finalNewValue.trim() === '') {
      finalNewValue = null;
    }

    const payload: ReceptionCorrectionInput = {
      field: field as any,
      newValue: finalNewValue,
      reason: values.reason,
      operationKey: createOperationKey() // Correction only needs operationKey, NO requestHash
    };
    
    setPendingPayload(payload);
    setStep('summary');
    setDefinitiveError(false);
  };

  const correctMutation = useCorrectGrapeReception({
    onSuccess: () => {
      toast({
        title: "Corrección Guardada",
        description: "El cambio se registró en el historial de la recepción.",
      });
      onOpenChange(false);
      setTimeout(() => { setStep('form'); form.reset(); setPendingPayload(null); setDefinitiveError(false); }, 200);
    },
    onError: (err: any) => {
      const mapped = mapProductionError(err);
      if (mapped.status !== 0) {
        setDefinitiveError(true);
      }
    }
  });

  const handleSubmit = () => {
    if (!pendingPayload || definitiveError) return;
    correctMutation.mutate({ id: reception.id, input: pendingPayload });
  };

  const formatValue = (val: string | null) => {
    if (!val) return 'N/A';
    if (field === 'receivedAt') return new Date(val).toLocaleString('es-BO');
    if (field === 'status') return val === 'ACCEPTED' ? 'Aceptada' : 'Observada';
    if (field === 'producerId') return producersMap.get(val) || 'No disponible';
    return val;
  };

  const originalValue = field === 'receivedAt' ? reception.receivedAt :
                        field === 'producerId' ? reception.producerId :
                        field === 'status' ? reception.status :
                        reception.observations;

  const fieldLabel = field === 'receivedAt' ? 'Fecha Recepción' :
                     field === 'producerId' ? 'Productor' :
                     field === 'status' ? 'Estado' : 'Observaciones';

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (correctMutation.isPending) return;
      onOpenChange(val);
      if (!val) { setTimeout(() => { setStep('form'); form.reset(); setPendingPayload(null); setDefinitiveError(false); }, 200); }
    }}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Corregir {fieldLabel}</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Ingrese el nuevo valor y el motivo de la corrección.'
              : 'Revise el cambio. Esta acción quedará registrada en el historial.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'form' ? (
            <Form {...form}>
              <form className="p-6 space-y-6">
                <div className="bg-muted p-4 rounded-md space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Valor Actual</span>
                  <p className="text-sm line-through opacity-80">{formatValue(originalValue)}</p>
                </div>

                <FormField control={form.control} name="newValue" render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Nuevo Valor *</FormLabel>
                    <FormControl>
                      {field === 'receivedAt' ? (
                        <Input type="datetime-local" {...formField} disabled={correctMutation.isPending} />
                      ) : field === 'producerId' ? (
                        <Select value={formField.value} onValueChange={formField.onChange} disabled={correctMutation.isPending}>
                          <SelectTrigger><SelectValue placeholder="Seleccione Productor" /></SelectTrigger>
                          <SelectContent>
                            {producers?.data.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : field === 'status' ? (
                        <Select value={formField.value} onValueChange={formField.onChange} disabled={correctMutation.isPending}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACCEPTED">Aceptada</SelectItem>
                            <SelectItem value="ACCEPTED_WITH_OBSERVATIONS">Aceptada con Observaciones</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Textarea {...formField} rows={3} disabled={correctMutation.isPending} />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reason" render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Motivo de la Corrección *</FormLabel>
                    <FormControl>
                      <Textarea {...formField} placeholder="Explique por qué se realiza este cambio..." rows={2} disabled={correctMutation.isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </form>
            </Form>
          ) : pendingPayload && (
            <ScrollArea className="h-full p-6 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-3 rounded-md border border-destructive/20">
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">Valor Anterior</span>
                    <p className="text-sm line-through text-destructive">{formatValue(originalValue)}</p>
                  </div>
                  <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                    <span className="text-xs font-medium text-primary mb-1 block">Nuevo Valor</span>
                    <p className="text-sm font-medium text-primary">{formatValue(pendingPayload.newValue)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground block">Motivo</span>
                  <p className="text-sm bg-muted p-3 rounded-md italic">"{pendingPayload.reason}"</p>
                </div>

                {correctMutation.error && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 border ${definitiveError ? 'bg-warning/10 text-warning-foreground border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                    {definitiveError ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                    <div>
                      <p className="font-semibold text-sm">{definitiveError ? 'Error de Validación / Negocio' : 'Error de Conexión'}</p>
                      <p className="text-sm mt-1">{mapProductionError(correctMutation.error).userMessage}</p>
                      <p className="text-xs font-mono mt-1 opacity-70">Req: {mapProductionError(correctMutation.error).requestId}</p>
                      {definitiveError && (
                        <p className="text-sm mt-3 font-medium">Debe modificar los datos para reintentar la operación.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-card">
          {step === 'form' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" onClick={handlePreview}>Siguiente <ChevronRight className="h-4 w-4 ml-2" /></Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => { setStep('form'); setPendingPayload(null); setDefinitiveError(false); }} disabled={correctMutation.isPending}>
                Volver
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={correctMutation.isPending || definitiveError}>
                {correctMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Confirmar Corrección</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
