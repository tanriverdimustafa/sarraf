import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Package, CheckCircle, Clock, AlertTriangle, Printer, Pause, Play, 
  Check, ArrowLeft, Save, X, Filter 
} from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

export default function ManualCountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [count, setCount] = useState(null);
  const [items, setItems] = useState({ barcode: [], pool: [], piece: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, uncounted, counted, mismatched
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState('');
  const printRef = useRef();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [countRes, itemsRes] = await Promise.all([
        api.get(`/api/stock-counts/${id}`),
        api.get(`/api/stock-counts/${id}/items?per_page=500`)
      ]);
      setCount(countRes.data);
      setItems(itemsRes.data.grouped || { barcode: [], pool: [], piece: [] });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Sayım verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/api/stock-counts/${id}`, { status: newStatus });
      toast.success(newStatus === 'PAUSED' ? 'Sayım duraklatıldı' : newStatus === 'COMPLETED' ? 'Sayım tamamlandı' : 'Sayıma devam ediliyor');
      fetchData();
      if (newStatus === 'COMPLETED') {
        navigate(`/inventory/stock-counts/${id}/report`);
      }
    } catch (error) {
      toast.error('Durum güncellenemedi');
    }
  };

  const handleBarcodeItemCount = async (item) => {
    try {
      await api.put(`/api/stock-counts/${id}/items/${item.id}`, { counted_quantity: 1 });
      toast.success(`✅ ${item.product_name} sayıldı`);
      fetchData();
    } catch (error) {
      toast.error('Kayıt başarısız');
    }
  };

  const handlePoolOrPieceCount = async (item, value) => {
    try {
      const data = item.category === 'POOL' 
        ? { counted_weight_gram: parseFloat(value) }
        : { counted_quantity: parseFloat(value) };
      
      await api.put(`/api/stock-counts/${id}/items/${item.id}`, data);
      toast.success(`✅ ${item.product_name} kaydedildi`);
      setEditingItem(null);
      setEditValue('');
      fetchData();
    } catch (error) {
      toast.error('Kayıt başarısız');
    }
  };

  const handlePrint = () => {
    window.open(`/inventory/stock-counts/${id}/print`, '_blank');
  };

  const filterItems = (itemList) => {
    if (filter === 'all') return itemList;
    if (filter === 'uncounted') return itemList.filter(i => !i.is_counted);
    if (filter === 'counted') return itemList.filter(i => i.is_counted);
    if (filter === 'mismatched') return itemList.filter(i => i.is_matched === false);
    return itemList;
  };

  const stats = {
    total: (items.barcode?.length || 0) + (items.pool?.length || 0) + (items.piece?.length || 0),
    counted: count?.counted_items || 0,
    remaining: (count?.total_items || 0) - (count?.counted_items || 0),
    mismatched: count?.mismatched_items || 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/stock-counts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manuel Sayım</h1>
            <p className="text-muted-foreground font-mono">{id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Listeyi Yazdır
          </Button>
          {count?.status === 'IN_PROGRESS' && (
            <Button variant="outline" onClick={() => handleStatusChange('PAUSED')}>
              <Pause className="w-4 h-4 mr-2" />
              Duraklat
            </Button>
          )}
          {count?.status === 'PAUSED' && (
            <Button onClick={() => handleStatusChange('IN_PROGRESS')}>
              <Play className="w-4 h-4 mr-2" />
              Devam Et
            </Button>
          )}
          <Button onClick={() => handleStatusChange('COMPLETED')} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Tamamla
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam Ürün</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sayılan</p>
                <p className="text-2xl font-bold">{stats.counted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-950">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kalan</p>
                <p className="text-2xl font-bold">{stats.remaining}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fark Var</p>
                <p className="text-2xl font-bold">{stats.mismatched}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filtre:</span>
        {['all', 'uncounted', 'counted', 'mismatched'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tümü' : f === 'uncounted' ? 'Sayılmadı' : f === 'counted' ? 'Sayıldı' : 'Fark Var'}
          </Button>
        ))}
      </div>

      {/* Items Tabs */}
      <Tabs defaultValue="barcode" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="barcode">Barkodlu Ürünler ({items.barcode?.length || 0})</TabsTrigger>
          <TabsTrigger value="pool">Bilezik Havuz ({items.pool?.length || 0})</TabsTrigger>
          <TabsTrigger value="piece">Sarrafiye ({items.piece?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Barcode Items */}
        <TabsContent value="barcode">
          <Card>
            <CardContent className="pt-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">#</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Tipi</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ayar</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Gram</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Satış HAS</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-muted-foreground">Sayıldı</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filterItems(items.barcode || []).map((item, idx) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-2 px-3 text-sm">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono text-sm">{item.barcode}</td>
                      <td className="py-2 px-3 text-sm">{item.product_type}</td>
                      <td className="py-2 px-3 text-sm">{item.product_name}</td>
                      <td className="py-2 px-3 text-sm">{item.karat}</td>
                      <td className="py-2 px-3 text-sm">{item.system_weight_gram?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-sm">{item.system_has?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        {item.is_counted ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-muted-foreground/30 rounded mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {!item.is_counted && (
                          <Button size="sm" onClick={() => handleBarcodeItemCount(item)}>
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pool Items (Bilezik) */}
        <TabsContent value="pool">
          <Card>
            <CardContent className="pt-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Tipi</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ayar</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sistem Gram</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sayılan Gram</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Fark</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filterItems(items.pool || []).map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-2 px-3 text-sm">{item.product_type}</td>
                      <td className="py-2 px-3 text-sm">{item.product_name}</td>
                      <td className="py-2 px-3 text-sm">{item.karat}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium">{item.system_weight_gram?.toFixed(2)} gr</td>
                      <td className="py-2 px-3 text-right">
                        {editingItem === item.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 ml-auto"
                            autoFocus
                          />
                        ) : (
                          <span className={item.is_counted ? 'font-medium' : 'text-muted-foreground'}>
                            {item.is_counted ? `${item.counted_weight_gram?.toFixed(2)} gr` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {item.is_counted && (
                          <span className={`font-medium ${item.is_matched ? 'text-green-600' : 'text-red-600'}`}>
                            {item.difference_gram > 0 ? '+' : ''}{item.difference_gram?.toFixed(2)} gr
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {editingItem === item.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" onClick={() => handlePoolOrPieceCount(item, editValue)}>
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingItem(null); setEditValue(''); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => { setEditingItem(item.id); setEditValue(item.counted_weight_gram || ''); }}>
                            Kaydet
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Piece Items (Sarrafiye) */}
        <TabsContent value="piece">
          <Card>
            <CardContent className="pt-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Tipi</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ayar</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sistem Adet</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Sayılan Adet</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Fark</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filterItems(items.piece || []).map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-2 px-3 text-sm">{item.product_type}</td>
                      <td className="py-2 px-3 text-sm">{item.product_name}</td>
                      <td className="py-2 px-3 text-sm">{item.karat}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium">{item.system_quantity} adet</td>
                      <td className="py-2 px-3 text-right">
                        {editingItem === item.id ? (
                          <Input
                            type="number"
                            step="1"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 ml-auto"
                            autoFocus
                          />
                        ) : (
                          <span className={item.is_counted ? 'font-medium' : 'text-muted-foreground'}>
                            {item.is_counted ? `${item.counted_quantity} adet` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {item.is_counted && (
                          <span className={`font-medium ${item.is_matched ? 'text-green-600' : 'text-red-600'}`}>
                            {item.difference_quantity > 0 ? '+' : ''}{item.difference_quantity} adet
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {editingItem === item.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" onClick={() => handlePoolOrPieceCount(item, editValue)}>
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingItem(null); setEditValue(''); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => { setEditingItem(item.id); setEditValue(item.counted_quantity || ''); }}>
                            Kaydet
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
