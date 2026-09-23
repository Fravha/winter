import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { catalogUpdateSchema } from '../../schemas/production.schema';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Catalog } from '../../types/production.types';
import { useEffect } from 'react';
import { z } from 'zod';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useUpdate: any;
  item: Catalog;
  title: string;
}

export function CatalogUpdateDialog({ open, onOpenChange, useUpdate, item, title }: Props) {
  const { toast } = useToast();
  const updateMutation = useUpdate();

  type FormValues = z.infer<typeof catalogUpdateSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(catalogUpdateSchema),
    defaultValues: {
      name: item.name,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: item.name });
    }
  }, [open, item, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      await updateMutation.mutateAsync({ id: item.id, input: data });
      toast({ title: 'Actualizado exitosamente' });
      onOpenChange(false);
    } catch (err) {
      const prodErr = mapProductionError(err);
      toast({
        title: 'Error al actualizar',
        description: `${prodErr.code}: ${prodErr.userMessage}${prodErr.requestId ? ` (Req: ${prodErr.requestId})` : ''}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar: {title}</DialogTitle>
          <DialogDescription>
            Modificar el nombre del registro. El código es inmutable.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormItem>
              <FormLabel>Código</FormLabel>
              <FormControl>
                <Input value={item.code} disabled className="bg-muted" data-testid="input-catalog-code-readonly" />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre o descripción" {...field} data-testid="input-catalog-name-edit" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-catalog-update-submit">
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
