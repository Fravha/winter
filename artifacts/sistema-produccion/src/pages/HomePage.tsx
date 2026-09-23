import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Boxes, Factory, Package, Settings, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Link } from 'wouter';

const quickAccessItems = [
  { label: 'Artículos', href: '/articulos', permission: 'articulos:read', icon: Package },
  { label: 'Compras', href: '/compras', permission: 'compras:read', icon: ShoppingCart },
  { label: 'Inventario', href: '/inventario', permission: 'inventory:read', icon: Boxes },
  { label: 'Producción', href: '/produccion', permission: 'production:read', icon: Factory },
];

export default function HomePage() {
  const { user, role, can } = useAuth();
  const visibleItems = quickAccessItems.filter((item) => can(item.permission));
  const canAccessAdministration = can('users:read') || can('rbac:read');
  
  return (
    <div className="space-y-6">
      <PageHeader 
        eyebrow="Winter"
        title={`Bienvenido, ${user?.displayName || 'Usuario'}`}
        description={role ? `Sesión activa con el perfil ${role}.` : 'Selecciona un módulo para comenzar.'}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <Card key={item.href} className="group shadow-sm transition-colors hover:border-primary/40">
            <CardContent className="p-0">
              <Link
                href={item.href}
                className="flex min-h-28 items-center gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Abrir módulo
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>
        ))}

        {canAccessAdministration && (
          <Card className="group shadow-sm transition-colors hover:border-primary/40">
            <CardContent className="p-0">
              <Link
                href="/administracion"
                className="flex min-h-28 items-center gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Settings className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Administración</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Abrir módulo
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
