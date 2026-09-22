import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useCancelCompra } from '../api/compras.hooks';
import { cancelCompraSchema } from '../schemas/compra.schema';
import { mapCompraError } from '../api/compras.error';
import type { Compra, CancelCompraInput } from '../types/compra.types';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { comprasKeys } from '../api/compras.keys';

interface CompraCancelDialogProps {
  compra: Compra | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompraCancelDialog({ compra, open, onOpenChange }: CompraCancelDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);

  const cancelMutation = useCancelCompra({
    onSuccess: () => {
      toast({ title: 'Compra cancelada exitosamente' });
      onOpenChange(false);
    },
    onError: (err) => {
      const mapped = mapCompraError(err);
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
      setValidationDetails(mapped.details ?? null);

      if (['COMPRA_NOT_EDITABLE', 'COMPRA_NOT_RECEIVABLE', 'COMPRA_NOT_CANCELLABLE', 'COMPRA_TRANSITION_FAILED'].includes(mapped.code)) {
        queryClient.invalidateQueries({ queryKey: comprasKeys.lists() });
        if (compra) queryClient.invalidateQueries({ queryKey: comprasKeys.detail(compra.id) });
      }
    },
  });

  const form = useForm<CancelCompraInput>({
    resolver: zodResolver(cancelCompraSchema),
    defaultValues: {
      reason: '',
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (cancelMutation.isPending) return;
    if (!newOpen) {
      form.reset();
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (values: CancelCompraInput) => {
    if (!compra) return;
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);

    const payload = values.reason && values.reason.trim() !== '' ? { reason: values.reason.trim() } : {};
    cancelMutation.mutate({ id: compra.id, input: payload });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="dialog-cancel-compra"
        onInteractOutside={(e) => { if (cancelMutation.isPending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (cancelMutation.isPending) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Cancelar Compra</DialogTitle>
          <DialogDescription>
            ¿Estás seguro que deseas cancelar la compra {compra?.supplierName}? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explica el motivo de la cancelación..."
                      className="resize-none"
                      {...field}
                      value={field.value || ''}
                      data-testid="input-cancel-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {errorMsg && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20 flex items-start flex-col">
                <div className="flex items-center mb-1">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errorMsg}
                </div>
                {reqId && <span className="block text-xs opacity-80 mt-1">Req ID: {reqId}</span>}
                {validationDetails ? (
                  <div className="mt-2 w-full text-xs bg-destructive/20 p-2 rounded max-h-32 overflow-y-auto font-mono">
                    {Array.isArray(validationDetails)
                      ? validationDetails.map((d, i) => <div key={i}>• {typeof d === 'string' ? d : JSON.stringify(d)}</div>)
                      : typeof validationDetails === 'object'
                      ? <pre className="whitespace-pre-wrap">{JSON.stringify(validationDetails, null, 2)}</pre>
                      : String(validationDetails)
                    }
                  </div>
                ) : null}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-dialog-close"
              >
                Volver
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-dialog-confirm"
                className="gap-2"
              >
                {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Cancelación
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
