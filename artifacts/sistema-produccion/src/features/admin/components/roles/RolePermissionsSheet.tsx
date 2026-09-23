import { useEffect, useState, useMemo } from 'react';
import { RoleAdmin } from '@/features/admin/types/admin.types';
import { useReplaceRolePermissions, usePermissions } from '@/features/admin/api/admin.hooks';
import { useAuth } from '@/auth/AuthContext';
import { AdminErrorAlert } from '../shared/admin-error-mapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

export function RolePermissionsSheet({ role, open, onOpenChange }: { role: RoleAdmin | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const { can } = useAuth();
  const canReadPermissions = can('rbac:read');
  const replacePermissions = useReplaceRolePermissions();
  const { data, isLoading, error: fetchError } = usePermissions({ enabled: canReadPermissions && open });
  const availablePermissions = data ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && role) {
      setSelectedIds(new Set((role.permissions || []).map(p => p.id)));
    }
  }, [open, role]);

  const handleToggle = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!role) return;
    replacePermissions.mutate(
      { id: role.id, permissionIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          toast({ title: 'Permisos actualizados', description: 'El conjunto de permisos del rol ha sido reemplazado exitosamente.' });
          onOpenChange(false);
        },
      }
    );
  };

  const isPending = replacePermissions.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar Permisos del Rol: {role?.name}</DialogTitle>
          <DialogDescription>
            Seleccione el conjunto exacto de permisos que este rol debe tener. <strong className="text-foreground">Se reemplazarán todos los permisos actuales.</strong>
          </DialogDescription>
        </DialogHeader>

        <AdminErrorAlert error={fetchError || replacePermissions.error} />

        <div className="bg-warning/10 border border-warning/30 text-warning-foreground p-3 flex gap-3 text-sm rounded-md mb-4 items-start">
          <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
          <p>
            Al guardar, los permisos seleccionados abajo reemplazarán completamente la configuración actual. Asegúrese de incluir todos los permisos necesarios.
          </p>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Cargando permisos disponibles...</div>
        ) : !canReadPermissions ? (
          <div className="py-8 text-center text-muted-foreground border rounded-md p-4">No tiene permisos para ver la lista de permisos.</div>
        ) : (
          <ScrollArea className="h-[400px] border rounded-md p-4">
            <div className="space-y-4">
              {availablePermissions.map((perm: any) => (
                <div key={perm.id} className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <Checkbox
                    id={`perm-${perm.id}`}
                    checked={selectedIds.has(perm.id)}
                    onCheckedChange={(checked) => handleToggle(perm.id, !!checked)}
                  />
                  <div className="grid gap-1.5 leading-none cursor-pointer flex-1" onClick={() => handleToggle(perm.id, !selectedIds.has(perm.id))}>
                    <span className="font-medium text-sm text-foreground flex items-center gap-2">
                      {perm.name}
                      <Badge variant="outline" className="font-mono text-[10px] py-0">{perm.code}</Badge>
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {perm.description || 'Sin descripción'}
                    </p>
                  </div>
                </div>
              ))}
              {availablePermissions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No hay permisos disponibles.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between pt-4 mt-2">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} permiso(s) seleccionados.
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending || isLoading || !!fetchError || !canReadPermissions}>
              {isPending ? 'Guardando...' : 'Reemplazar Permisos'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
