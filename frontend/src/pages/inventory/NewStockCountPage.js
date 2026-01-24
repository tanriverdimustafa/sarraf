import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ClipboardList, Barcode, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

export default function NewStockCountPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('BARCODE');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await api.post('/api/stock-counts', { type, notes });
      
      toast.success(response.data.message || 'Sayım başlatıldı');
      
      // Navigate to appropriate page based on type
      const countId = response.data.id;
      if (type === 'MANUAL') {
        navigate(`/inventory/stock-counts/${countId}/manual`);
      } else {
        navigate(`/inventory/stock-counts/${countId}/barcode`);
      }
    } catch (error) {
      console.error('Error creating stock count:', error);
      toast.error(error.response?.data?.detail || 'Sayım başlatılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/stock-counts')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yeni Sayım Başlat</h1>
          <p className="text-muted-foreground">Sayım tipini seçin ve başlatın</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Sayım Tipi</CardTitle>
            <CardDescription>Hangi yöntemle sayım yapacağınızı seçin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('MANUAL')}
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  type === 'MANUAL'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-border hover:border-amber-300'
                }`}
              >
                <ClipboardList className={`w-10 h-10 mb-3 ${type === 'MANUAL' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-lg">Manuel Sayım</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Yazdırılabilir liste ile elle sayım yapın. Bilezik tartımı ve sarrafiye adet sayımı için idealdir.
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => setType('BARCODE')}
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  type === 'BARCODE'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-border hover:border-blue-300'
                }`}
              >
                <Barcode className={`w-10 h-10 mb-3 ${type === 'BARCODE' ? 'text-blue-600' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-lg">Barkodlu Sayım</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Barkod okuyucu ile hızlı sayım yapın. Her ürün barkod okutularak otomatik sayılır.
                </p>
              </button>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Not (Opsiyonel)</Label>
              <Textarea
                id="notes"
                placeholder="Örn: Aylık rutin sayım, Yıl sonu envanter sayımı..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium mb-2">ℹ️ Sayım Başlatıldığında</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stokta bulunan tüm ürünler sayım listesine eklenir</li>
                <li>• Barkodlu ürünler tek tek, bilezik gram olarak, sarrafiye adet olarak sayılır</li>
                <li>• Sayım herhangi bir anda duraklatılabilir ve devam ettirilebilir</li>
                <li>• Tamamlandığında detaylı rapor oluşturulur</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/inventory/stock-counts')}>
                İptal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sayımı Başlat
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
