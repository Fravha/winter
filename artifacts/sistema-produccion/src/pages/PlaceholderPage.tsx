import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader 
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <Card className="border-dashed shadow-none bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center h-[400px] text-center p-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Construction className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-medium mb-2">Módulo en construcción</h2>
          <p className="text-muted-foreground max-w-md">
            Esta sección del sistema se encuentra definida en la arquitectura, pero su 
            implementación funcional está pendiente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
