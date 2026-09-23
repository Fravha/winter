import { Link } from 'wouter';
import { Users, Shield, Key } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdministracionPage() {
  const { can } = useAuth();

  const canViewUsers = can('users:read') || can('users:manage');
  const canViewRoles = can('rbac:read') || can('rbac:manage');
  const canViewPermissions = can('rbac:read') || can('rbac:manage');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-6">
      <PageHeader
        eyebrow="Configuración"
        title="Administración"
        description="Gestión de usuarios, roles y permisos del sistema."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {canViewUsers && (
          <Link href="/administracion/usuarios" className="block hover-elevate rounded-xl group transition-all">
            <Card className="h-full border-border/50 group-hover:border-primary/30 transition-colors shadow-sm">
              <CardHeader>
                <Users className="w-8 h-8 text-primary mb-3" />
                <CardTitle className="text-xl">Usuarios</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Administrar cuentas de acceso, suspender usuarios y asignar roles.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {canViewRoles && (
          <Link href="/administracion/roles" className="block hover-elevate rounded-xl group transition-all">
            <Card className="h-full border-border/50 group-hover:border-primary/30 transition-colors shadow-sm">
              <CardHeader>
                <Shield className="w-8 h-8 text-primary mb-3" />
                <CardTitle className="text-xl">Roles</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Definir roles del sistema y configurar sus conjuntos de permisos.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {canViewPermissions && (
          <Link href="/administracion/permisos" className="block hover-elevate rounded-xl group transition-all">
            <Card className="h-full border-border/50 group-hover:border-primary/30 transition-colors shadow-sm">
              <CardHeader>
                <Key className="w-8 h-8 text-primary mb-3" />
                <CardTitle className="text-xl">Permisos</CardTitle>
                <CardDescription className="text-sm mt-1">
                  Catálogo de permisos base disponibles para asignar a los roles.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
