import { ShoppingBasket } from 'lucide-react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
}

export function BrandLogo({ variant = 'dark', compact = false }: BrandLogoProps) {
  const isLight = variant === 'light';
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
          isLight ? 'bg-[#2563EB] text-white' : 'bg-[#123B70] text-white'
        }`}
      >
        <ShoppingBasket className="h-5 w-5" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span
          className={`font-display text-lg font-extrabold tracking-tight ${
            isLight ? 'text-white' : 'text-[#123B70]'
          }`}
        >
          Market<span className={isLight ? 'text-[#38BDF8]' : 'text-[#2563EB]'}>Sphere</span>
        </span>
      )}
    </span>
  );
}
