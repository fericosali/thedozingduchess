import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Number formatting utilities
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return value.toLocaleString('id-ID');
}

export function formatCurrency(value: number | null | undefined, currency: 'IDR' | 'CNY' = 'IDR'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return currency === 'IDR' ? 'Rp0' : '¥0';
  }
  // Round up to avoid decimal fraction with currency display
  const rounded = Math.ceil(value);
  const formattedNumber = rounded.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return currency === 'IDR' ? `Rp${formattedNumber}` : `¥${formattedNumber}`;
}

export function formatPrice(value: number | null | undefined): string {
  return formatCurrency(value, 'IDR');
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return Math.round(value).toLocaleString('id-ID');
}
