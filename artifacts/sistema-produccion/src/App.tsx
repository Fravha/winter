import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { AuthProvider } from '@/auth/AuthContext';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { PermissionGuard } from '@/components/shared/PermissionGuard';
import { AppShell } from '@/components/layout/AppShell';

import LoginPage from '@/pages/auth/LoginPage';
import HomePage from '@/pages/HomePage';
import NotFound from '@/pages/not-found';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import ArticulosPage from '@/pages/articulos/ArticulosPage';



const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <AppShell>
        <Switch>
          <Route path="/" component={HomePage} />
          
          <Route path="/articulos">
            <PermissionGuard permission="articulos:read" showErrorPage>
              <ArticulosPage />
            </PermissionGuard>
          </Route>

          <Route path="/compras">
            <PermissionGuard permission="compras:read" showErrorPage>
              <PlaceholderPage 
                eyebrow="Operaciones"
                title="Compras"
                description="Registro y recepción de compras a proveedores."
              />
            </PermissionGuard>
          </Route>

          <Route path="/inventario">
            <PermissionGuard permission="inventory:read" showErrorPage>
              <PlaceholderPage 
                eyebrow="Operaciones"
                title="Inventario"
                description="Gestión de almacenes, stock, lotes y movimientos."
              />
            </PermissionGuard>
          </Route>

          <Route path="/produccion">
            <PermissionGuard permission="production:read" showErrorPage>
              <PlaceholderPage 
                eyebrow="Operaciones"
                title="Producción"
                description="Control de órdenes de producción, trabajos, transformaciones y trazabilidad."
              />
            </PermissionGuard>
          </Route>
          
          {/* Grouped administracion - using generic routing for these roles */}
          <Route path="/administracion">
            <PermissionGuard permission={['users:read', 'rbac:read']} showErrorPage>
              <PlaceholderPage 
                eyebrow="Administración"
                title="Administración"
                description="Ajustes generales, usuarios, roles y permisos."
              />
            </PermissionGuard>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </AuthGuard>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/iniciar-sesion" component={LoginPage} />
        <Route component={ProtectedRoutes} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
