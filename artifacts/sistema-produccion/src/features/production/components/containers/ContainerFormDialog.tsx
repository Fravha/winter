import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useCreateProductionContainer, useUpdateProductionContainer } from '../../api/production.hooks';
import { ProductionContainer, ContainerType } from '../../types/production.types';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  code: z.string().min(1, 'Obligatorio'),
  name: z.string().optional(),
  type: z.enum(['TANQUE', 'BARRICA', 'OTRO']),
  location: z.string().optional(),
  material: z.string().optional(),
  capacity: z.string().min(1, 'Obligatorio'),
  capacityUnit: z.string().min(1, 'Obligatorio'),
  observations: z.string().optional()
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: ProductionContainer | null;
}

export function ContainerFormDialog({ open, onOpenChange, container }: Props) {
  const { toast } = useToast();
  const createReq = useCreateProductionContainer();
  const updateReq = useUpdateProductionContainer();
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      type: 'TANQUE',
      location: '',
      material: '',
      capacity: '',
      capacityUnit: 'L',
      observations: ''
    }
  });

  useEffect(() => {
    if (open) {
      if (container) {
        form.reset({
          code: container.code,
          name: container.name || '',
          type: container.type || 'TANQUE',
          location: container.location || '',
          material: container.material || '',
          capacity: container.capacity,
          capacityUnit: container.capacityUnit,
          observations: container.observations || ''
        });
      } else {
        form.reset({
          code: '',
          name: '',
          type: 'TANQUE',
          location: '',
          material: '',
          capacity: '',
          capacityUnit: 'L',
          observations: ''
        });
      }
    }
  }, [open, container, form]);

  const onSubmit = (data: FormData) => {
    if (container) {
      const { code: _code, capacityUnit: _capacityUnit, ...input } = data;
      updateReq.mutate({ id: container.id, input }, {
        onSuccess: () => {
          toast({ title: 'Recipiente actualizado' });
          onOpenChange(false);
        },
        onError: (err) => {
          const e = mapProductionError(err);
          toast({ variant: 'destructive', title: 'Error', description: e.userMessage });
        }
      });
    } else {
      createReq.mutate(data, {
        onSuccess: () => {
          toast({ title: 'Recipiente creado' });
          onOpenChange(false);
        },
        onError: (err) => {
          const e = mapProductionError(err);
          toast({ variant: 'destructive', title: 'Error', description: e.userMessage });
        }
      });
    }
  };

  const isPending = createReq.isPending || updateReq.isPending;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="w-[calc(100%_-_2rem)] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{container ? 'Editar Recipiente' : 'Nuevo Recipiente'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!!container || isPending} placeholder="T-01, B-123..." data-testid="input-code" />
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
                    <FormLabel>Nombre (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder="Tanque 01" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select disabled={isPending} onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="input-type">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TANQUE">Tanque</SelectItem>
                        <SelectItem value="BARRICA">Barrica</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} type="number" step="0.01" data-testid="input-capacity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacityUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select disabled={!!container || isPending} onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="input-capacityUnit">
                          <SelectValue placeholder="Unidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="HL">HL</SelectItem>
                        <SelectItem value="KG">KG</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder="Sala de tanques" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="material"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isPending} placeholder="Acero inoxidable, Roble..." />
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
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={isPending} className="resize-none" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}