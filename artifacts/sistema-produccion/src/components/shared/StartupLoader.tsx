import { useEffect, useState } from 'react';
import { BrandMark } from './BrandMark';

const messages = [
  'Preparando la jornada de bodega',
  'Verificando tu acceso',
  'Organizando la información de producción',
  'Dejando todo listo para comenzar',
];

export function StartupLoader({ label = 'Cargando el sistema', compact = false }: { label?: string; compact?: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => setStep((current) => (current + 1) % messages.length), 2800);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div role="status" aria-live="polite" aria-label={label} className={`flex w-full items-center justify-center bg-background px-5 ${compact ? 'min-h-56 rounded-xl border border-border' : 'min-h-dvh'}`}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card px-7 py-9 shadow-sm">
        <BrandMark compact={compact} />
        <div className="mt-9 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 origin-left rounded-full bg-primary motion-safe:animate-[startup-progress_2.8s_ease-in-out_infinite] motion-reduce:w-full" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
        <p className="mt-2 min-h-6 text-sm text-muted-foreground" data-testid="status-startup-message">{messages[step]}</p>
      </div>
    </div>
  );
}