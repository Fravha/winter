type BrandMarkProps = {
  size?: 'small' | 'large';
  compact?: boolean;
};

export function BrandMark({ size = 'small', compact = false }: BrandMarkProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span className={`flex shrink-0 items-center justify-center rounded-lg border border-[#a66b76]/40 bg-[#581e32] ${size === 'large' ? 'h-20 w-20 p-2.5' : 'h-10 w-10 p-1'}`}>
        <img
          src={`${import.meta.env.BASE_URL}cdz-logo.webp`}
          alt="Logo institucional CDZ"
          className="h-full w-full object-contain"
        />
      </span>
      {!compact && (
        <span className="min-w-0 font-serif text-base font-semibold leading-tight text-current group-data-[collapsible=icon]:hidden">
          Sistema de Producción CDZ
        </span>
      )}
    </span>
  );
}