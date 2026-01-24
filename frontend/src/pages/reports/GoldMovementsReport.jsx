import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/ui/select';
import { ArrowDownRight, ArrowUpRight, Scale, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { reportService } from '../../services';

const GoldMovementsReport = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const formatDate = (date) => date.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDate(firstDayOfMonth));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [productType, setProductType] = useState('all');
  const [karat, setKarat] = useState('all');
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
      const filters = {};
      if (productType && productType !== 'all') filters.product_type = productType;
      if (karat && karat !== 'all') filters.karat = karat;

      const data = await reportService.getGoldMovements(startDate, endDate, filters);
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
  }, []);

  const formatNumber = (value, decimals = 2) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value || 0);
  };

  const formatTL = (value) => formatNumber(value, 2);
  const formatHAS = (value) => formatNumber(value, 4);
  const formatGram = (value) => formatNumber(value, 2);

  return (
    <div className="space-y-6" data-testid="gold-movements-report">
      {/* Başlık ve Filtreler */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-serif font-medium text-foreground">Altın Hareketleri Raporu</h1>
          <p className="text-muted-foreground mt-1">Dönemsel altın giriş/çıkış analizi</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background"
            />
          </div>
          <span className="text-muted-foreground">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-input rounded-md px-3 py-2 text-sm bg-background"
          />
          
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Ürün Tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Ürünler</SelectItem>
              <SelectItem value="hurda">Hurda</SelectItem>
              <SelectItem value="gram altın">Gram Altın</SelectItem>
              <SelectItem value="çeyrek">Çeyrek</SelectItem>
              <SelectItem value="yarım">Yarım</SelectItem>
              <SelectItem value="tam altın">Tam Altın</SelectItem>
              <SelectItem value="bilezik">Bilezik</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={karat} onValueChange={setKarat}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Ayar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Ayarlar</SelectItem>
              <SelectItem value="24K">24K</SelectItem>
              <SelectItem value="22K">22K</SelectItem>
              <SelectItem value="18K">18K</SelectItem>
              <SelectItem value="14K">14K</SelectItem>
              <SelectItem value="8K">8K</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={fetchReport} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Filtrele
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && !reportData && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {reportData && (
        <>
          {/* ÖZET KARTLAR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Toplam Çıkış */}
            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2 text-lg">
                  <ArrowUpRight className="h-5 w-5" />
                  Toplam Çıkış
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatGram(reportData.summary.total_out_gram)} gr
                </div>
                <div className="text-lg text-red-500">
                  {formatHAS(reportData.summary.total_out_has)} HAS
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Satış: {formatGram(reportData.sales.totals.gram)} gr<br/>
                  Ödeme: {formatGram(reportData.scrap_payments.totals.gram)} gr
                </div>
              </CardContent>
            </Card>

            {/* Toplam Giriş */}
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2 text-lg">
                  <ArrowDownRight className="h-5 w-5" />
                  Toplam Giriş
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatGram(reportData.summary.total_in_gram)} gr
                </div>
                <div className="text-lg text-green-500">
                  {formatHAS(reportData.summary.total_in_has)} HAS
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Alış: {formatGram(reportData.purchases.totals.gram)} gr
                </div>
              </CardContent>
            </Card>

            {/* Net Hareket */}
            <Card className={`${reportData.summary.net_gram >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`flex items-center gap-2 text-lg ${reportData.summary.net_gram >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                  <Scale className="h-5 w-5" />
                  Net Hareket
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${reportData.summary.net_gram >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {reportData.summary.net_gram >= 0 ? '+' : ''}{formatGram(reportData.summary.net_gram)} gr
                </div>
                <div className={`text-lg ${reportData.summary.net_has >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                  {reportData.summary.net_has >= 0 ? '+' : ''}{formatHAS(reportData.summary.net_has)} HAS
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {reportData.summary.net_gram >= 0 ? '(Stok artışı)' : '(Stok azalışı)'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SATIŞ HAREKETLERİ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" />
                Satış Hareketleri (Çıkış)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.sales.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Bu dönemde satış yapılmamış</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ürün Tipi</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ayar</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Gram</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">HAS</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Peşin TL</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Veresiye TL</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.sales.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-2">{item.product_type}</td>
                          <td className="py-3 px-2">{item.karat}</td>
                          <td className="text-right py-3 px-2 font-medium">{formatGram(item.total_gram)} gr</td>
                          <td className="text-right py-3 px-2">{formatHAS(item.total_has)}</td>
                          <td className="text-right py-3 px-2 text-green-600">{formatTL(item.cash_amount)} ₺</td>
                          <td className="text-right py-3 px-2 text-orange-600">{formatTL(item.credit_amount)} ₺</td>
                          <td className="text-right py-3 px-2 text-muted-foreground">{item.transaction_count}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-red-100 dark:bg-red-950/40">
                        <td className="py-3 px-2" colSpan="2">TOPLAM</td>
                        <td className="text-right py-3 px-2">{formatGram(reportData.sales.totals.gram)} gr</td>
                        <td className="text-right py-3 px-2">{formatHAS(reportData.sales.totals.has)}</td>
                        <td className="text-right py-3 px-2 text-green-700">{formatTL(reportData.sales.totals.cash)} ₺</td>
                        <td className="text-right py-3 px-2 text-orange-700">{formatTL(reportData.sales.totals.credit)} ₺</td>
                        <td className="text-right py-3 px-2">{reportData.sales.totals.count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ALIŞ HAREKETLERİ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5" />
                Alış Hareketleri (Giriş)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.purchases.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Bu dönemde alış yapılmamış</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ürün Tipi</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ayar</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Gram</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">HAS</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Ödenen TL</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Borç TL</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.purchases.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-2">{item.product_type}</td>
                          <td className="py-3 px-2">{item.karat}</td>
                          <td className="text-right py-3 px-2 font-medium">{formatGram(item.total_gram)} gr</td>
                          <td className="text-right py-3 px-2">{formatHAS(item.total_has)}</td>
                          <td className="text-right py-3 px-2 text-green-600">{formatTL(item.paid_amount)} ₺</td>
                          <td className="text-right py-3 px-2 text-red-600">{formatTL(item.debt_amount)} ₺</td>
                          <td className="text-right py-3 px-2 text-muted-foreground">{item.transaction_count}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-green-100 dark:bg-green-950/40">
                        <td className="py-3 px-2" colSpan="2">TOPLAM</td>
                        <td className="text-right py-3 px-2">{formatGram(reportData.purchases.totals.gram)} gr</td>
                        <td className="text-right py-3 px-2">{formatHAS(reportData.purchases.totals.has)}</td>
                        <td className="text-right py-3 px-2 text-green-700">{formatTL(reportData.purchases.totals.paid)} ₺</td>
                        <td className="text-right py-3 px-2 text-red-700">{formatTL(reportData.purchases.totals.debt)} ₺</td>
                        <td className="text-right py-3 px-2">{reportData.purchases.totals.count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* HURDA ÖDEMELERİ */}
          {reportData.scrap_payments.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5" />
                  Hurda Ödemeleri (Çıkış)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ürün Tipi</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ayar</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Gram</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">HAS</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">TL Karşılığı</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.scrap_payments.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-2">{item.product_type}</td>
                          <td className="py-3 px-2">{item.karat}</td>
                          <td className="text-right py-3 px-2 font-medium">{formatGram(item.total_gram)} gr</td>
                          <td className="text-right py-3 px-2">{formatHAS(item.total_has)}</td>
                          <td className="text-right py-3 px-2">{formatTL(item.tl_value)} ₺</td>
                          <td className="text-right py-3 px-2 text-muted-foreground">{item.transaction_count}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-amber-100 dark:bg-amber-950/40">
                        <td className="py-3 px-2" colSpan="2">TOPLAM</td>
                        <td className="text-right py-3 px-2">{formatGram(reportData.scrap_payments.totals.gram)} gr</td>
                        <td className="text-right py-3 px-2">{formatHAS(reportData.scrap_payments.totals.has)}</td>
                        <td className="text-right py-3 px-2">{formatTL(reportData.scrap_payments.totals.tl_value)} ₺</td>
                        <td className="text-right py-3 px-2">{reportData.scrap_payments.totals.count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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

export default GoldMovementsReport;
