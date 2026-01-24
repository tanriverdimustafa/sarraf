import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Package, Plus, ClipboardList, Barcode, Calendar, User, ArrowRight, Trash2, Play, Eye } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PAUSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const statusLabels = {
  DRAFT: 'Taslak',
  IN_PROGRESS: 'Devam Ediyor',
  PAUSED: 'Duraklatıldı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi'
};

const typeLabels = {
  MANUAL: 'Manuel',
  BARCODE: 'Barkodlu'
};

export default function StockCountsPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 });

  useEffect(() => {
    fetchCounts();
  }, [pagination.page]);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/stock-counts?page=${pagination.page}&per_page=10`);
      setCounts(response.data.stock_counts || []);
      setPagination(response.data.pagination || { page: 1, total: 0, total_pages: 1 });
    } catch (error) {
      console.error('Error fetching stock counts:', error);
      toast.error('Sayımlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu sayımı silmek istediğinize emin misiniz?')) return;
    
    try {
      await api.delete(`/api/stock-counts/${id}`);
      toast.success('Sayım silindi');
      fetchCounts();
    } catch (error) {
      toast.error('Sayım silinemedi');
    }
  };

  const getActionButton = (count) => {
    if (count.status === 'IN_PROGRESS' || count.status === 'PAUSED') {
      const path = count.type === 'MANUAL' 
        ? `/inventory/stock-counts/${count.id}/manual`
        : `/inventory/stock-counts/${count.id}/barcode`;
      return (
        <Button size="sm" onClick={() => navigate(path)}>
          <Play className="w-4 h-4 mr-1" />
          Devam Et
        </Button>
      );
    }
    if (count.status === 'COMPLETED') {
      return (
        <Button size="sm" variant="outline" onClick={() => navigate(`/inventory/stock-counts/${count.id}/report`)}>
          <Eye className="w-4 h-4 mr-1" />
          Görüntüle
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stok Sayımı</h1>
          <p className="text-muted-foreground">Manuel ve barkodlu stok sayım işlemleri</p>
        </div>
        <Button onClick={() => navigate('/inventory/stock-counts/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Sayım Başlat
        </Button>
      </div>

      {/* Counts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Sayım Listesi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : counts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Henüz sayım bulunmuyor</p>
              <Button className="mt-4" onClick={() => navigate('/inventory/stock-counts/new')}>
                <Plus className="w-4 h-4 mr-2" />
                İlk Sayımı Başlat
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tip</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Durum</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Başlangıç</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">İlerleme</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Eşleşen</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fark</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((count) => (
                    <tr key={count.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-sm">{count.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {count.type === 'BARCODE' ? (
                            <Barcode className="w-4 h-4 text-blue-500" />
                          ) : (
                            <ClipboardList className="w-4 h-4 text-amber-500" />
                          )}
                          {typeLabels[count.type]}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[count.status]}>
                          {statusLabels[count.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {count.started_at ? new Date(count.started_at).toLocaleDateString('tr-TR') : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${(count.counted_items / Math.max(count.total_items, 1)) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {count.counted_items}/{count.total_items}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-green-600 font-medium">{count.matched_items}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${count.mismatched_items > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {count.mismatched_items}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {getActionButton(count)}
                          {count.status !== 'COMPLETED' && (
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(count.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Toplam {pagination.total} kayıt
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.total_pages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
