import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { transformationOrderCreateSchema, TransformationOrderCreateFormValues } from '../../schemas/production.schema';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useCreateTransformationOrder } from '../../api/production.hooks';
import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';
import { toLocalDateTimeInput } from '../../utils/production-date';

export function TransformationOrderCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createMutation = useCreateTransformationOrder();

  const form = useForm<TransformationOrderCreateFormValues>({
    resolver: zodResolver(transformationOrderCreateSchema),
    defaultValues: {
      code: '',
      productionOrderId: '',
      periodStart: toLocalDateTimeInput(),
      periodEnd: '',
      observations: '',
    },
  });

  const onSubmit = async (data: TransformationOrderCreateFormValues) => {
    try {
      const payload = {
        ...data,
        periodStart: new Date(data.periodStart).toISOString()
      };

      if (payload.periodEnd) {
        payload.periodEnd = new Date(payload.periodEnd).toISOString();
      } else {
        delete payload.periodEnd;
      }

      if (!payload.observations) delete payload.observations;

      await createMutation.mutateAsync(payload);
      toast({ title: 'Orden de transformación creada' });
      onOpenChange(false);
      form.reset();
    } catch (err) {
      const prodErr = mapProductionError(err);
      toast({
        title: 'Error al crear orden',
        description: `${prodErr.code}: ${prodErr.userMessage}${prodErr.requestId ? ` (Req: ${prodErr.requestId})` : ''}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%_-_2rem)]">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Transformación</DialogTitle>
          <DialogDescription>
            Crea una orden operativa vinculada a una orden de producción.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productionOrderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden de Producción Padre</FormLabel>
                  <FormControl>
                    <ProductionOrderSelect
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: TR-001" {...field} data-testid="input-transformation-order-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inicio de Período</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-transformation-order-start" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin de Período (opcional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-transformation-order-end" value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales..."
                      className="resize-none"
                      {...field}
                      value={field.value || ''}
                      data-testid="input-transformation-order-observations"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-transformation-order-create-submit">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Orden
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
