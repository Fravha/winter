import { Badge } from '@/components/ui/badge';
import { CompraStatus } from '../types/compra.types';

export function CompraStatusBadge({ status }: { status: CompraStatus }) {
  switch (status) {
    case 'REGISTERED':
      return (
        <Badge variant="outline" className="bg-info/10 text-info border-info/20 font-medium" data-testid={`status-${status}`}>
          Registrada
        </Badge>
      );
    case 'RECEIVED':
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-medium" data-testid={`status-${status}`}>
          Recibida
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-medium" data-testid={`status-${status}`}>
          Cancelada
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" data-testid={`status-${status}`}>
          {status}
        </Badge>
      );
  }
}
