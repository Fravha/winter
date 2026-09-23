import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customFieldDefinitionCreateSchema, CustomFieldDefinitionCreateFormValues } from '../../schemas/production.schema';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { useCreateCustomFieldDefinition } from '../../api/production.hooks';
import { CUSTOM_FIELD_ENTITY_TYPES, CUSTOM_FIELD_DATA_TYPES, CustomFieldEntityType, CustomFieldDataType } from '../../types/production.types';

export function CustomFieldDefinitionCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const createMutation = useCreateCustomFieldDefinition();

  const form = useForm<CustomFieldDefinitionCreateFormValues>({
    resolver: zodResolver(customFieldDefinitionCreateSchema),
    defaultValues: {
      entityType: 'PRODUCER',
      code: '',
      label: '',
      dataType: 'TEXT',
      required: false,
      active: true,
      displayOrder: 0,
      options: [],
    },
  });

  const dataType = form.watch('dataType');
  const [newOption, setNewOption] = useState('');

  const onSubmit = async (data: CustomFieldDefinitionCreateFormValues) => {
    try {
      const payload = { ...data };
      if (payload.dataType !== 'SELECT') {
        delete payload.options;
      } else if (!payload.options || payload.options.length === 0) {
        form.setError('options', { message: 'Debe agregar al menos una opción' });
        return;
      }

      await createMutation.mutateAsync(payload);
      toast({ title: 'Campo personalizado creado' });
      onOpenChange(false);
      form.reset();
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

  const entityTypeLabels: Record<string, string> = {
    'PRODUCER': 'Productor',
    'GRAPE_VARIETY': 'Variedad de Uva',
    'GRAPE_RECEPTION': 'Recepción de Uva'
  };

  const dataTypeLabels: Record<string, string> = {
    'TEXT': 'Texto', 'INTEGER': 'Entero', 'DECIMAL': 'Decimal',
    'BOOLEAN': 'Booleano', 'DATE': 'Fecha', 'SELECT': 'Selección'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Campo Personalizado</DialogTitle>
          <DialogDescription>Define un nuevo campo adicional para una entidad.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="entityType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidad</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CUSTOM_FIELD_ENTITY_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{entityTypeLabels[t] || t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="dataType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Dato</FormLabel>
                  <Select onValueChange={(val) => { field.onChange(val); if(val !== 'SELECT') form.setValue('options', []); }} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CUSTOM_FIELD_DATA_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{dataTypeLabels[t] || t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl><Input placeholder="Ej: REGION_PROD" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

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
                    <DialogDescription className="text-xs">Debe completarse obligatoriamente</DialogDescription>
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

            {dataType === 'SELECT' && (
              <div className="space-y-3 pt-4 border-t mt-4">
                <FormLabel>Opciones de Selección</FormLabel>
                <div className="flex gap-2">
                  <Input value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Nueva opción..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())} />
                  <Button type="button" onClick={addOption} variant="secondary" aria-label="Agregar opción" data-testid="button-custom-field-add-option"><Plus className="h-4 w-4" /></Button>
                </div>
                <FormField control={form.control} name="options" render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {field.value?.map((opt, i) => (
                        <div key={i} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
                          {opt}
                          <button type="button" onClick={() => removeOption(opt)} className="hover:text-destructive" aria-label={`Eliminar opción ${opt}`} data-testid={`button-custom-field-remove-option-${i}`}><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                      {(!field.value || field.value.length === 0) && <span className="text-sm text-muted-foreground italic">Sin opciones definidas</span>}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <div className="flex justify-end pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
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
