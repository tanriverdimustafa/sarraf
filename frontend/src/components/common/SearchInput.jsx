/**
 * Search Input Component
 * Debounced arama input'ı
 */
import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useDebounce } from '../../hooks';

export function SearchInput({
  value: externalValue,
  onChange,
  placeholder = 'Ara...',
  debounceMs = 300,
  className = ''
}) {
  const [localValue, setLocalValue] = useState(externalValue || '');
  const debouncedValue = useDebounce(localValue, debounceMs);

  // Sync with external value
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== localValue) {
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  // Call onChange when debounced value changes
  useEffect(() => {
    if (onChange && debouncedValue !== externalValue) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, externalValue]);

  const handleClear = () => {
    setLocalValue('');
    if (onChange) onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default SearchInput;
