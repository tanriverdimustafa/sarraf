import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Package, CheckCircle, Clock, AlertTriangle, Search, Pause, Play, 
  ArrowLeft, Volume2, VolumeX, Barcode
} from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

// Audio beep functions using Web Audio API
const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;

const playBeep = (frequency, duration, type = 'success') => {
  if (!audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.error('Audio error:', e);
  }
};

const sounds = {
  success: () => playBeep(880, 0.15), // High tone, short
  warning: () => { playBeep(660, 0.1); setTimeout(() => playBeep(660, 0.1), 150); }, // Double beep
  error: () => playBeep(330, 0.4) // Low tone, long
};

export default function BarcodeCountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const barcodeInputRef = useRef(null);
  
  const [count, setCount] = useState(null);
  const [items, setItems] = useState({ counted: [], uncounted: [], notFound: [] });
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScanned, setLastScanned] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  // Keep focus on barcode input
  useEffect(() => {
    if (count?.status === 'IN_PROGRESS') {
      const interval = setInterval(() => {
        if (document.activeElement !== barcodeInputRef.current) {
          barcodeInputRef.current?.focus();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [count?.status]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [countRes, itemsRes] = await Promise.all([
        api.get(`/api/stock-counts/${id}`),
        api.get(`/api/stock-counts/${id}/items?per_page=500`)
      ]);
      setCount(countRes.data);
      
      const allItems = itemsRes.data.items || [];
      setItems({
        counted: allItems.filter(i => i.is_counted && i.category !== 'NOT_FOUND'),
        uncounted: allItems.filter(i => !i.is_counted && i.category !== 'NOT_FOUND'),
        notFound: allItems.filter(i => i.category === 'NOT_FOUND')
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Sayım verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode || scanning) return;

    setScanning(true);
    setBarcodeInput('');

    try {
      const response = await api.post(`/api/stock-counts/${id}/scan`, { barcode });
      
      if (response.data.success) {
        if (soundEnabled) sounds.success();
        setLastScanned({ type: 'success', message: response.data.message, item: response.data.item });
        toast.success(response.data.message);
      } else if (response.data.error === 'ALREADY_COUNTED') {
        if (soundEnabled) sounds.warning();
        setLastScanned({ type: 'warning', message: response.data.message, item: response.data.item });
        toast.warning(response.data.message);
      } else {
        if (soundEnabled) sounds.error();
        setLastScanned({ type: 'error', message: response.data.message, barcode });
        toast.error(response.data.message);
      }
      
      fetchData();
    } catch (error) {
      if (soundEnabled) sounds.error();
      const message = error.response?.data?.detail || 'Barkod okutma hatası';
      setLastScanned({ type: 'error', message, barcode });
      toast.error(message);
    } finally {
      setScanning(false);
      barcodeInputRef.current?.focus();
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

  const stats = {
    total: count?.total_items || 0,
    counted: count?.counted_items || 0,
    remaining: (count?.total_items || 0) - (count?.counted_items || 0),
    notFound: items.notFound?.length || 0
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0;

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
            <h1 className="text-2xl font-bold text-foreground">Barkodlu Sayım</h1>
            <p className="text-muted-foreground font-mono">{id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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

      {/* Barcode Scanner Input */}
      <Card className="border-2 border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Search className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">🔍 BARKOD OKUT</h3>
              <form onSubmit={handleBarcodeScan}>
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Barkod okutun veya yazın..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  disabled={count?.status !== 'IN_PROGRESS'}
                  className="text-lg h-12 font-mono"
                  autoFocus
                />
              </form>
            </div>
          </div>
          
          {/* Last Scanned */}
          {lastScanned && (
            <div className={`mt-4 p-3 rounded-lg border ${
              lastScanned.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950/30' :
              lastScanned.type === 'warning' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30' :
              'bg-red-50 border-red-200 dark:bg-red-950/30'
            }`}>
              <p className={`font-medium ${
                lastScanned.type === 'success' ? 'text-green-700 dark:text-green-400' :
                lastScanned.type === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
                'text-red-700 dark:text-red-400'
              }`}>
                {lastScanned.message}
              </p>
              {lastScanned.item && (
                <p className="text-sm text-muted-foreground mt-1">
                  {lastScanned.item.product_name} - {lastScanned.item.karat} - {lastScanned.item.system_weight_gram?.toFixed(2)} gr
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam</p>
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
                <p className="text-xs text-muted-foreground">%{progressPercent}</p>
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
                <p className="text-sm text-muted-foreground">Bulunamadı</p>
                <p className="text-2xl font-bold">{stats.notFound}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">İlerleme</span>
          <span className="font-medium">%{progressPercent} ({stats.counted}/{stats.total})</span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Items Tabs */}
      <Tabs defaultValue="counted" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="counted">
            Sayılan Ürünler ({items.counted?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="uncounted">
            Sayılmayan Ürünler ({items.uncounted?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notfound">
            Bulunamayan Barkodlar ({items.notFound?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Counted Items */}
        <TabsContent value="counted">
          <Card>
            <CardContent className="pt-6">
              {items.counted?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Henüz sayılan ürün yok</p>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">#</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Tipi</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ayar</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Gram</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">HAS</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Sayım Zamanı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.counted.map((item, idx) => (
                        <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-2 px-3 text-sm">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono text-sm">{item.barcode}</td>
                          <td className="py-2 px-3 text-sm">{item.product_name}</td>
                          <td className="py-2 px-3 text-sm">{item.product_type}</td>
                          <td className="py-2 px-3 text-sm">{item.karat}</td>
                          <td className="py-2 px-3 text-sm">{item.system_weight_gram?.toFixed(2)}</td>
                          <td className="py-2 px-3 text-sm">{item.system_has?.toFixed(2)}</td>
                          <td className="py-2 px-3 text-sm text-muted-foreground">
                            {item.counted_at ? new Date(item.counted_at).toLocaleTimeString('tr-TR') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Uncounted Items */}
        <TabsContent value="uncounted">
          <Card>
            <CardContent className="pt-6">
              {items.uncounted?.length === 0 ? (
                <p className="text-center py-8 text-green-600 font-medium">🎉 Tüm ürünler sayıldı!</p>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Adı</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ürün Tipi</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Ayar</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Gram</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">HAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.uncounted.map((item) => (
                        <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-2 px-3 font-mono text-sm">{item.barcode}</td>
                          <td className="py-2 px-3 text-sm">{item.product_name}</td>
                          <td className="py-2 px-3 text-sm">{item.product_type}</td>
                          <td className="py-2 px-3 text-sm">{item.karat}</td>
                          <td className="py-2 px-3 text-sm">{item.system_weight_gram?.toFixed(2)}</td>
                          <td className="py-2 px-3 text-sm">{item.system_has?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Not Found Items */}
        <TabsContent value="notfound">
          <Card>
            <CardContent className="pt-6">
              {items.notFound?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Bilinmeyen barkod yok</p>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Barkod</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Okutma Zamanı</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.notFound.map((item) => (
                        <tr key={item.id} className="border-b border-border hover:bg-red-50 dark:hover:bg-red-950/20">
                          <td className="py-2 px-3 font-mono text-sm text-red-600">{item.barcode}</td>
                          <td className="py-2 px-3 text-sm text-muted-foreground">
                            {item.scanned_at ? new Date(item.scanned_at).toLocaleString('tr-TR') : '-'}
                          </td>
                          <td className="py-2 px-3 text-sm text-muted-foreground">Sistemde yok</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
