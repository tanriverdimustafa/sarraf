import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { Filter, X } from 'lucide-react';

const TransactionFilters = ({ filters, onFilterChange, onReset }) => {
  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Filtreler</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>İşlem Tipi</Label>
            <Select
              value={filters.type_code || 'all'}
              onValueChange={(value) =>
                onFilterChange('type_code', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="PURCHASE">Alış</SelectItem>
                <SelectItem value="SALE">Satış</SelectItem>
                <SelectItem value="PAYMENT">Ödeme</SelectItem>
                <SelectItem value="RECEIPT">Tahsilat</SelectItem>
                <SelectItem value="EXCHANGE">Döviz İşlemi</SelectItem>
                <SelectItem value="HURDA">Hurda Altın</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) =>
                onFilterChange('status', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                <SelectItem value="PENDING">Beklemede</SelectItem>
                <SelectItem value="CANCELLED">İptal</SelectItem>
                <SelectItem value="RECONCILED">Mutabakat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cari */}
          <div className="space-y-2">
            <Label>Cari</Label>
            <Input
              placeholder="Cari adı veya ID..."
              value={filters.party_id || ''}
              onChange={(e) => onFilterChange('party_id', e.target.value)}
            />
          </div>

          {/* Date Range - Start */}
          <div className="space-y-2">
            <Label>Başlangıç Tarihi</Label>
            <Input
              type="date"
              value={filters.start_date || ''}
              onChange={(e) => onFilterChange('start_date', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onReset}>
            <X className="w-4 h-4 mr-2" />
            Temizle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionFilters;
