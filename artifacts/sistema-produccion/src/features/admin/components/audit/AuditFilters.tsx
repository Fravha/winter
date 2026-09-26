import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import type { AuditLogQuery } from '@/features/admin/types';

type FilterFields = Pick<AuditLogQuery, 'action' | 'resourceType' | 'actorUserId' | 'resourceId' | 'from' | 'to'>;
type AuditFiltersProps = {
  filters: AuditLogQuery;
  onChange: (filters: FilterFields) => void;
  onReset: () => void;
};

function toLocalInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AuditFilters({ filters, onChange, onReset }: AuditFiltersProps) {
  // Local state for form fields to allow editing before applying
  const [localFilters, setLocalFilters] = useState({
    action: filters.action || '',
    resourceType: filters.resourceType || '',
    from: toLocalInput(filters.from),
    to: toLocalInput(filters.to),
    actorUserId: filters.actorUserId || '',
    resourceId: filters.resourceId || '',
  });

  const [error, setError] = useState('');

  // Sync local state when reset is called from outside (e.g., initial load or full reset)
  useEffect(() => {
    setLocalFilters({
      action: filters.action || '',
      resourceType: filters.resourceType || '',
      from: toLocalInput(filters.from),
      to: toLocalInput(filters.to),
      actorUserId: filters.actorUserId || '',
      resourceId: filters.resourceId || '',
    });
  }, [filters.action, filters.resourceType, filters.from, filters.to, filters.actorUserId, filters.resourceId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApply = () => {
    setError('');
    const from = localFilters.from ? new Date(localFilters.from) : null;
    const to = localFilters.to ? new Date(localFilters.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      setError('Ingrese fechas válidas.');
      return;
    }

    if (from && to && from > to) {
      setError('La fecha "Desde" no puede ser mayor que "Hasta".');
      return;
    }

    onChange({
      action: localFilters.action.trim() || undefined,
      resourceType: localFilters.resourceType.trim() || undefined,
      actorUserId: localFilters.actorUserId.trim() || undefined,
      resourceId: localFilters.resourceId.trim() || undefined,
      from: from?.toISOString(),
      to: to?.toISOString(),
    });
  };

  const handleReset = () => {
    setError('');
    setLocalFilters({
      action: '',
      resourceType: '',
      from: '',
      to: '',
      actorUserId: '',
      resourceId: '',
    });
    onReset();
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">Acción</Label>
              <Input
                id="action"
                name="action"
                placeholder="ej. CREATE, UPDATE"
                value={localFilters.action}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resourceType">Tipo de Recurso</Label>
              <Input
                id="resourceType"
                name="resourceType"
                placeholder="ej. USER, ARTICLE"
                value={localFilters.resourceType}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Desde</Label>
              <Input
                type="datetime-local"
                id="from"
                name="from"
                value={localFilters.from}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hasta</Label>
              <Input
                type="datetime-local"
                id="to"
                name="to"
                value={localFilters.to}
                onChange={handleChange}
              />
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline text-sm font-medium text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filtros avanzados
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="actorUserId">ID de Usuario (Actor)</Label>
                    <Input
                      id="actorUserId"
                      name="actorUserId"
                      placeholder="UUID del usuario"
                      value={localFilters.actorUserId}
                      onChange={handleChange}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resourceId">ID de Recurso</Label>
                    <Input
                      id="resourceId"
                      name="resourceId"
                      placeholder="UUID del recurso afectado"
                      value={localFilters.resourceId}
                      onChange={handleChange}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
            <Button onClick={handleApply}>
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
