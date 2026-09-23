import { Link, useLocation } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  Package,
  ShoppingCart,
  Boxes,
  Factory,
  Settings,
  Users,
  Shield,
  KeyRound,
  FileText,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string | string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'GENERAL',
    items: [
      { label: 'Inicio', href: '/', icon: Home },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { label: 'Artículos', href: '/articulos', icon: Package, permission: 'articulos:read' },
      { label: 'Compras', href: '/compras', icon: ShoppingCart, permission: 'compras:read' },
      { label: 'Inventario', href: '/inventario', icon: Boxes, permission: 'inventory:read' },
      { label: 'Producción', href: '/produccion', icon: Factory, permission: 'production:read' },
    ],
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
      { label: 'Administración', href: '/administracion', icon: Settings, permission: ['users:read', 'users:manage', 'rbac:read', 'rbac:manage', 'audit:read'] },
      { label: 'Usuarios', href: '/administracion/usuarios', icon: Users, permission: 'users:read' },
      { label: 'Roles', href: '/administracion/roles', icon: Shield, permission: 'rbac:read' },
      { label: 'Permisos', href: '/administracion/permisos', icon: KeyRound, permission: 'rbac:read' },
      { label: 'Auditoría', href: '/administracion/auditoria', icon: FileText, permission: 'audit:read' },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { can } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileNavigation = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="font-serif font-bold text-xl leading-none">C</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-serif font-bold leading-tight">Cruce del Zorro</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">Winter</span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {navGroups.map((group) => {
          // Filter items based on permissions
          const visibleItems = group.items.filter((item) => {
            if (!item.permission) return true;
            return (Array.isArray(item.permission) ? item.permission : [item.permission]).some(can);
          });
          
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                          isActive={location === item.href || (item.href !== '/' && item.href !== '/administracion' && location.startsWith(`${item.href}/`))}
                        tooltip={item.label}
                      >
                        <Link href={item.href} onClick={closeMobileNavigation}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
