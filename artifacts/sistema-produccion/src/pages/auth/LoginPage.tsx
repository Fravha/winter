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
import { AlertCircle, ServerCrash } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { isFirebaseConfigured, login, authenticated, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Error de configuración</AlertTitle>
          <AlertDescription>
            El sistema no está configurado correctamente. Faltan variables de entorno de Firebase.
            Por favor, contacta al administrador del sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center animate-pulse text-muted-foreground">
          Cargando...
        </div>
      </div>
    );
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
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-primary">Cruce del Zorro</h1>
          <p className="text-muted-foreground mt-2 text-sm uppercase tracking-widest">Sistema de Producción</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder al sistema
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
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}