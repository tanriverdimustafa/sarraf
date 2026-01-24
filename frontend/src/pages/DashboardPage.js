import React, { useEffect, useState } from 'react';
import { useMarketData } from '../contexts/MarketDataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Euro, Coins, Activity } from 'lucide-react';
import api from '../lib/api';

const DashboardPage = () => {
  const { marketData, connected } = useMarketData();
  const [latestData, setLatestData] = useState(null);

  useEffect(() => {
    // Fetch initial data from backend
    const fetchData = async () => {
      try {
        const response = await api.get('/api/market-data/latest');
        setLatestData(response.data);
      } catch (error) {
        console.error('Error fetching market data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Use WebSocket data if available, otherwise use latest data from API
  const displayData = marketData.timestamp ? marketData : (latestData || marketData);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '---';
    return parseFloat(price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('tr-TR');
  };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-medium text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Canlı piyasa verileri ve işlem özeti</p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${connected ? 'text-chart-1 animate-pulse' : 'text-muted-foreground'}`} />
          <Badge variant={connected ? "default" : "secondary"} className="font-mono">
            {connected ? 'CANLI' : 'BAĞLANTI BEKLENİYOR'}
          </Badge>
          {displayData.timestamp && (
            <span className="text-sm text-muted-foreground font-mono">
              {formatTime(displayData.timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Market Data Grid - ALIŞ = KIRMIZI (para çıkışı), SATIŞ = YEŞİL (para girişi) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Has Altın Alış - KIRMIZI */}
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20" data-testid="has-gold-buy-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold text-red-700 dark:text-red-400">HAS Altın ALIŞ</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Coins className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <CardDescription className="text-red-600/70">Gram başına alış fiyatı</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-red-600" data-testid="has-gold-buy-price">
                {formatPrice(displayData.has_gold_buy)}
              </span>
              <span className="text-sm text-red-500">₺</span>
            </div>
          </CardContent>
        </Card>

        {/* Has Altın Satış - YEŞİL */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20" data-testid="has-gold-sell-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold text-green-700 dark:text-green-400">HAS Altın SATIŞ</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Coins className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <CardDescription className="text-green-600/70">Gram başına satış fiyatı</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-green-600" data-testid="has-gold-sell-price">
                {formatPrice(displayData.has_gold_sell)}
              </span>
              <span className="text-sm text-green-500">₺</span>
            </div>
          </CardContent>
        </Card>

        {/* USD Alış - KIRMIZI */}
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20" data-testid="usd-buy-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold text-red-700 dark:text-red-400">USD ALIŞ</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <CardDescription className="text-red-600/70">Dolar alış kuru</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-red-600" data-testid="usd-buy-price">
                {formatPrice(displayData.usd_buy)}
              </span>
              <span className="text-sm text-red-500">₺</span>
            </div>
          </CardContent>
        </Card>

        {/* USD Satış - YEŞİL */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20" data-testid="usd-sell-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold text-green-700 dark:text-green-400">USD SATIŞ</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <CardDescription className="text-green-600/70">Dolar satış kuru</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-green-600" data-testid="usd-sell-price">
                {formatPrice(displayData.usd_sell)}
              </span>
              <span className="text-sm text-green-500">₺</span>
            </div>
          </CardContent>
        </Card>

        {/* EUR Alış - KIRMIZI */}
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20" data-testid="eur-buy-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold text-red-700 dark:text-red-400">EUR ALIŞ</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Euro className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <CardDescription className="text-red-600/70">Euro alış kuru</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-red-600" data-testid="eur-buy-price">
                {formatPrice(displayData.eur_buy)}
              </span>
              <span className="text-sm text-red-500">₺</span>
            </div>
          </CardContent>
        </Card>

        {/* EUR Satış - YEŞİL */}
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20" data-testid="eur-sell-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold text-green-700 dark:text-green-400">EUR SATIŞ</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Euro className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <CardDescription className="text-green-600/70">Euro satış kuru</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-green-600" data-testid="eur-sell-price">
                {formatPrice(displayData.eur_sell)}
              </span>
              <span className="text-sm text-green-500">₺</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-card/50">
        <CardHeader>
          <CardTitle className="font-serif">Hoş Geldiniz</CardTitle>
          <CardDescription>
            Kuyumcu yönetim sisteminize hoş geldiniz. Yukarıda gerçek zamanlı piyasa verilerini görebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Tüm işlemler HAS ALTIN cinsinden kaydedilir</p>
            <p>• Piyasa verileri otomatik olarak güncellenir</p>
            <p>• Sonraki adımlarda ürün, müşteri ve işlem yönetimi eklenecektir</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;