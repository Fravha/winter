import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo } from 'react';
import {
  useProductionContainers,
  useWorkTypes,
  useMeasurementTypes,
  useParticipants,
  useTransformationOrders,
  useProductionBatches,
  useProductionWorks,
} from '../../api/production.hooks';

interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ContainerSelect({ value, onValueChange, disabled }: SelectProps) {
  const { data, isLoading } = useProductionContainers();
  return (
    <Select value={value || 'none'} onValueChange={v => onValueChange(v === 'none' ? '' : v)} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione contenedor..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin contenedor</SelectItem>
        {data?.data.map(c => <SelectItem key={c.id} value={c.id}>{c.code} ({c.capacity} {c.capacityUnit})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function WorkTypeSelect({ value, onValueChange, disabled }: SelectProps) {
  const { data, isLoading } = useWorkTypes({ active: true, pageSize: 100 });
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione tipo..." /></SelectTrigger>
      <SelectContent>
        {data?.data.map(c => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function MeasurementTypeSelect({ value, onValueChange, disabled }: SelectProps) {
  const { data, isLoading } = useMeasurementTypes({ active: true, pageSize: 100 });
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione tipo..." /></SelectTrigger>
      <SelectContent>
        {data?.data.map(c => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ParticipantSelect({ value, onValueChange, disabled }: SelectProps) {
  const { data, isLoading } = useParticipants({ active: true, pageSize: 100 });
  return (
    <Select value={value || 'none'} onValueChange={v => onValueChange(v === 'none' ? '' : v)} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione participante..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin participante</SelectItem>
        {data?.data.map(c => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

interface TransformationOrderSelectProps extends SelectProps {
  productionOrderId?: string;
}

export function TransformationOrderSelect({ value, onValueChange, disabled, productionOrderId }: TransformationOrderSelectProps) {
  const { data, isLoading } = useTransformationOrders({ pageSize: 100, status: 'OPEN' });
  
  const filtered = useMemo(() => {
    if (!data?.data) return [];
    if (!productionOrderId) return data.data;
    return data.data.filter(t => t.productionOrderId === productionOrderId);
  }, [data, productionOrderId]);

  return (
    <Select value={value || 'none'} onValueChange={v => onValueChange(v === 'none' ? '' : v)} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione orden..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin orden T.</SelectItem>
        {filtered.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

interface BatchSelectProps extends SelectProps {
  productionOrderId?: string;
}

export function BatchSelect({ value, onValueChange, disabled, productionOrderId }: BatchSelectProps) {
  const { data, isLoading } = useProductionBatches({ pageSize: 100, productionOrderId });
  return (
    <Select value={value || 'none'} onValueChange={v => onValueChange(v === 'none' ? '' : v)} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione lote..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin lote</SelectItem>
        {data?.data.map(c => <SelectItem key={c.id} value={c.id}>{c.code} ({c.balance.available} {c.unit})</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

interface WorkSelectProps extends SelectProps {
  productionOrderId?: string;
}

export function WorkSelect({ value, onValueChange, disabled, productionOrderId }: WorkSelectProps) {
  const { data, isLoading } = useProductionWorks({ pageSize: 100, productionOrderId });
  const { data: workTypes } = useWorkTypes({ pageSize: 100 });
  const typeMap = new Map(workTypes?.data.map(t => [t.id, t.name]) || []);
  
  return (
    <Select value={value || 'none'} onValueChange={v => onValueChange(v === 'none' ? '' : v)} disabled={disabled || isLoading}>
      <SelectTrigger><SelectValue placeholder="Seleccione trabajo..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin trabajo</SelectItem>
        {data?.data.map(c => (
          <SelectItem key={c.id} value={c.id}>
            {typeMap.get(c.workTypeId) || 'Trabajo'} - {new Date(c.performedAt).toLocaleDateString('es-BO')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
