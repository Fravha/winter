import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/auth/ThemeContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Moon, Sun, User as UserIcon } from 'lucide-react';
import { useLocation } from 'wouter';

export function AppTopbar() {
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const section = location.startsWith('/administracion') ? 'Administración' :
    location.startsWith('/articulos') ? 'Artículos' :
    location.startsWith('/compras') ? 'Compras' :
    location.startsWith('/inventario') ? 'Inventario' :
    location.startsWith('/produccion') ? 'Producción' :
    location.startsWith('/reportes') ? 'Reportes' : 'Inicio';

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-5 md:px-6">
      <SidebarTrigger className="h-9 w-9 shrink-0 text-foreground" aria-label="Abrir o cerrar navegación" data-testid="button-toggle-navigation" />
      <div className="min-w-0 flex-1 border-l border-border pl-3 sm:pl-4">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sistema de Producción CDZ</span>
        <span className="block text-sm font-semibold text-foreground" data-testid="text-current-section">{section}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} data-testid="button-toggle-theme" className="h-9 w-9 shrink-0 text-foreground">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="ml-auto h-10 gap-3 rounded-full px-1.5 pr-3"
            aria-label="Abrir menú de usuario"
          >
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                {getInitials(user?.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-40 truncate text-sm font-medium">
                {user?.displayName || 'Usuario'}
              </span>
              {role && (
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                  {role}
                </span>
              )}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.displayName || 'Usuario'}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              {role && (
                <p className="text-xs leading-none text-primary font-medium mt-1 uppercase tracking-wider">
                  {role}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="cursor-not-allowed text-muted-foreground">
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
