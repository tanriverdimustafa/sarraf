/**
 * Empty State Component
 * Boş veri durumu gösterimi
 */
import React from 'react';
import { InboxIcon } from 'lucide-react';
import { Button } from '../ui/button';

export function EmptyState({
  icon: Icon = InboxIcon,
  title = 'Veri bulunamadı',
  description = '',
  action = null,
  actionLabel = '',
  onAction = null
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && onAction && (
        <Button onClick={onAction}>
          {actionLabel || action}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
