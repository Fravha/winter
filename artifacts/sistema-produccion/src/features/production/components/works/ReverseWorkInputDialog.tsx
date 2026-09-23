import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle } from 'lucide-react';
import { useReverseProductionWorkInput } from '../../api/production.hooks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { mapProductionError } from '../../api/production.error';
import { WorkInput } from '../../types/production.types';
import { Button } from '@/components/ui/button';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';

const schema = z.object({
  reason: z.string().min(1, 'La razón es requerida').max(2000, 'La razón no puede exceder 2000 caracteres'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  workId: string;
  input: WorkInput | null;
  onClose: () => void;
}

export function ReverseWorkInputDialog({ workId, input, onClose }: Props) {
  const reverseMutation = useReverseProductionWorkInput();
  const idempotencyRef = useRef({ opKey: '', reqHash: '' });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: ''
    }
  });

  useEffect(() => {
    if (input) {
      form.reset();
      reverseMutation.reset();
      idempotencyRef.current = { opKey: '', reqHash: '' };
    }
  }, [input, form, reverseMutation.reset]);

  if (!input || !input.warehouseId || !input.inventoryMovementId) return null;
  const warehouseId = input.warehouseId;

  const onFormSubmit = async (data: FormValues) => {
    const normalized = { reason: data.reason.trim() };
    const reqHash = await canonicalPayloadHash(normalized);

    if (!idempotencyRef.current.opKey || idempotencyRef.current.reqHash !== reqHash) {
      idempotencyRef.current = { opKey: createOperationKey(), reqHash };
    }

    reverseMutation.mutate({
      workId,
      inputId: input.id,
      articuloId: input.articuloId,
      warehouseId,
      inventoryLotId: input.inventoryLotId,
      input: {
        reason: normalized.reason,
        operationKey: idempotencyRef.current.opKey,
        requestHash: idempotencyRef.current.reqHash
      }
    }, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  const mappedError = reverseMutation.error ? mapProductionError(reverseMutation.error) : null;
  const isPending = reverseMutation.isPending;

  return (
    <AlertDialog open={!!input} onOpenChange={(open) => !open && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revertir Insumo Consumido</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción compensará el movimiento de inventario ({input.inventoryMovementId}) reingresando {input.quantity} {input.unit} al almacén original.
            El registro de insumo consumido se mantendrá en el historial pero con estado REVERTIDO.
            Esta acción no puede deshacerse.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón de la Reversión <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Especifique el motivo de la reversión" {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mappedError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error al revertir</AlertTitle>
                <AlertDescription>
                  {mappedError.userMessage}
                  {mappedError.requestId && <div className="text-xs font-mono mt-1 opacity-80">Req: {mappedError.requestId}</div>}
                </AlertDescription>
              </Alert>
            )}

            <AlertDialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Revertir Movimiento
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}