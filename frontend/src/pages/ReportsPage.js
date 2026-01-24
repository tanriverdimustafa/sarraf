import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart3 } from 'lucide-react';

const ReportsPage = () => {
  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-4xl font-serif font-medium text-foreground">Raporlar</h1>
        <p className="text-muted-foreground mt-1">Kar/Zarar analizi ve detaylı raporlar</p>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="font-serif">Raporlama Modülü</CardTitle>
              <CardDescription>Yakında eklenecek</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Günlük işlem raporları</p>
            <p>• Toplam HAS ALTIN giriş/çıkış</p>
            <p>• Net kar/zarar (HAS ALTIN cinsinden)</p>
            <p>• Döviz kar/zarar analizi</p>
            <p>• Stok durum raporları</p>
            <p>• Müşteri/Tedarikçi bakiye raporları</p>
            <p>• Tarih aralığı filtreleme</p>
            <p>• Excel/PDF çıktı alma</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;