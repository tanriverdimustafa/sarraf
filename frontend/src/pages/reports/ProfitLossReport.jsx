import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { TrendingUp, TrendingDown, Scale, Loader2, Calendar, RefreshCw } from 'lucide-react';
import { reportService } from '../../services';

const ProfitLossReport = () => {
  // Get first day of current month and today
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(formatDate(firstDayOfMonth));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      setError('Lütfen tarih aralığı seçin');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const data = await reportService.getProfitLoss(startDate, endDate);
      setReportData(data);
    } catch (err) {
      console.error('Rapor yüklenemedi:', err);
      setError('Rapor yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []); // Load on mount

  // Format TL currency
  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  // Format HAS value
  const formatHAS = (value) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'decimal',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(value || 0);
  };

  return (
    <div className="space-y-6" data-testid="profit-loss-report">
      {/* Başlık ve Filtreler */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-serif font-medium text-foreground">Kar/Zarar Raporu</h1>
          <p className="text-muted-foreground mt-1">Dönemsel gelir-gider analizi</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <span className="text-muted-foreground">-</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button onClick={fetchReport} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Filtrele
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !reportData && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {reportData && (
        <>
          {/* ÖZET KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Toplam Gelir */}
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  Toplam Gelir
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatTL(reportData.summary.total_revenue_tl)} ₺
                </div>
                <div className="text-lg text-green-500 dark:text-green-500">
                  {formatHAS(reportData.summary.total_revenue_has)} HAS
                </div>
              </CardContent>
            </Card>

            {/* Toplam Gider */}
            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5" />
                  Toplam Gider
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatTL(reportData.summary.total_expense_tl)} ₺
                </div>
                <div className="text-lg text-red-500 dark:text-red-500">
                  {formatHAS(reportData.summary.total_expense_has)} HAS
                </div>
              </CardContent>
            </Card>

            {/* Net Kar/Zarar */}
            <Card className={`${reportData.summary.net_profit_tl >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`flex items-center gap-2 text-lg ${reportData.summary.net_profit_tl >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                  <Scale className="h-5 w-5" />
                  Net {reportData.summary.net_profit_tl >= 0 ? 'Kar' : 'Zarar'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${reportData.summary.net_profit_tl >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {reportData.summary.net_profit_tl >= 0 ? '+' : ''}{formatTL(reportData.summary.net_profit_tl)} ₺
                </div>
                <div className={`text-lg ${reportData.summary.net_profit_has >= 0 ? 'text-blue-500 dark:text-blue-500' : 'text-orange-500 dark:text-orange-500'}`}>
                  {reportData.summary.net_profit_has >= 0 ? '+' : ''}{formatHAS(reportData.summary.net_profit_has)} HAS
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GELİR DETAYLARI */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Gelirler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Kategori</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">TL Tutarı</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">HAS Tutarı</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">İşlem Sayısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Satışlar</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400 font-medium">{formatTL(reportData.revenues.sales.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400">{formatHAS(reportData.revenues.sales.has)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.revenues.sales.count}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Tahsilatlar</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400 font-medium">{formatTL(reportData.revenues.receipts?.tl || 0)} ₺</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400">{formatHAS(reportData.revenues.receipts?.has || 0)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.revenues.receipts?.count || 0}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Alış Karları</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400 font-medium">{formatTL(reportData.revenues.purchase_profit?.tl || 0)} ₺</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400">{formatHAS(reportData.revenues.purchase_profit?.has || 0)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.revenues.purchase_profit?.count || 0}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Ödeme İskontoları</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400 font-medium">{formatTL(reportData.revenues.payment_discount?.tl || 0)} ₺</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400">{formatHAS(reportData.revenues.payment_discount?.has || 0)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.revenues.payment_discount?.count || 0}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Döviz Karları</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400 font-medium">{formatTL(reportData.revenues.exchange_profit.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-green-600 dark:text-green-400">{formatHAS(reportData.revenues.exchange_profit.has)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.revenues.exchange_profit.count}</td>
                    </tr>
                    <tr className="font-bold bg-green-100 dark:bg-green-950/40">
                      <td className="py-3 px-2">TOPLAM GELİR</td>
                      <td className="text-right py-3 px-2 text-green-700 dark:text-green-400">{formatTL(reportData.revenues.total.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-green-700 dark:text-green-400">{formatHAS(reportData.revenues.total.has)} HAS</td>
                      <td className="text-right py-3 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* GİDER DETAYLARI */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Giderler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Kategori</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">TL Tutarı</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">HAS Tutarı</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">İşlem Sayısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Satılan Ürün Maliyeti (COGS)</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400 font-medium">{formatTL(reportData.expenses.cogs?.tl || 0)} ₺</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400">{formatHAS(reportData.expenses.cogs?.has || 0)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.expenses.cogs?.count || 0}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">İşletme Giderleri</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400 font-medium">{formatTL(reportData.expenses.operating_expenses.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400">{formatHAS(reportData.expenses.operating_expenses.has)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.expenses.operating_expenses.count}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Maaşlar</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400 font-medium">{formatTL(reportData.expenses.salaries.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400">{formatHAS(reportData.expenses.salaries.has)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.expenses.salaries.count}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Alış Zararları</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400 font-medium">{formatTL(reportData.expenses.purchase_loss.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400">{formatHAS(reportData.expenses.purchase_loss.has)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.expenses.purchase_loss.count}</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-2">Döviz Zararları</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400 font-medium">{formatTL(reportData.expenses.exchange_loss.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-red-600 dark:text-red-400">{formatHAS(reportData.expenses.exchange_loss.has)} HAS</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{reportData.expenses.exchange_loss.count}</td>
                    </tr>
                    <tr className="font-bold bg-red-100 dark:bg-red-950/40">
                      <td className="py-3 px-2">TOPLAM GİDER</td>
                      <td className="text-right py-3 px-2 text-red-700 dark:text-red-400">{formatTL(reportData.expenses.total.tl)} ₺</td>
                      <td className="text-right py-3 px-2 text-red-700 dark:text-red-400">{formatHAS(reportData.expenses.total.has)} HAS</td>
                      <td className="text-right py-3 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* NET KAR/ZARAR ÖZET */}
          <Card className={`border-2 ${reportData.summary.net_profit_tl >= 0 ? 'bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700' : 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700'}`}>
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <Scale className={`h-8 w-8 ${reportData.summary.net_profit_tl >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`} />
                  <span className="text-xl font-bold">NET KAR/ZARAR</span>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${reportData.summary.net_profit_tl >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {reportData.summary.net_profit_tl >= 0 ? '+' : ''}{formatTL(reportData.summary.net_profit_tl)} ₺
                  </div>
                  <div className={`text-xl ${reportData.summary.net_profit_has >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    {reportData.summary.net_profit_has >= 0 ? '+' : ''}{formatHAS(reportData.summary.net_profit_has)} HAS
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STOK BİLGİSİ (Bilgi Amaçlı) */}
          {reportData.stock_info && (reportData.stock_info.purchases?.count > 0 || reportData.stock_info.sales_has > 0) && (
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                  📦 Dönem İçi Stok Hareketleri (Bilgi Amaçlı)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Dönem İçi Alışlar:</p>
                    <p className="font-medium">{formatTL(reportData.stock_info.purchases?.tl || 0)} ₺ / {formatHAS(reportData.stock_info.purchases?.has || 0)} HAS</p>
                    <p className="text-xs text-muted-foreground">({reportData.stock_info.purchases?.count || 0} işlem)</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dönem İçi Satılan HAS:</p>
                    <p className="font-medium">{formatHAS(reportData.stock_info.sales_has || 0)} HAS</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-3">
                  ⚠️ Alışlar stok girişidir, gider değildir. Sadece satılan ürünlerin maliyeti (COGS) gider olarak sayılır.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Dönem Bilgisi */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Rapor Dönemi: {new Date(reportData.period.start_date).toLocaleDateString('tr-TR')} - {new Date(reportData.period.end_date).toLocaleDateString('tr-TR')}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfitLossReport;
