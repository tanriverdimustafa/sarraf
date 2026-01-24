/**
 * Loading State Component
 * Yükleme durumu gösterimi
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingState({ 
  message = 'Yükleniyor...', 
  size = 'default',
  fullScreen = false 
}) {
  const sizeClasses = {
    small: 'h-4 w-4',
    default: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-2">
      <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8">
      {content}
    </div>
  );
}

export function LoadingSpinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export default LoadingState;
