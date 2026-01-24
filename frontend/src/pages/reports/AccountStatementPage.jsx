import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { FileText, Printer, ChevronLeft, ChevronRight, User, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { partyService } from '../../services';
import api from '../../lib/api';

const AccountStatementPage = () => {
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Ayın ilk günü
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [priceSnapshot, setPriceSnapshot] = useState(null);

  // Fetch parties for dropdown
  useEffect(() => {
    const fetchParties = async () => {
      try {
        const response = await partyService.getAll({});
        // Handle pagination format: {data: [...], pagination: {...}}
        const partiesData = response?.data || response;
        setParties(Array.isArray(partiesData) ? partiesData : []);
      } catch (error) {
        console.error('Error fetching parties:', error);
        setParties([]);
      }
    };
    fetchParties();
  }, []);

  // Fetch price snapshot
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await api.get('/api/financial-v2/lookups/price-snapshot');
        setPriceSnapshot(response.data);
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };
    fetchPrices();
  }, []);

  // Convert parties to react-select format
  const partyOptions = parties.map(p => ({
    value: p.id,
    label: `${p.name} (${p.party_type_name || p.party_type_id === 1 ? 'Müşteri' : 'Tedarikçi'})`,
    party: p
  }));

  const fetchReport = useCallback(async () => {
    if (!selectedParty) {
      toast.error('Lütfen bir cari seçin');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/api/reports/account-statement', {
        params: {
          party_id: selectedParty.value,
          start_date: startDate,
          end_date: endDate,
          page,
          per_page: perPage
        }
      });
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [selectedParty, startDate, endDate, page, perPage]);

  // Refetch when page changes
  useEffect(() => {
    if (reportData && selectedParty) {
      fetchReport();
    }
  }, [page, perPage]);

  const handleFilter = () => {
    setPage(1);
    fetchReport();
  };

  const formatCurrency = (value, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return parseFloat(value).toLocaleString('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'SALE':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'PURCHASE':
        return <ArrowDownLeft className="w-4 h-4 text-blue-500" />;
      case 'RECEIPT':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'PAYMENT':
        return <TrendingDown className="w-4 h-4 text-orange-500" />;
      case 'EXCHANGE':
        return <RefreshCw className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionLabel = (type) => {
    const labels = {
      'SALE': 'Satış',
      'PURCHASE': 'Alış',
      'RECEIPT': 'Tahsilat',
      'PAYMENT': 'Ödeme',
      'EXCHANGE': 'Döviz',
      'HURDA': 'Hurda'
    };
    return labels[type] || type;
  };

  const handlePrint = () => {
    if (!reportData) return;

    const hasPrice = priceSnapshot?.has_sell_tl || 5943;
    const party = reportData.party;
    const transactions = reportData.transactions || [];
    const summary = reportData.summary || {};

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cari Ekstre - ${party?.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 24px; color: #333; margin-bottom: 5px; }
          .header p { color: #666; }
          .party-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .party-info h3 { margin-bottom: 10px; color: #333; }
          .party-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .party-info-item { display: flex; justify-content: space-between; }
          .party-info-item label { color: #666; }
          .party-info-item span { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #333; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f9f9f9; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          .summary { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .summary h3 { margin-bottom: 10px; color: #0369a1; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .summary-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e0e0e0; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CARİ EKSTRE RAPORU</h1>
          <p>Tarih Aralığı: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
        </div>

        <div class="party-info">
          <h3>Cari Bilgileri</h3>
          <div class="party-info-grid">
            <div class="party-info-item">
              <label>Cari Adı:</label>
              <span>${party?.name || '-'}</span>
            </div>
            <div class="party-info-item">
              <label>Cari Tipi:</label>
              <span>${party?.type === 'CUSTOMER' ? 'Müşteri' : 'Tedarikçi'}</span>
            </div>
            <div class="party-info-item">
              <label>Güncel Bakiye:</label>
              <span class="${party?.current_balance_has >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(party?.current_balance_has, 4)} HAS
              </span>
            </div>
            <div class="party-info-item">
              <label>TL Karşılığı:</label>
              <span class="${party?.current_balance_tl >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(party?.current_balance_tl)} ₺
              </span>
            </div>
          </div>
        </div>

        <h3 style="margin-bottom: 10px;">Hareket Listesi</h3>
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>İşlem</th>
              <th>Ürün/Detay</th>
              <th class="text-right">Miktar</th>
              <th class="text-right">HAS Değer</th>
              <th class="text-right">HAS Fiyatı</th>
              <th class="text-right">Beklenen TL</th>
              <th class="text-right">Ödenen/Alınan TL</th>
              <th class="text-right">Kâr HAS</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => {
              return `
              <tr>
                <td>${formatDate(t.date)}</td>
                <td>${getTransactionLabel(t.type)}</td>
                <td>${t.product_name || t.notes || '-'}</td>
                <td class="text-right">${t.quantity ? `${formatCurrency(t.quantity, t.unit === 'gram' ? 2 : 0)} ${t.unit}` : '-'}</td>
                <td class="text-right">${formatCurrency(t.has_value, 4)}</td>
                <td class="text-right">${t.has_price_tl ? formatCurrency(t.has_price_tl) + ' ₺' : '-'}</td>
                <td class="text-right">${t.expected_payment_tl ? formatCurrency(t.expected_payment_tl) + ' ₺' : '-'}</td>
                <td class="text-right">${t.received_payment_tl ? formatCurrency(t.received_payment_tl) + ' ₺' : '-'}</td>
                <td class="text-right ${(t.profit_has || 0) >= 0 ? 'positive' : 'negative'}">${t.profit_has ? formatCurrency(t.profit_has, 4) : '-'}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <div class="summary">
          <h3>Özet</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <label>Toplam Satış:</label>
              <span>${formatCurrency(summary.total_sales_has, 4)} HAS (${formatCurrency(summary.total_sales_tl)} ₺)</span>
            </div>
            <div class="summary-item">
              <label>Toplam Tahsilat:</label>
              <span>${formatCurrency(summary.total_receipts_has, 4)} HAS (${formatCurrency(summary.total_receipts_tl)} ₺)</span>
            </div>
            <div class="summary-item">
              <label>Toplam Kâr:</label>
              <span class="positive">${formatCurrency(summary.total_profit_has, 4)} HAS (${formatCurrency(summary.total_profit_tl)} ₺)</span>
            </div>
            <div class="summary-item">
              <label>Kalan Bakiye:</label>
              <span class="${(summary.final_balance_has || 0) >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(summary.final_balance_has, 4)} HAS (${formatCurrency(summary.final_balance_tl)} ₺)
              </span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Yazdırma Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
          <p>Bu rapor otomatik olarak oluşturulmuştur.</p>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const pagination = reportData?.pagination || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Cari Ekstre Raporu</h1>
            <p className="text-muted-foreground mt-1">Cari hesap hareketlerini görüntüleyin</p>
          </div>
        </div>
        {reportData && (
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Yazdır
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Cari Seçimi</Label>
              <SearchableSelect
                options={partyOptions}
                value={selectedParty}
                onChange={setSelectedParty}
                placeholder="🔍 Cari ara..."
                noOptionsMessage={() => 'Cari bulunamadı'}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Başlangıç
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Bitiş
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleFilter} disabled={loading || !selectedParty}>
              {loading ? 'Yükleniyor...' : 'Filtrele'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {reportData && (
        <>
          {/* Party Info Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Cari Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cari Adı</p>
                  <p className="text-lg font-semibold">{reportData.party?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cari Tipi</p>
                  <p className="text-lg font-semibold">
                    {reportData.party?.type === 'CUSTOMER' ? 'Müşteri' : 
                     reportData.party?.type === 'SUPPLIER' ? 'Tedarikçi' : reportData.party?.type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Güncel Bakiye (HAS)</p>
                  <p className={`text-lg font-semibold ${(reportData.party?.current_balance_has || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.party?.current_balance_has, 4)} HAS
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">TL Karşılığı</p>
                  <p className={`text-lg font-semibold ${(reportData.party?.current_balance_tl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.party?.current_balance_tl)} ₺
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Hareket Listesi</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sayfa başı:</span>
                  <Select value={perPage.toString()} onValueChange={(v) => { setPerPage(parseInt(v)); setPage(1); }}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reportData.transactions?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Bu tarih aralığında hareket bulunamadı.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="py-3 px-4 text-left font-semibold">Tarih</th>
                        <th className="py-3 px-4 text-left font-semibold">İşlem</th>
                        <th className="py-3 px-4 text-left font-semibold">Ürün/Detay</th>
                        <th className="py-3 px-4 text-right font-semibold">Miktar</th>
                        <th className="py-3 px-4 text-right font-semibold">HAS Değer</th>
                        <th className="py-3 px-4 text-right font-semibold">HAS Fiyatı</th>
                        <th className="py-3 px-4 text-right font-semibold">Beklenen TL</th>
                        <th className="py-3 px-4 text-right font-semibold">Ödenen/Alınan TL</th>
                        <th className="py-3 px-4 text-right font-semibold">Kâr HAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.transactions?.map((t, idx) => {
                        return (
                          <tr key={t.id || idx} className="border-b hover:bg-muted/30">
                            <td className="py-3 px-4">{formatDate(t.date)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {getTransactionIcon(t.type)}
                                <span>{getTransactionLabel(t.type)}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-[200px] truncate" title={t.product_name || t.notes}>
                              {t.product_name || t.notes || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {t.quantity ? `${formatCurrency(t.quantity, t.unit === 'gram' ? 2 : 0)} ${t.unit}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-primary">
                              {formatCurrency(t.has_value, 4)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-amber-600">
                              {t.has_price_tl ? `${formatCurrency(t.has_price_tl)} ₺` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {t.expected_payment_tl ? `${formatCurrency(t.expected_payment_tl)} ₺` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {t.received_payment_tl ? `${formatCurrency(t.received_payment_tl)} ₺` : '-'}
                            </td>
                            <td className={`py-3 px-4 text-right font-mono ${(t.profit_has || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {t.profit_has !== null && t.profit_has !== undefined ? formatCurrency(t.profit_has, 4) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Toplam {pagination.total_records} kayıt
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Önceki
                    </Button>
                    <span className="text-sm px-3">
                      Sayfa {page} / {pagination.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.total_pages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Sonraki
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-blue-800 dark:text-blue-400">Özet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground">Toplam Satış</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(reportData.summary?.total_sales_has, 4)} HAS</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(reportData.summary?.total_sales_tl)} ₺</p>
                </div>
                <div className="p-4 bg-white dark:bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground">Toplam Tahsilat</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(reportData.summary?.total_receipts_has, 4)} HAS</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(reportData.summary?.total_receipts_tl)} ₺</p>
                </div>
                <div className="p-4 bg-white dark:bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground">Toplam Kâr</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(reportData.summary?.total_profit_has, 4)} HAS</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(reportData.summary?.total_profit_tl)} ₺</p>
                </div>
                <div className="p-4 bg-white dark:bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground">Kalan Bakiye</p>
                  <p className={`text-xl font-bold ${(reportData.summary?.final_balance_has || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData.summary?.final_balance_has, 4)} HAS
                  </p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(reportData.summary?.final_balance_tl)} ₺</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AccountStatementPage;
