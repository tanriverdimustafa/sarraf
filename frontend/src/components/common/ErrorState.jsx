/**
 * Error State Component
 * Hata durumu gösterimi
 */
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function ErrorState({
  title = 'Bir hata oluştu',
  message = 'Lütfen tekrar deneyin',
  onRetry = null,
  variant = 'destructive'
}) {
  return (
    <Alert variant={variant} className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tekrar Dene
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default ErrorState;
