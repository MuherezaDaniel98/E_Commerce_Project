export function formatUgx(amount: number | null | undefined): string {
  const num = Number(amount || 0);
  return `UGX ${num.toLocaleString('en-US')}`;
}

export function formatShortDate(dateValue: string | Date): string {
  return new Date(dateValue).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateValue: string | Date): string {
  return new Date(dateValue).toLocaleString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN Mobile Money',
  airtel_money: 'Airtel Money',
  card_demo: 'Visa / Mastercard',
  cash_on_delivery: 'Cash on Delivery / Collection',
};

export const ORDER_STATUS_STEPS = [
  'Pending',
  'Confirmed',
  'Processing',
  'Ready for collection',
  'Out for delivery',
  'Delivered',
] as const;

export function getStatusTextStyle(status: string): string {
  switch (status) {
    case 'Delivered':
    case 'paid':
    case 'active':
      return 'text-[#16A34A]';
    case 'Cancelled':
    case 'failed':
    case 'suspended':
      return 'text-[#DC2626]';
    case 'Pending':
    case 'pending':
      return 'text-[#D97706]';
    default:
      return 'text-[#2563EB]';
  }
}

export interface ProductDTO {
  id: number;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  specifications?: Record<string, string>;
  priceUgx: number;
  discountPriceUgx: number | null;
  imageUrl: string;
  isFeatured: boolean;
  promoTag: string | null;
  isActive?: boolean;
  ratingAvg: number;
  reviewCount: number;
  quantityOnHand: number;
  lowStockThreshold: number;
}
