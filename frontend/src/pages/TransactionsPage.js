import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { 
  Plus, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Eye,
  Filter,
  X,
  FileText
} from 'lucide-react';
import { getFinancialTransactions } from '../services/financialV2Service';
import { toast } from 'sonner';

const TransactionsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type_code: '',
    status: '',
    party_id: '',
    start_date: '',
  });
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10,
    total_items: 0,
    total_pages: 1
  });

  useEffect(() => {
    loadTransactions();
  }, [filters, pagination.page, pagination.page_size]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = Object.keys(filters).reduce((acc, key) => {
        if (filters[key]) acc[key] = filters[key];
        return acc;
      }, {});
      
      params.page = pagination.page;
      params.page_size = pagination.page_size;
      params.sort_by = 'transaction_date';
      params.sort_order = 'desc';

      const response = await getFinancialTransactions(params);
      
      if (response && response.data) {
        setTransactions(Array.isArray(response.data) ? response.data : []);
        setPagination(prev => ({
          ...prev,
          ...response.pagination
        }));
      } else {
        setTransactions(Array.isArray(response) ? response : []);
      }
    } catch (error) {
      console.error('Transaction load error:', error);
      toast.error('İşlemler yüklenemedi: ' + error.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      type_code: '',
      status: '',
      party_id: '',
      start_date: '',
    });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPagination(prev => ({ ...prev, page_size: Number(newSize), page: 1 }));
  };

  const handleCreateTransaction = (type) => {
    // Tüm işlem türleri /transactions/create/xxx formatında
    navigate(`/transactions/create/${type}`);
  };

  const openTransactionDetail = (code) => {
    window.open(`/transactions/${encodeURIComponent(code)}`, '_blank');
  };

  // Sarrafiye (adet sayılacak) ürün tipleri
  const PIECE_PRODUCTS = ["Çeyrek", "Yarım", "Tam", "Cumhuriyet", "Ata", "Reşat", "Hamit", "Ziynet", "Lira"];

  // UUID kontrolü (anlamsız ID'leri gösterme)
  const isUUID = (value) => {
    if (typeof value !== 'string') return false;
    return value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i) !== null;
  };

  // Güvenli değer (boş veya UUID ise fallback)
  const safeValue = (value, fallback = '-') => {
    if (value === null || value === undefined || value === '') return fallback;
    if (isUUID(value)) return fallback;
    return value;
  };

  // Format helpers
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Sadece tarih formatı
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    if (amount === null || amount === undefined || amount === 0) return '-';
    const symbols = { TRY: '₺', USD: '$', EUR: '€', HAS: 'HAS' };
    return `${Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${symbols[currency] || '₺'}`;
  };

  // İşlem tipi etiketleri (emoji + Türkçe)
  const getTypeLabel = (typeCode) => {
    const labels = {
      'PURCHASE': 'Alış',
      'SALE': 'Satış',
      'PAYMENT': 'Ödeme',
      'RECEIPT': 'Tahsilat',
      'EXCHANGE': 'Döviz',
      'HURDA': 'Hurda',
      'EXPENSE': 'Gider'
    };
    return labels[typeCode] || typeCode || '-';
  };

  // İşlem tipi renkleri (daha belirgin)
  const getTypeColor = (typeCode) => {
    const colors = {
      'PURCHASE': 'bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400',
      'SALE': 'bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400',
      'PAYMENT': 'bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400',
      'RECEIPT': 'bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-400',
      'EXCHANGE': 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-400',
      'HURDA': 'bg-amber-600/20 text-amber-700 border-amber-600/30 dark:text-amber-400',
      'EXPENSE': 'bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400'
    };
    return colors[typeCode] || 'bg-muted text-muted-foreground';
  };

  // İşlem tipi emoji'leri
  const getTypeEmoji = (typeCode) => {
    const emojis = {
      'PURCHASE': '🔵',
      'SALE': '🟢',
      'PAYMENT': '🟠',
      'RECEIPT': '🟣',
      'EXCHANGE': '🟡',
      'HURDA': '🟤',
      'EXPENSE': '🔴'
    };
    return emojis[typeCode] || '⚪';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'COMPLETED': 'Tamamlandı',
      'PENDING': 'Bekliyor',
      'CANCELLED': 'İptal',
      'VOIDED': 'İptal Edildi'
    };
    return labels[status] || status || '-';
  };

  const getStatusColor = (status) => {
    const colors = {
      'COMPLETED': 'bg-green-500/10 text-green-600',
      'PENDING': 'bg-yellow-500/10 text-yellow-600',
      'CANCELLED': 'bg-red-500/10 text-red-600',
      'VOIDED': 'bg-gray-500/10 text-gray-600'
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  // Ödeme durumu (Peşin / Veresiye / Kısmi) + Kasa bilgisi
  const getPaymentStatus = (tx) => {
    // Ödeme/Tahsilat/Döviz işlemleri için farklı gösterim
    if (['PAYMENT', 'RECEIPT', 'EXCHANGE'].includes(tx.type_code)) {
      const cashRegister = tx.cash_register_name || tx.cash_register?.name || tx.payment_method_name || '';
      const paymentMethod = tx.payment_method_name || tx.payment_method || '';
      
      if (tx.type_code === 'PAYMENT') {
        return (
          <div className="flex flex-col items-center">
            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">💸 Ödeme</Badge>
            {(cashRegister || paymentMethod) && (
              <span className="text-xs text-muted-foreground mt-0.5">{cashRegister || paymentMethod}</span>
            )}
          </div>
        );
      }
      if (tx.type_code === 'RECEIPT') {
        return (
          <div className="flex flex-col items-center">
            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">💰 Tahsilat</Badge>
            {(cashRegister || paymentMethod) && (
              <span className="text-xs text-muted-foreground mt-0.5">{cashRegister || paymentMethod}</span>
            )}
          </div>
        );
      }
      if (tx.type_code === 'EXCHANGE') {
        return (
          <div className="flex flex-col items-center">
            <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">💱 Döviz</Badge>
          </div>
        );
      }
    }
    
    // Alış/Satış için ödeme durumu
    const total = tx.total_amount || tx.total_amount_tl || tx.total_amount_currency || tx.amount || 0;
    const paid = tx.paid_amount || tx.actual_paid || tx.payment_amount || 0;
    const cashRegister = tx.cash_register_name || tx.cash_register?.name || '';
    const paymentMethod = tx.payment_method_name || tx.payment_method || '';
    const isCredit = tx.is_credit || tx.payment_type === 'CREDIT' || tx.payment_difference_type === 'CREDIT';
    
    // Tutar 0 ise (nadir durum)
    if (total === 0) return <span className="text-muted-foreground">-</span>;
    
    // Veresiye (hiç ödeme yapılmamış veya kredi olarak işaretlenmiş)
    if (paid === 0 || isCredit) {
      return (
        <div className="flex flex-col items-center">
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">⚠️ Veresiye</Badge>
          <span className="text-xs text-muted-foreground mt-0.5">Ödeme yok</span>
        </div>
      );
    }
    
    // Tam ödeme (Peşin)
    if (paid >= total) {
      return (
        <div className="flex flex-col items-center">
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">✅ Peşin</Badge>
          {(cashRegister || paymentMethod) && (
            <span className="text-xs text-muted-foreground mt-0.5">{cashRegister || paymentMethod}</span>
          )}
        </div>
      );
    }
    
    // Kısmi ödeme
    const remaining = total - paid;
    return (
      <div className="flex flex-col items-center">
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">🔵 Kısmi</Badge>
        <span className="text-xs font-medium text-blue-600 mt-0.5">{formatCurrency(paid)}</span>
        {(cashRegister || paymentMethod) && (
          <span className="text-xs text-muted-foreground">/ {cashRegister || paymentMethod}</span>
        )}
      </div>
    );
  };

  // Ürün detayı - Alış/Satış için uygun format
  const getProductDetails = (tx) => {
    // items varsa (yeni format)
    if (tx.items && tx.items.length > 0) {
      const displayItems = tx.items.slice(0, 2);
      const hasMore = tx.items.length > 2;
      
      return (
        <div className="space-y-0.5">
          {displayItems.map((item, idx) => {
            // Ürün adı veya tipi
            let name = item.product_name || item.product_type || item.name || '';
            // Karat bilgisi - sayı veya metin olabilir
            let karat = item.karat || item.karat_name || '';
            if (typeof karat === 'object' && karat.name) karat = karat.name;
            // Pool modunda (Havuz) bilgisi
            const isPool = item.is_pool || item.pool_mode;
            
            // Boş ise fallback
            if (!name && !karat) {
              name = tx.type_code === 'PURCHASE' ? 'Alış' : tx.type_code === 'SALE' ? 'Satış' : 'Ürün';
            }
            
            // Eğer ürün adı zaten karat içeriyorsa tekrar ekleme
            const showKarat = karat && name && !name.toUpperCase().includes(karat.toUpperCase());
            
            return (
              <div key={idx} className="text-sm truncate max-w-[200px]">
                <span className="font-medium">{name}</span>
                {showKarat && <span className="text-muted-foreground ml-1">{karat}</span>}
                {isPool && <span className="text-amber-600 ml-1 text-xs">(Havuz)</span>}
              </div>
            );
          })}
          {hasMore && <span className="text-xs text-muted-foreground">+{tx.items.length - 2} daha</span>}
        </div>
      );
    }
    
    // lines varsa (eski format)
    if (tx.lines && tx.lines.length > 0) {
      const displayLines = tx.lines.slice(0, 2);
      const hasMore = tx.lines.length > 2;
      
      return (
        <div className="space-y-0.5">
          {displayLines.map((line, idx) => {
            const name = line.product_name || line.product_type || line.description || 'Ürün';
            const karat = line.karat || line.karat_name || '';
            return (
              <div key={idx} className="text-sm truncate max-w-[200px]">
                <span className="font-medium">{name}</span>
                {karat && <span className="text-muted-foreground ml-1">{karat}</span>}
              </div>
            );
          })}
          {hasMore && <span className="text-xs text-muted-foreground">+{tx.lines.length - 2} daha</span>}
        </div>
      );
    }
    
    // Pool transaction
    if (tx.pool_data || tx.is_pool_transaction) {
      const poolType = tx.pool_data?.product_type || 'Bilezik';
      const poolKarat = tx.pool_data?.karat || tx.karat || '';
      return (
        <span className="text-sm">
          <span className="font-medium">{poolType}</span>
          {poolKarat && <span className="text-muted-foreground ml-1">{poolKarat}</span>}
          <span className="text-amber-600 ml-1 text-xs">(Havuz)</span>
        </span>
      );
    }
    
    // description varsa (düz metin)
    if (tx.description && !isUUID(tx.description)) {
      return <span className="text-sm truncate max-w-[200px]">{tx.description}</span>;
    }
    
    // product_type varsa (legacy)
    if (tx.product_type) {
      const karat = tx.karat || tx.karat_name || '';
      return (
        <span className="text-sm">
          <span className="font-medium">{tx.product_type}</span>
          {karat && <span className="text-muted-foreground ml-1">{karat}</span>}
        </span>
      );
    }
    
    // scrap/hurda transaction
    if (tx.type_code === 'HURDA' && tx.scrap_type) {
      return <span className="text-sm font-medium">Hurda Altın ({tx.scrap_type})</span>;
    }
    
    // Ödeme/Tahsilat için
    if (tx.type_code === 'PAYMENT') {
      return <span className="text-sm text-muted-foreground">Ödeme İşlemi</span>;
    }
    if (tx.type_code === 'RECEIPT') {
      return <span className="text-sm text-muted-foreground">Tahsilat İşlemi</span>;
    }
    if (tx.type_code === 'EXCHANGE') {
      return <span className="text-sm text-muted-foreground">Döviz İşlemi</span>;
    }
    
    return <span className="text-muted-foreground">-</span>;
  };

  // Miktar - Gram veya Adet
  const getQuantity = (tx) => {
    // items varsa (yeni format)
    if (tx.items && tx.items.length > 0) {
      const displayItems = tx.items.slice(0, 2);
      const hasMore = tx.items.length > 2;
      
      return (
        <div className="space-y-0.5">
          {displayItems.map((item, idx) => {
            const productName = (item.product_name || item.product_type || item.name || '').toUpperCase();
            const isPiece = PIECE_PRODUCTS.some(p => productName.includes(p.toUpperCase()));
            
            if (isPiece) {
              const qty = item.quantity || item.adet || 1;
              return <div key={idx} className="text-sm font-medium">{qty} adet</div>;
            } else {
              const gram = item.weight_gram || item.sold_gram || item.gram || item.quantity || 0;
              return <div key={idx} className="text-sm font-medium">{Number(gram).toFixed(2)} gr</div>;
            }
          })}
          {hasMore && <span className="text-xs text-muted-foreground">+{tx.items.length - 2} daha</span>}
        </div>
      );
    }
    
    // lines varsa (eski format)
    if (tx.lines && tx.lines.length > 0) {
      let totalGram = 0;
      let totalPiece = 0;
      
      tx.lines.forEach(line => {
        const productName = (line.product_name || line.product_type || '').toUpperCase();
        const isPiece = PIECE_PRODUCTS.some(p => productName.includes(p.toUpperCase()));
        
        if (isPiece) {
          totalPiece += (line.quantity || line.adet || 1);
        } else {
          totalGram += (line.weight_gram || line.gram || line.quantity || 0);
        }
      });
      
      if (totalPiece > 0 && totalGram > 0) {
        return (
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{totalPiece} adet</div>
            <div className="text-sm font-medium">{totalGram.toFixed(2)} gr</div>
          </div>
        );
      }
      if (totalPiece > 0) return <span className="text-sm font-medium">{totalPiece} adet</span>;
      if (totalGram > 0) return <span className="text-sm font-medium">{totalGram.toFixed(2)} gr</span>;
    }
    
    // Pool transaction
    if (tx.pool_data) {
      const poolGram = tx.pool_data.weight_gram || tx.pool_data.quantity || 0;
      if (poolGram > 0) return <span className="text-sm font-medium">{Number(poolGram).toFixed(2)} gr</span>;
    }
    
    // toplam gram (weight_gram field)
    if (tx.total_weight_gram || tx.weight_gram) {
      const gram = tx.total_weight_gram || tx.weight_gram;
      return <span className="text-sm font-medium">{Number(gram).toFixed(2)} gr</span>;
    }
    
    // sold_gram
    if (tx.sold_gram) {
      return <span className="text-sm font-medium">{Number(tx.sold_gram).toFixed(2)} gr</span>;
    }
    
    // toplam HAS (sadece gram/adet yoksa)
    if (tx.total_has || tx.has_amount) {
      const has = tx.total_has || tx.has_amount;
      return <span className="text-sm text-muted-foreground">{Number(has).toFixed(4)} HAS</span>;
    }
    
    // Ödeme/Tahsilat/Döviz için özel
    if (['PAYMENT', 'RECEIPT', 'EXCHANGE'].includes(tx.type_code)) {
      if (tx.amount || tx.total_amount) {
        return <span className="text-sm text-muted-foreground">-</span>;
      }
    }
    
    return <span className="text-muted-foreground">-</span>;
  };

  // Tutar
  const getAmount = (tx) => {
    const amount = tx.total_amount || tx.total_amount_tl || tx.amount || tx.total_amount_currency || 0;
    if (!amount || amount === 0) {
      return <span className="text-muted-foreground">-</span>;
    }
    return <span className="font-medium">{formatCurrency(amount)}</span>;
  };

  // Cari adı (UUID yerine isim)
  const getPartyName = (tx) => {
    if (tx.party_name) return tx.party_name;
    if (tx.party?.name) return tx.party.name;
    if (tx.supplier_name) return tx.supplier_name;
    if (tx.customer_name) return tx.customer_name;
    if (tx.party_id && !isUUID(tx.party_id)) return tx.party_id;
    return <span className="text-muted-foreground">-</span>;
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, pagination.page - Math.floor(maxVisible / 2));
    let end = Math.min(pagination.total_pages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-medium text-foreground">Finansal İşlemler</h1>
          <p className="text-muted-foreground mt-1">Alış, satış, ödeme ve tahsilat işlemleri</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTransactions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Yeni İşlem
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreateTransaction('purchase')}>
                Alış İşlemi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateTransaction('sale')}>
                Satış İşlemi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateTransaction('exchange')}>
                Döviz Alış-Satış
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateTransaction('payment')}>
                Ödeme
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateTransaction('receipt')}>
                Tahsilat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtreler
              {hasActiveFilters && <Badge className="ml-2" variant="secondary">Aktif</Badge>}
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sayfa başına:</span>
                <Select value={String(pagination.page_size)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Toplam: <strong>{pagination.total_items}</strong> işlem
              </span>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-5 gap-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label>İşlem Tipi</Label>
                <Select value={filters.type_code || "ALL"} onValueChange={(v) => handleFilterChange('type_code', v === "ALL" ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tümü</SelectItem>
                    <SelectItem value="PURCHASE">Alış</SelectItem>
                    <SelectItem value="SALE">Satış</SelectItem>
                    <SelectItem value="PAYMENT">Ödeme</SelectItem>
                    <SelectItem value="RECEIPT">Tahsilat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select value={filters.status || "ALL"} onValueChange={(v) => handleFilterChange('status', v === "ALL" ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tümü</SelectItem>
                    <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
                    <SelectItem value="PENDING">Bekliyor</SelectItem>
                    <SelectItem value="CANCELLED">İptal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Cari</Label>
                <Input
                  placeholder="Cari adı veya ID..."
                  value={filters.party_id}
                  onChange={(e) => handleFilterChange('party_id', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                />
              </div>
              
              <div className="space-y-2 flex items-end">
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Temizle
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans flex items-center gap-2">
            <FileText className="w-5 h-5" />
            İşlem Listesi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground mt-2">Yükleniyor...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-primary/20 rounded-lg">
              <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">İşlem bulunamadı</p>
              <Button className="mt-4" onClick={() => handleCreateTransaction('purchase')}>
                <Plus className="w-4 h-4 mr-2" />
                İlk İşlemi Oluştur
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">İşlem No</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Tarih</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Tip</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Cari</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Ürün Detayı</th>
                      <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Miktar</th>
                      <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Tutar</th>
                      <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Ödeme</th>
                      <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Durum</th>
                      <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <tr 
                        key={tx.code} 
                        className={`border-b border-border hover:bg-muted/50 cursor-pointer ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                        onClick={() => openTransactionDetail(tx.code)}
                      >
                        <td className="p-3 font-mono text-sm">{tx.code}</td>
                        <td className="p-3 text-sm whitespace-nowrap">{formatDateTime(tx.transaction_date)}</td>
                        <td className="p-3">
                          <Badge className={`${getTypeColor(tx.type_code)} font-medium`}>
                            {getTypeEmoji(tx.type_code)} {getTypeLabel(tx.type_code)}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm font-medium">
                          {getPartyName(tx)}
                        </td>
                        <td className="p-3">{getProductDetails(tx)}</td>
                        <td className="p-3 text-right text-sm">{getQuantity(tx)}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(tx.total_amount_currency || tx.total_amount, tx.currency)}
                        </td>
                        <td className="p-3 text-center">
                          {getPaymentStatus(tx)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={getStatusColor(tx.status)}>
                            {getStatusLabel(tx.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTransactionDetail(tx.code)}
                            title="Detay"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Toplam {pagination.total_items} işlem, Sayfa {pagination.page}/{pagination.total_pages}
                </span>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Önceki
                  </Button>
                  
                  {getPageNumbers().map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.total_pages}
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsPage;
