import { useState } from 'react';
import { Redirect } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, Moon, ServerCrash, Sun } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';
import { StartupLoader } from '@/components/shared/StartupLoader';
import { useTheme } from '@/auth/ThemeContext';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { isFirebaseConfigured, login, authenticated, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <BrandMark />
          <Alert variant="destructive" className="bg-card p-6">
            <ServerCrash className="h-4 w-4" />
            <AlertTitle>Error de configuración</AlertTitle>
            <AlertDescription>
              El sistema no está configurado correctamente. Faltan variables de entorno de Firebase.
              Por favor, contacta al administrador del sistema.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={toggleTheme} data-testid="button-error-toggle-theme">
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <StartupLoader label="Preparando acceso" />;
  }

  if (authenticated) {
    return <Redirect to="/" />;
  }

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    try {
      await login(values.email, values.password);
      // Navigation is handled by the component re-rendering with `authenticated = true` via wouter <Redirect />
    } catch (fbError) {
      if (fbError instanceof FirebaseError) {
        switch (fbError.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            setError('El correo o la contraseña son incorrectos.');
            break;
          case 'auth/too-many-requests':
            setError('Demasiados intentos fallidos. Intenta más tarde.');
            break;
          default:
            setError('No fue posible iniciar sesión. Verifica tus datos e intenta de nuevo.');
        }
      } else {
        setError('Ocurrió un error inesperado al intentar iniciar sesión.');
      }
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center bg-background p-4 sm:p-8">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <Button type="button" variant="outline" size="icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} data-testid="button-login-toggle-theme" className="h-10 w-10">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandMark size="large" compact />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Acceso operativo</p>
            <h1 className="mt-2 font-serif text-2xl font-semibold leading-tight text-foreground sm:text-3xl">Sistema de Producción CDZ</h1>
          </div>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para continuar la jornada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="usuario@ejemplo.com"
                          autoComplete="email"
                          autoFocus
                          data-testid="input-login-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              className="pr-12"
                              data-testid="input-login-password"
                              {...field}
                            />
                          </FormControl>
                          <span className="absolute inset-y-0 right-1 flex items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              aria-pressed={showPassword}
                              onClick={() => setShowPassword((visible) => !visible)}
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                            </Button>
                          </span>
                        </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={form.formState.isSubmitting}
                  data-testid="button-login-submit"
                >
                  {form.formState.isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Acceso exclusivo para personal autorizado.</p>
      </div>
    </div>
  );
}