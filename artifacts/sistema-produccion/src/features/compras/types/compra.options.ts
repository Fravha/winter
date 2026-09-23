import { COMPRA_STATUSES, COMPRA_UNITS } from './compra.types';

export const compraStatusOptions = [
  { value: COMPRA_STATUSES[0], label: 'Registrada' },
  { value: COMPRA_STATUSES[1], label: 'Recibida' },
  { value: COMPRA_STATUSES[2], label: 'Cancelada' },
] as const;

export const compraUnitOptions = COMPRA_UNITS.map((value) => ({ value, label: value }));