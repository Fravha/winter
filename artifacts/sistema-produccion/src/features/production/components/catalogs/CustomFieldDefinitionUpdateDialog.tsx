import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customFieldDefinitionUpdateSchema } from '../../schemas/production.schema';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { useUpdateCustomFieldDefinition } from '../../api/production.hooks';
import { CustomFieldDefinition } from '../../types/production.types';
import { z } from 'zod';

export function CustomFieldDefinitionUpdateDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void, item: CustomFieldDefinition }) {
  const { toast } = useToast();
  const updateMutation = useUpdateCustomFieldDefinition();

  type FormValues = z.infer<typeof customFieldDefinitionUpdateSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(customFieldDefinitionUpdateSchema),
    defaultValues: {
      label: item.label,
      required: item.required,
      displayOrder: item.displayOrder,
      options: item.options || [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        label: item.label,
        required: item.required,
        displayOrder: item.displayOrder,
        options: item.options || [],
      });
    }
  }, [open, item, form]);

  const [newOption, setNewOption] = useState('');

  const onSubmit = async (data: FormValues) => {
    try {
      const payload = { ...data };
      if (item.dataType !== 'SELECT') {
        delete payload.options;
      } else if (!payload.options || payload.options.length === 0) {
        form.setError('options', { message: 'Debe mantener al menos una opción' });
        return;
      }

      await updateMutation.mutateAsync({ id: item.id, input: payload });
      toast({ title: 'Campo actualizado exitosamente' });
      onOpenChange(false);
    } catch (err) {
      const prodErr = mapProductionError(err);
      toast({
        title: 'Error',
        description: `${prodErr.code}: ${prodErr.userMessage}${prodErr.requestId ? ` (Req: ${prodErr.requestId})` : ''}`,
        variant: 'destructive'
      });
    }
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    const current = form.getValues('options') || [];
    if (!current.includes(newOption.trim())) {
      form.setValue('options', [...current, newOption.trim()]);
    }
    setNewOption('');
  };

  const removeOption = (opt: string) => {
    const current = form.getValues('options') || [];
    form.setValue('options', current.filter(o => o !== opt));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Campo Personalizado</DialogTitle>
          <DialogDescription>Entidad, Código y Tipo de Dato son inmutables.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Entidad</FormLabel>
                <FormControl><Input value={item.entityType} disabled className="bg-muted" /></FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>Tipo de Dato</FormLabel>
                <FormControl><Input value={item.dataType} disabled className="bg-muted" /></FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl><Input value={item.code} disabled className="bg-muted" /></FormControl>
              </FormItem>

              <FormField control={form.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel>Etiqueta</FormLabel>
                  <FormControl><Input placeholder="Nombre visible" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex gap-6 items-center pt-2">
              <FormField control={form.control} name="required" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Requerido</FormLabel>
                  </div>
                </FormItem>
              )} />

              <FormField control={form.control} name="displayOrder" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Orden de Visualización</FormLabel>
                  <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {item.dataType === 'SELECT' && (
              <div className="space-y-3 pt-4 border-t mt-4">
                <FormLabel>Opciones de Selección</FormLabel>
                <div className="flex gap-2">
                  <Input value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Nueva opción..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())} />
                  <Button type="button" onClick={addOption} variant="secondary" aria-label="Agregar opción" data-testid="button-custom-field-update-add-option"><Plus className="h-4 w-4" /></Button>
                </div>
                <FormField control={form.control} name="options" render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {field.value?.map((opt, i) => (
                        <div key={i} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
                          {opt}
                          <button type="button" onClick={() => removeOption(opt)} className="hover:text-destructive" aria-label={`Eliminar opción ${opt}`} data-testid={`button-custom-field-update-remove-option-${i}`}><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <div className="flex justify-end pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
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
