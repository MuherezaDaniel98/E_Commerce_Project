import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className = 'w-full h-full object-cover' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#EAF3FF] via-[#F5F7FB] to-[#E2E8F0] text-[#123B70]/70 p-4 text-center">
        <ShoppingBag className="h-8 w-8 stroke-[1.75]" />
        <span className="text-xs font-medium text-[#64748B] line-clamp-2 max-w-[160px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
