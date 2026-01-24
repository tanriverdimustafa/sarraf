/**
 * Pagination Component
 * Sayfalama kontrolleri
 */
import React from 'react';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  showTotal = true,
  className = ''
}) {
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {showTotal && (
        <div className="text-sm text-muted-foreground">
          {total > 0 ? (
            <span>{startItem}-{endItem} / {total} kayıt</span>
          ) : (
            <span>Kayıt bulunamadı</span>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!canGoPrevious}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="px-3 text-sm">
          {page} / {totalPages || 1}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
