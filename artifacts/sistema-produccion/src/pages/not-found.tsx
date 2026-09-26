import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/shared/BrandMark';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-8 sm:px-8">
      <section className="relative isolate flex min-h-[min(680px,calc(100dvh-4rem))] w-full max-w-5xl items-center justify-center overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 px-6 py-14 text-center shadow-sm sm:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-48 h-96 w-96 rounded-full border border-primary/10 sm:h-[32rem] sm:w-[32rem]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -left-36 h-96 w-96 rounded-full border border-primary/10 sm:h-[32rem] sm:w-[32rem]" />
        <div className="relative z-10 flex max-w-xl flex-col items-center">
          <BrandMark size="large" compact />
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Sistema de Producción CDZ
          </p>
          <p className="mt-1 font-serif text-[clamp(5.5rem,19vw,10rem)] leading-none text-primary/60">
            404
          </p>
          <span aria-hidden="true" className="my-6 h-px w-16 bg-primary/40" />
          <h1 className="font-serif text-2xl font-semibold leading-tight text-foreground sm:text-4xl">
            Parece que este camino no llega a la bodega.
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            La página que buscas no existe o fue movida.
          </p>
          <Button asChild className="mt-8">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
