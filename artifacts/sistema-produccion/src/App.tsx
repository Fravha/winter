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
import { ThemeProvider } from '@/auth/ThemeContext';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { PermissionGuard } from '@/components/shared/PermissionGuard';
import { AppShell } from '@/components/layout/AppShell';

import LoginPage from '@/pages/auth/LoginPage';
import HomePage from '@/pages/HomePage';
import NotFound from '@/pages/not-found';
import AdministracionPage from '@/pages/administracion/AdministracionPage';
import UsuariosPage from '@/pages/administracion/UsuariosPage';
import RolesPage from '@/pages/administracion/RolesPage';
import PermisosPage from '@/pages/administracion/PermisosPage';
import AuditoriaPage from '@/pages/administracion/AuditoriaPage';
import ProduccionPage from '@/pages/produccion/ProduccionPage';
import BatchTracePage, { BATCH_TRACE_PERMISSION } from '@/pages/produccion/BatchTracePage';
import ArticulosPage from '@/pages/articulos/ArticulosPage';
import ComprasPage from '@/pages/compras/ComprasPage';
import InventarioPage from '@/pages/inventario/InventarioPage';
import ReportesPage from '@/pages/reportes/ReportesPage';

const queryClient = new QueryClient();

// Keep these paths in sync with the routes inside ProtectedRoutes. Unknown paths
// must reach the public 404 without bypassing guards on valid routes.
const protectedPaths = [
  '/',
  '/articulos',
  '/compras',
  '/inventario',
  '/produccion',
  '/reportes',
  '/produccion/batches/:batchId/trace',
  '/administracion/usuarios',
  '/administracion/roles',
  '/administracion/permisos',
  '/administracion/auditoria',
  '/administracion',
] as const;

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
              <ComprasPage />
            </PermissionGuard>
          </Route>

          <Route path="/inventario">
            <PermissionGuard permission="inventory:read" showErrorPage>
              <InventarioPage />
            </PermissionGuard>
          </Route>

          <Route path="/produccion">
            <PermissionGuard permission="production:read" showErrorPage>
              <ProduccionPage />
            </PermissionGuard>
          </Route>

          <Route path="/reportes">
            <PermissionGuard permission="reports:export" showErrorPage>
              <ReportesPage />
            </PermissionGuard>
          </Route>

          <Route path="/produccion/batches/:batchId/trace">
            {(params) => (
              <PermissionGuard permission={BATCH_TRACE_PERMISSION} showErrorPage>
                <BatchTracePage batchId={params.batchId} />
              </PermissionGuard>
            )}
          </Route>

          <Route path="/administracion/usuarios">
            <PermissionGuard permission="users:read" showErrorPage>
              <UsuariosPage />
            </PermissionGuard>
          </Route>

          <Route path="/administracion/roles">
            <PermissionGuard permission="rbac:read" showErrorPage>
              <RolesPage />
            </PermissionGuard>
          </Route>

          <Route path="/administracion/permisos">
            <PermissionGuard permission="rbac:read" showErrorPage>
              <PermisosPage />
            </PermissionGuard>
          </Route>

          <Route path="/administracion/auditoria">
            <PermissionGuard permission="audit:read" showErrorPage>
              <AuditoriaPage />
            </PermissionGuard>
          </Route>

          <Route path="/administracion">
            <PermissionGuard permission={['users:read', 'users:manage', 'rbac:read', 'rbac:manage', 'audit:read']} showErrorPage>
              <AdministracionPage />
            </PermissionGuard>
          </Route>

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
        {protectedPaths.map((path) => (
          <Route key={path} path={path} component={ProtectedRoutes} />
        ))}
        <Route path="*" component={NotFound} />
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
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
