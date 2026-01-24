import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Package, Coins, Scale, TrendingUp, BarChart3, Calendar, Printer, RefreshCw, History } from 'lucide-react';
import { toast } from 'sonner';

const StockReportPage = () => {
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState(null);
  const [hasPrice, setHasPrice] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showHistorical, setShowHistorical] = useState(false);

  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build URL with date filter if historical view is enabled
      let stockUrl = '/api/stock/summary';
      if (showHistorical && selectedDate) {
        stockUrl += `?date=${selectedDate}`;
      }
      
      const [stockRes, priceRes] = await Promise.all([
        api.get(stockUrl),
        api.get('/api/market-data/latest')
      ]);
      setStockData(stockRes.data);
      setHasPrice(priceRes.data?.has_gold_sell || 5900);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast.error('Stok verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [showHistorical, selectedDate]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  const formatNumber = (num, decimals = 2) => {
    return parseFloat(num || 0).toLocaleString('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatCurrency = (num) => {
    return parseFloat(num || 0).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₺';
  };

  const handlePrint = () => {
    const totalTLValue = (stockData?.grand_total?.total_has_value || 0) * (hasPrice || 5900);
    const dateStr = showHistorical ? selectedDate : new Date().toISOString().split('T')[0];
    const dateLabel = showHistorical ? `${selectedDate} tarihli stok` : 'Güncel stok';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stok Raporu - ${dateStr}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              padding: 20px;
              color: #333;
              font-size: 12px;
            }
            h1 { 
              text-align: center; 
              font-size: 24px;
              margin-bottom: 5px;
              color: #1a1a1a;
            }
            .subtitle {
              text-align: center;
              color: #666;
              margin-bottom: 20px;
              font-size: 14px;
            }
            .header-info { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 20px;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            .header-info span {
              font-size: 11px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .summary-card {
              border: 1px solid #ddd;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .summary-card .label {
              font-size: 10px;
              color: #666;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .summary-card .value {
              font-size: 20px;
              font-weight: bold;
              color: #1a1a1a;
            }
            .summary-card .unit {
              font-size: 10px;
              color: #888;
            }
            h3 { 
              font-size: 14px;
              margin: 20px 0 10px;
              padding-bottom: 5px;
              border-bottom: 2px solid #333;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px;
              font-size: 11px;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #333;
              color: white;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
            }
            td { 
              vertical-align: middle;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-mono { font-family: 'Consolas', monospace; }
            tbody tr:nth-child(even) { background-color: #f9f9f9; }
            tbody tr:hover { background-color: #f0f0f0; }
            .totals { 
              font-weight: bold; 
              background-color: #fff3cd !important;
              font-size: 12px;
            }
            .totals td {
              border-top: 2px solid #333;
            }
            .gold-badge {
              background: linear-gradient(135deg, #ffd700, #ffb700);
              color: #333;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #888;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>KUYUMCU - STOK RAPORU</h1>
          <p class="subtitle">${dateLabel}</p>
          
          <div class="header-info">
            <span><strong>Rapor Tarihi:</strong> ${dateStr}</span>
            <span><strong>HAS Fiyat:</strong> ${formatNumber(hasPrice)} ₺/gr</span>
            <span><strong>Yazdırma:</strong> ${new Date().toLocaleString('tr-TR')}</span>
          </div>
          
          <div class="summary-grid">
            <div class="summary-card">
              <div class="label">Toplam Ürün</div>
              <div class="value">${stockData?.grand_total?.total_products || 0}</div>
              <div class="unit">adet</div>
            </div>
            <div class="summary-card">
              <div class="label">Toplam Miktar</div>
              <div class="value">${formatNumber(stockData?.grand_total?.total_quantity || 0, 2)}</div>
              <div class="unit">adet/gram</div>
            </div>
            <div class="summary-card">
              <div class="label">Toplam Ağırlık</div>
              <div class="value">${formatNumber(stockData?.grand_total?.total_weight_gram || 0, 2)}</div>
              <div class="unit">gram</div>
            </div>
            <div class="summary-card">
              <div class="label">Toplam HAS</div>
              <div class="value">${formatNumber(stockData?.grand_total?.total_has_value || 0, 4)}</div>
              <div class="unit">gram</div>
            </div>
          </div>
          
          <div class="summary-card" style="text-align:center; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); margin-bottom: 20px;">
            <div class="label">TOPLAM DEĞER</div>
            <div class="value" style="color: #0369a1; font-size: 28px;">${formatCurrency(totalTLValue)}</div>
          </div>
          
          <h3>Ürün Tipine Göre Stok Detayı</h3>
          <table>
            <thead>
              <tr>
                <th>Ürün Tipi</th>
                <th class="text-center">Lot</th>
                <th class="text-right">Miktar</th>
                <th class="text-right">Ağırlık (gr)</th>
                <th class="text-right">Maliyet HAS</th>
                <th class="text-right">Satış HAS</th>
                <th class="text-right">TL Değeri</th>
              </tr>
            </thead>
            <tbody>
              ${(stockData?.summary_by_type || []).map(item => `
                <tr>
                  <td>
                    ${item.product_type_name}
                    ${item.is_gold_based ? '<span class="gold-badge">ALTIN</span>' : ''}
                  </td>
                  <td class="text-center font-mono">${item.count}</td>
                  <td class="text-right font-mono">${formatNumber(item.total_quantity, item.unit === 'GRAM' ? 2 : 0)} ${item.unit === 'GRAM' ? 'gr' : 'ad'}</td>
                  <td class="text-right font-mono">${formatNumber(item.total_weight_gram, 2)}</td>
                  <td class="text-right font-mono">${formatNumber(item.total_cost_has, 4)}</td>
                  <td class="text-right font-mono">${formatNumber(item.total_sale_has, 4)}</td>
                  <td class="text-right font-mono"><strong>${formatCurrency(item.total_cost_has * hasPrice)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="totals">
                <td>TOPLAM</td>
                <td class="text-center font-mono">${stockData?.grand_total?.total_products || 0}</td>
                <td class="text-right font-mono">${formatNumber(stockData?.grand_total?.total_quantity || 0, 2)}</td>
                <td class="text-right font-mono">${formatNumber(stockData?.grand_total?.total_weight_gram || 0, 2)}</td>
                <td class="text-right font-mono">${formatNumber(stockData?.grand_total?.total_has_value || 0, 4)}</td>
                <td class="text-right">-</td>
                <td class="text-right font-mono"><strong>${formatCurrency(totalTLValue)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          <div class="footer">
            <p>Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde oluşturulmuştur.</p>
          </div>
          
          <script>
            window.onload = function() { 
              setTimeout(function() { window.print(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleRefresh = () => {
    fetchStockData();
    toast.success('Stok verileri yenilendi');
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setShowHistorical(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  const totalTLValue = (stockData?.grand_total?.total_has_value || 0) * (hasPrice || 5900);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Stok Raporu
          </h1>
          <p className="text-muted-foreground">
            {stockData?.is_historical 
              ? `${selectedDate} tarihli stok durumu` 
              : 'Güncel stok durumu ve değeri'}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          HAS Fiyat: {formatNumber(hasPrice)} ₺/gr
        </Badge>
      </div>

      {/* Date Filter & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44"
              />
            </div>

            {/* Historical Toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="historical"
                checked={showHistorical}
                onCheckedChange={setShowHistorical}
              />
              <Label htmlFor="historical" className="flex items-center gap-1 cursor-pointer">
                <History className="w-4 h-4" />
                Tarihe göre stok
              </Label>
            </div>

            {/* Quick Buttons */}
            <Button variant="outline" size="sm" onClick={handleTodayClick}>
              Bugün
            </Button>

            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Yenile
            </Button>

            {/* Actions - Right Side */}
            <div className="ml-auto flex gap-2">
              <Button onClick={handlePrint} variant="default">
                <Printer className="w-4 h-4 mr-2" />
                Yazdır
              </Button>
            </div>
          </div>

          {stockData?.is_historical && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                <strong>{selectedDate}</strong> tarihindeki tahmini stok durumu gösteriliyor.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              Toplam Lot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stockData?.grand_total?.total_products || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">adet lot/parti</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              Toplam Miktar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stockData?.grand_total?.total_quantity, 2)}</div>
            <p className="text-xs text-muted-foreground mt-1">adet/gram</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Toplam Ağırlık
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(stockData?.grand_total?.total_weight_gram, 2)}</div>
            <p className="text-xs text-muted-foreground mt-1">gram toplam ağırlık</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Toplam HAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatNumber(stockData?.grand_total?.total_has_value, 4)}</div>
            <p className="text-xs text-muted-foreground mt-1">gram HAS değeri</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-1/10 to-chart-2/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              TL Değeri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-chart-1">{formatCurrency(totalTLValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">güncel piyasa değeri</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stok Durumu Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stockData?.status_breakdown || {}).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <Badge 
                  variant={status === 'Stokta' || status.includes('tarih') ? 'default' : status === 'Satıldı' ? 'secondary' : 'outline'}
                  className="px-3 py-1"
                >
                  {status}: {count}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail by Product Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ürün Tipine Göre Stok</CardTitle>
          <CardDescription>
            {stockData?.is_historical 
              ? `${selectedDate} tarihindeki tahmini stok` 
              : 'Stokta (IN_STOCK) durumundaki ürünler - kalan miktar bazlı'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockData?.summary_by_type?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Ürün Tipi</th>
                    <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Lot</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Miktar</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Ağırlık (gr)</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Maliyet HAS</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Satış HAS</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">TL Değeri</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.summary_by_type.map((item) => (
                    <tr key={item.product_type_id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{item.product_type_name}</span>
                          {item.is_gold_based && (
                            <Badge variant="outline" className="text-xs">Altın</Badge>
                          )}
                          {item.track_type === 'FIFO' && (
                            <Badge variant="secondary" className="text-xs">FIFO</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono">{item.count}</td>
                      <td className="p-3 text-right font-mono">
                        {formatNumber(item.total_quantity, item.unit === 'GRAM' ? 2 : 0)}
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.unit === 'GRAM' ? 'gr' : 'ad'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{formatNumber(item.total_weight_gram, 3)}</td>
                      <td className="p-3 text-right font-mono text-primary">{formatNumber(item.total_cost_has, 4)}</td>
                      <td className="p-3 text-right font-mono text-chart-1">{formatNumber(item.total_sale_has, 4)}</td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatCurrency(item.total_cost_has * hasPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3">TOPLAM</td>
                    <td className="p-3 text-center font-mono">{stockData.grand_total.total_products}</td>
                    <td className="p-3 text-right font-mono">{formatNumber(stockData.grand_total.total_quantity, 2)}</td>
                    <td className="p-3 text-right font-mono">{formatNumber(stockData.grand_total.total_weight_gram, 3)}</td>
                    <td className="p-3 text-right font-mono text-primary">{formatNumber(stockData.grand_total.total_has_value, 4)}</td>
                    <td className="p-3 text-right font-mono">-</td>
                    <td className="p-3 text-right font-mono text-chart-1">{formatCurrency(totalTLValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Stokta ürün bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockReportPage;
