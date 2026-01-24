/**
 * Currency Display Component
 * Para birimi formatı ile gösterim
 */
import React from 'react';
import { cn } from '../../lib/utils';

// Format helpers
export const formatCurrency = (value, currency = 'TRY', decimals = 2) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  const symbols = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
    HAS: 'HAS'
  };
  
  const formatted = num.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  const symbol = symbols[currency] || currency;
  
  if (currency === 'HAS') {
    return `${formatted} ${symbol}`;
  }
  return `${formatted} ${symbol}`;
};

export const formatWeight = (value, unit = 'gr') => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  return `${num.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })} ${unit}`;
};

export function CurrencyDisplay({
  value,
  currency = 'TRY',
  decimals = 2,
  showPositive = false,
  className = ''
}) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const isNegative = num < 0;
  const isPositive = num > 0;
  
  return (
    <span className={cn(
      className,
      isNegative && 'text-red-600',
      showPositive && isPositive && 'text-green-600'
    )}>
      {formatCurrency(value, currency, decimals)}
    </span>
  );
}

export function WeightDisplay({
  value,
  unit = 'gr',
  className = ''
}) {
  return (
    <span className={className}>
      {formatWeight(value, unit)}
    </span>
  );
}

export default CurrencyDisplay;
