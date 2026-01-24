import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Package, CheckCircle, AlertTriangle, XCircle, ArrowLeft, 
  FileText, Download, Printer, Clock
} from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

export default function StockCountReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/stock-counts/${id}/report`);
      setReport(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Rapor bulunamadı</p>
      </div>
    );
  }

  const { count, summary, by_category, differences, uncounted, not_found } = report;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/stock-counts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sayım Raporu</h1>
            <p className="text-muted-foreground font-mono">{id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Yazdır
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">STOK SAYIM RAPORU</h1>
        <p className="text-sm">Sayım No: {id}</p>
        <p className="text-sm">Tarih: {count?.started_at ? new Date(count.started_at).toLocaleDateString('tr-TR') : '-'}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <Card>
          <CardContent className="pt-6 print:pt-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950 print:p-2">
                <Package className="w-6 h-6 text-blue-600 print:w-4 print:h-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam</p>
                <p className="text-2xl font-bold print:text-xl">{summary.total_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 print:pt-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950 print:p-2">
                <CheckCircle className="w-6 h-6 text-green-600 print:w-4 print:h-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sayılan</p>
                <p className="text-2xl font-bold print:text-xl">{summary.counted_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 print:pt-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950 print:p-2">
                <CheckCircle className="w-6 h-6 text-green-600 print:w-4 print:h-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Eşleşen</p>
                <p className="text-2xl font-bold print:text-xl">{summary.matched_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={summary.mismatched_items > 0 ? 'border-red-300' : ''}>
          <CardContent className="pt-6 print:pt-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-950 print:p-2">
                <AlertTriangle className="w-6 h-6 text-red-600 print:w-4 print:h-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fark Var</p>
                <p className="text-2xl font-bold print:text-xl text-red-600">{summary.mismatched_items}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Summary */}
      <div className="grid grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Barkodlu Ürünler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam:</span>
                <span className="font-medium">{by_category?.barcode?.total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sayılan:</span>
                <span className="font-medium">{by_category?.barcode?.counted || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Eşleşen:</span>
                <span className="font-medium text-green-600">{by_category?.barcode?.matched || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bilezik Havuz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam:</span>
                <span className="font-medium">{by_category?.pool?.total || 0} kalem</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sistem Gram:</span>
                <span className="font-medium">{by_category?.pool?.total_system_weight?.toFixed(2) || 0} gr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sayılan Gram:</span>
                <span className="font-medium">{by_category?.pool?.total_counted_weight?.toFixed(2) || 0} gr</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sarrafiye</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toplam:</span>
                <span className="font-medium">{by_category?.piece?.total || 0} kalem</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sistem Adet:</span>
                <span className="font-medium">{by_category?.piece?.total_system_quantity || 0} adet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sayılan Adet:</span>
                <span className="font-medium">{by_category?.piece?.total_counted_quantity || 0} adet</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Differences */}
      {differences && differences.length > 0 && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Fark Listesi ({differences.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sistem</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sayılan</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Fark</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-muted-foreground">Durum</th>
                </tr>
              </thead>
              <tbody>
                {differences.map((item, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="py-2 px-3 text-sm">{item.product_name}</td>
                    <td className="py-2 px-3 font-mono text-sm">{item.barcode || '-'}</td>
                    <td className="py-2 px-3 text-sm text-right">{item.system_value} {item.unit}</td>
                    <td className="py-2 px-3 text-sm text-right">{item.counted_value} {item.unit}</td>
                    <td className="py-2 px-3 text-sm text-right font-medium text-red-600">
                      {item.difference > 0 ? '+' : ''}{item.difference} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant="destructive">
                        {item.difference < 0 ? 'Eksik' : 'Fazla'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Uncounted Items */}
      {uncounted && uncounted.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Sayılmayan Ürünler ({summary.uncounted_items})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Kategori</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Gram</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">HAS</th>
                </tr>
              </thead>
              <tbody>
                {uncounted.slice(0, 20).map((item, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-sm">{item.barcode || '-'}</td>
                    <td className="py-2 px-3 text-sm">{item.product_name}</td>
                    <td className="py-2 px-3 text-sm">{item.category}</td>
                    <td className="py-2 px-3 text-sm text-right">{item.system_weight_gram?.toFixed(2) || '-'}</td>
                    <td className="py-2 px-3 text-sm text-right">{item.system_has?.toFixed(2) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {uncounted.length > 20 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                ... ve {uncounted.length - 20} ürün daha
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Not Found Items */}
      {not_found && not_found.length > 0 && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Bulunamayan Barkodlar ({not_found.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Okutma Zamanı</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Not</th>
                </tr>
              </thead>
              <tbody>
                {not_found.map((item, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-sm text-red-600">{item.barcode}</td>
                    <td className="py-2 px-3 text-sm text-muted-foreground">
                      {item.scanned_at ? new Date(item.scanned_at).toLocaleString('tr-TR') : '-'}
                    </td>
                    <td className="py-2 px-3 text-sm text-muted-foreground">Sistemde kayıtlı değil</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Print Signature Section */}
      <div className="hidden print:block mt-8 pt-8 border-t border-gray-300">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm">Sayan: _________________________</p>
            <p className="text-sm mt-4">İmza: _________________________</p>
          </div>
          <div>
            <p className="text-sm">Kontrol Eden: _________________________</p>
            <p className="text-sm mt-4">İmza: _________________________</p>
          </div>
        </div>
        <p className="text-sm mt-4">Tarih: ___/___/________ Saat: ___:___</p>
      </div>
    </div>
  );
}
