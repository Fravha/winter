import { useAuth } from '@/auth/AuthContext';
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
import { LogOut, User as UserIcon } from 'lucide-react';

export function AppTopbar() {
  const { user, role, logout } = useAuth();

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
    <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-background px-4 md:px-6 w-full shrink-0 z-10 sticky top-0">
      <SidebarTrigger className="shrink-0 md:hidden" />
      
      <div className="w-full flex-1" />
      
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
