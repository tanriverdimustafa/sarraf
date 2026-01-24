/**
 * Page Header Component
 * Sayfa başlığı ve açıklama
 */
import React from 'react';

export function PageHeader({ 
  title, 
  description = '', 
  action = null,
  breadcrumb = null 
}) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <div className="mb-2 text-sm text-muted-foreground">
          {breadcrumb}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
