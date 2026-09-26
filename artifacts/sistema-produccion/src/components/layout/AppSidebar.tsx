import { Link, useLocation } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import { BrandMark } from '@/components/shared/BrandMark';
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
      { label: 'Reportes', href: '/reportes', icon: FileText, permission: 'reports:export' },
    ],
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
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
      <SidebarHeader className="border-b border-sidebar-border p-3 group-data-[collapsible=icon]:p-1">
        <Link href="/" onClick={closeMobileNavigation} data-testid="link-brand-home" className="flex min-h-12 items-center rounded-md px-1 text-sidebar-foreground hover:opacity-80 focus-visible:outline-2 focus-visible:outline-sidebar-ring group-data-[collapsible=icon]:px-0">
          <BrandMark />
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
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.15em] text-sidebar-foreground/65">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href || (item.href !== '/' && location.startsWith(`${item.href}/`))}
                        className="h-10 text-sidebar-foreground data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-9!"
                        tooltip={item.label}
                      >
                        <Link href={item.href} onClick={closeMobileNavigation} data-testid={`link-nav-${item.href.replaceAll('/', '-').replace(/^-/, '') || 'inicio'}`}>
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
