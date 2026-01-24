import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { BookOpen, Filter, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../lib/api';

const LEDGER_TYPE_LABELS = {
  SALE: { label: 'Satış', color: 'bg-green-500' },
  PURCHASE: { label: 'Alış', color: 'bg-blue-500' },
  PAYMENT: { label: 'Ödeme', color: 'bg-red-500' },
  RECEIPT: { label: 'Tahsilat', color: 'bg-emerald-500' },
  EXPENSE: { label: 'Gider', color: 'bg-orange-500' },
  SALARY_ACCRUAL: { label: 'Maaş Tahakkuk', color: 'bg-purple-500' },
  SALARY_PAYMENT: { label: 'Maaş Ödeme', color: 'bg-purple-700' },
  EMPLOYEE_DEBT: { label: 'Personel Avans', color: 'bg-amber-500' },
  EMPLOYEE_DEBT_PAYMENT: { label: 'Avans Tahsilat', color: 'bg-amber-700' },
  CAPITAL_IN: { label: 'Sermaye Giriş', color: 'bg-cyan-500' },
  CAPITAL_OUT: { label: 'Sermaye Çıkış', color: 'bg-cyan-700' },
  EXCHANGE: { label: 'Döviz', color: 'bg-indigo-500' },
  ADJUSTMENT: { label: 'Düzeltme', color: 'bg-yellow-500' },
  VOID: { label: 'İptal', color: 'bg-red-700' },
};

export default function UnifiedLedgerPage() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    type: '',
    party_type: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 1
  });

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page.toString(),
        per_page: pagination.per_page.toString()
      };
      
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.type) params.type = filters.type;
      if (filters.party_type) params.party_type = filters.party_type;
      
      const response = await api.get('/api/unified-ledger', { params });
      const data = response.data;
      
      setEntries(data.entries || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error('Failed to fetch ledger entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      
      const response = await api.get('/api/unified-ledger/summary', { params });
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchSummary();
  }, [pagination.page]);

  const handleFilter = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchEntries();
    fetchSummary();
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ' + currency;
  };

  const formatHAS = (amount) => {
    if (!amount && amount !== 0) return '-';
    return `${amount.toFixed(6)} HAS`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: tr });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Muhasebe Defteri</h1>
            <p className="text-sm text-muted-foreground">Unified Ledger - Tüm finansal hareketler</p>
          </div>
        </div>
        <Button onClick={() => { fetchEntries(); fetchSummary(); }} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Yenile
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* HAS Giriş = YEŞİL (bize giriyor) */}
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                HAS Giriş
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{formatHAS(summary.totals?.total_has_in)}
              </div>
            </CardContent>
          </Card>
          
          {/* HAS Çıkış = KIRMIZI (bizden çıkıyor) */}
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                HAS Çıkış
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{formatHAS(summary.totals?.total_has_out)}
              </div>
            </CardContent>
          </Card>
          
          {/* Kar = YEŞİL */}
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Toplam Kar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                +{formatHAS(summary.totals?.total_profit)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                İşlem Sayısı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {summary.totals?.entry_count || pagination.total}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              placeholder="Başlangıç"
            />
            <Input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              placeholder="Bitiş"
            />
            <Select
              value={filters.type || 'all'}
              onValueChange={(v) => setFilters(prev => ({ ...prev, type: v === 'all' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="İşlem Tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {Object.entries(LEDGER_TYPE_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.party_type || 'all'}
              onValueChange={(v) => setFilters(prev => ({ ...prev, party_type: v === 'all' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Taraf Tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="CUSTOMER">Müşteri</SelectItem>
                <SelectItem value="SUPPLIER">Tedarikçi</SelectItem>
                <SelectItem value="EMPLOYEE">Personel</SelectItem>
                <SelectItem value="PARTNER">Ortak</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleFilter} className="bg-primary hover:bg-primary/90">
              Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Kayıt bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Tarih</th>
                    <th className="text-left p-3 font-medium">Tip</th>
                    <th className="text-left p-3 font-medium">Taraf</th>
                    <th className="text-left p-3 font-medium">Açıklama</th>
                    <th className="text-right p-3 font-medium">HAS Giriş</th>
                    <th className="text-right p-3 font-medium">HAS Çıkış</th>
                    <th className="text-right p-3 font-medium">Tutar Giriş</th>
                    <th className="text-right p-3 font-medium">Tutar Çıkış</th>
                    <th className="text-right p-3 font-medium">Kar</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id || index} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">
                        {formatDate(entry.transaction_date)}
                      </td>
                      <td className="p-3">
                        <Badge className={`${LEDGER_TYPE_LABELS[entry.type]?.color || 'bg-gray-500'} text-white text-xs`}>
                          {LEDGER_TYPE_LABELS[entry.type]?.label || entry.type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{entry.party_name || '-'}</div>
                        {entry.party_type && (
                          <div className="text-xs text-muted-foreground">{entry.party_type}</div>
                        )}
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-muted-foreground">
                        {entry.description || '-'}
                      </td>
                      {/* HAS Giriş = YEŞİL */}
                      <td className="p-3 text-right font-mono">
                        {entry.has_in > 0 ? (
                          <span className="text-green-600 font-medium">+{formatHAS(entry.has_in)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {/* HAS Çıkış = KIRMIZI */}
                      <td className="p-3 text-right font-mono">
                        {entry.has_out > 0 ? (
                          <span className="text-red-600 font-medium">-{formatHAS(entry.has_out)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {/* Para Giriş = YEŞİL */}
                      <td className="p-3 text-right font-mono">
                        {entry.amount_in > 0 ? (
                          <span className="text-green-600 font-medium">+{formatCurrency(entry.amount_in, entry.currency)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {/* Para Çıkış = KIRMIZI */}
                      <td className="p-3 text-right font-mono">
                        {entry.amount_out > 0 ? (
                          <span className="text-red-600 font-medium">-{formatCurrency(entry.amount_out, entry.currency)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {/* Kar = YEŞİL, Zarar = KIRMIZI */}
                      <td className="p-3 text-right font-mono font-medium">
                        {entry.profit_has != null && entry.profit_has !== 0 ? (
                          <span className={entry.profit_has >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {entry.profit_has >= 0 ? '+' : ''}{formatHAS(entry.profit_has)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Toplam {pagination.total} kayıt, Sayfa {pagination.page}/{pagination.total_pages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Önceki
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Sonraki
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
