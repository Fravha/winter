import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productionOrderCreateSchema, ProductionOrderCreateFormValues } from '../../schemas/production.schema';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useCreateProductionOrder } from '../../api/production.hooks';
import { toLocalDateTimeInput } from '../../utils/production-date';

export function ProductionOrderCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createMutation = useCreateProductionOrder();

  const form = useForm<ProductionOrderCreateFormValues>({
    resolver: zodResolver(productionOrderCreateSchema),
    defaultValues: {
      code: '',
      startDate: toLocalDateTimeInput(),
      observations: '',
    },
  });

  const onSubmit = async (data: ProductionOrderCreateFormValues) => {
    try {
      // Ensure startDate is proper ISO-8601 offset format for Zod validation on backend
      const isoDate = new Date(data.startDate).toISOString();
      const payload = { ...data, startDate: isoDate };
      if (!payload.observations) delete payload.observations;

      await createMutation.mutateAsync(payload);
      toast({ title: 'Orden de producción creada' });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Orden de Producción</DialogTitle>
          <DialogDescription>
            Crea una nueva orden de producción raíz.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: V-2024" {...field} data-testid="input-production-order-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Inicio</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} data-testid="input-production-order-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      data-testid="input-production-order-observations"
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
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-production-order-create-submit">
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
