import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { participantCreateSchema, catalogCreateSchema, CatalogCreateFormValues } from '../../schemas/production.schema';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useCreate: any;
  hasUserId?: boolean;
  title: string;
}

export function CatalogCreateDialog({ open, onOpenChange, useCreate, hasUserId, title }: Props) {
  const { toast } = useToast();
  const createMutation = useCreate();
  const schema = hasUserId ? participantCreateSchema : catalogCreateSchema;

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      ...(hasUserId ? { userId: '' } : {}),
    },
  });

  const onSubmit = async (data: any) => {
    try {
      // Remove empty optional userId
      const payload = { ...data };
      if (hasUserId && !payload.userId) {
        delete payload.userId;
      }

      await createMutation.mutateAsync(payload);
      toast({ title: 'Creado exitosamente' });
      onOpenChange(false);
      form.reset();
    } catch (err) {
      const prodErr = mapProductionError(err);
      toast({
        title: 'Error al crear',
        description: `${prodErr.code}: ${prodErr.userMessage}${prodErr.requestId ? ` (Req: ${prodErr.requestId})` : ''}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo registro: {title}</DialogTitle>
          <DialogDescription>
            Crea un nuevo elemento en el catálogo. El código debe ser único.
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
                    <Input placeholder="Ej: VAR-01" {...field} data-testid="input-catalog-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre o descripción" {...field} data-testid="input-catalog-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasUserId && (
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID de Usuario (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="UUID del usuario si corresponde" {...field} data-testid="input-catalog-userid" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-catalog-create-submit">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
