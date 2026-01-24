import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Save, RefreshCw, ArrowRight, ArrowLeftRight, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { createFinancialTransaction, getCurrencies, getLatestPriceSnapshot } from '../../../services/financialV2Service';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ExchangeForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [cashRegisters, setCashRegisters] = useState([]);
  
  // Form state
  const [exchangeType, setExchangeType] = useState('BUY'); // BUY = Döviz Alış, SELL = Döviz Satış
  const [foreignCurrency, setForeignCurrency] = useState('USD');
  const [foreignAmount, setForeignAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [tlAmount, setTlAmount] = useState(0);
  const [foreignCashRegisterId, setForeignCashRegisterId] = useState('');
  const [tlCashRegisterId, setTlCashRegisterId] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadLookups();
    loadCashRegisters();
  }, []);

  const loadLookups = async () => {
    try {
      const [currenciesData, snapshotData] = await Promise.all([
        getCurrencies(),
        getLatestPriceSnapshot(),
      ]);
      
      setCurrencies(currenciesData);
      setPriceSnapshot(snapshotData);
      
      // Default exchange rates
      if (snapshotData) {
        setExchangeRate((snapshotData.usd_buy || 42.50).toString());
      }
    } catch (error) {
      toast.error('Veriler yüklenemedi: ' + error.message);
    }
  };

  const loadCashRegisters = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/cash-registers?is_active=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCashRegisters(data || []);
      }
    } catch (error) {
      console.error('Cash registers load error:', error);
    }
  };

  // Döviz cinsi değişince kuru güncelle
  useEffect(() => {
    if (priceSnapshot) {
      if (foreignCurrency === 'USD') {
        const rate = exchangeType === 'BUY' ? priceSnapshot.usd_buy : priceSnapshot.usd_sell;
        setExchangeRate((rate || 42.50).toString());
      } else if (foreignCurrency === 'EUR') {
        const rate = exchangeType === 'BUY' ? priceSnapshot.eur_buy : priceSnapshot.eur_sell;
        setExchangeRate((rate || 46.00).toString());
      }
    }
  }, [foreignCurrency, exchangeType, priceSnapshot]);

  // Döviz tutarı veya kur değişince TL hesapla
  useEffect(() => {
    const amount = parseFloat(foreignAmount) || 0;
    const rate = parseFloat(exchangeRate) || 0;
    setTlAmount(amount * rate);
  }, [foreignAmount, exchangeRate]);

  // Kasa filtreleme
  const filteredForeignCashRegisters = cashRegisters.filter(cr => cr.currency === foreignCurrency);
  const filteredTlCashRegisters = cashRegisters.filter(cr => cr.currency === 'TRY');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!foreignAmount || parseFloat(foreignAmount) <= 0) {
      toast.error('Döviz tutarı giriniz');
      return;
    }

    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      toast.error('Döviz kuru giriniz');
      return;
    }

    if (!foreignCashRegisterId) {
      toast.error('Döviz kasası seçiniz');
      return;
    }

    if (!tlCashRegisterId) {
      toast.error('TL kasası seçiniz');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type_code: 'EXCHANGE',
        transaction_date: transactionDate,
        // BUY: TRY -> USD/EUR (TL veriyor, döviz alıyor)
        // SELL: USD/EUR -> TRY (döviz veriyor, TL alıyor)
        from_currency: exchangeType === 'BUY' ? 'TRY' : foreignCurrency,
        to_currency: exchangeType === 'BUY' ? foreignCurrency : 'TRY',
        from_amount: exchangeType === 'BUY' ? tlAmount : parseFloat(foreignAmount),
        to_amount: exchangeType === 'BUY' ? parseFloat(foreignAmount) : tlAmount,
        fx_rate: parseFloat(exchangeRate),
        // Kasa bilgileri
        foreign_cash_register_id: foreignCashRegisterId,
        tl_cash_register_id: tlCashRegisterId,
        exchange_type: exchangeType,
        foreign_amount: parseFloat(foreignAmount),
        tl_amount: tlAmount,
        notes: notes || `Döviz ${exchangeType === 'BUY' ? 'Alış' : 'Satış'} - ${foreignAmount} ${foreignCurrency} @ ${exchangeRate}`,
        idempotency_key: `exchange-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      const result = await createFinancialTransaction(payload);
      toast.success(`Döviz ${exchangeType === 'BUY' ? 'alış' : 'satış'} işlemi başarıyla tamamlandı!`);
      if (onSuccess) onSuccess(result);
    } catch (error) {
      toast.error('İşlem oluşturulamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Current Rates */}
      {priceSnapshot && (
        <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Güncel Kurlar:</strong> USD: {priceSnapshot.usd_buy?.toFixed(2)} / {priceSnapshot.usd_sell?.toFixed(2)} | EUR: {priceSnapshot.eur_buy?.toFixed(2)} / {priceSnapshot.eur_sell?.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <div>
              <CardTitle>Döviz İşlemi</CardTitle>
              <CardDescription>Döviz alış veya satış işlemi</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* İşlem Tipi */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant={exchangeType === 'BUY' ? 'default' : 'outline'}
              className={`h-20 flex flex-col gap-1 ${exchangeType === 'BUY' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              onClick={() => setExchangeType('BUY')}
            >
              <TrendingUp className="w-6 h-6" />
              <span className="font-bold">DÖVİZ ALIŞ</span>
              <span className="text-xs opacity-75">USD/EUR alıyorum</span>
            </Button>
            <Button
              type="button"
              variant={exchangeType === 'SELL' ? 'default' : 'outline'}
              className={`h-20 flex flex-col gap-1 ${exchangeType === 'SELL' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              onClick={() => setExchangeType('SELL')}
            >
              <TrendingDown className="w-6 h-6" />
              <span className="font-bold">DÖVİZ SATIŞ</span>
              <span className="text-xs opacity-75">USD/EUR satıyorum</span>
            </Button>
          </div>

          {/* İşlem Tarihi */}
          <div className="space-y-2">
            <Label>İşlem Tarihi *</Label>
            <Input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          {/* Döviz Bilgileri */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Döviz Cinsi *</Label>
              <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD (Amerikan Doları)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Döviz Tutarı *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={foreignAmount}
                onChange={(e) => setForeignAmount(e.target.value)}
                className="text-lg font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Döviz Kuru (TL/{foreignCurrency}) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="42.50"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="text-lg font-mono"
                required
              />
            </div>
          </div>

          {/* TL Karşılığı */}
          <div className={`p-4 rounded-lg ${exchangeType === 'BUY' ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
            <div className="flex items-center justify-between">
              <span className={`font-medium ${exchangeType === 'BUY' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                TL Karşılığı
              </span>
              <span className="text-2xl font-bold font-mono">
                {formatTL(tlAmount)} TL
              </span>
            </div>
            <p className={`text-sm mt-2 ${exchangeType === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {parseFloat(foreignAmount) || 0} {foreignCurrency} × {parseFloat(exchangeRate) || 0} = {formatTL(tlAmount)} TL
            </p>
          </div>

          {/* Kasa Seçimleri */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Wallet className="w-4 h-4" />
                {foreignCurrency} Kasa *
              </Label>
              <Select value={foreignCashRegisterId} onValueChange={setForeignCashRegisterId}>
                <SelectTrigger>
                  <SelectValue placeholder={`${foreignCurrency} Kasa seçin`} />
                </SelectTrigger>
                <SelectContent>
                  {filteredForeignCashRegisters.map((cr) => (
                    <SelectItem key={cr.id} value={cr.id}>
                      {cr.name} ({cr.type === 'CASH' ? 'Nakit' : 'Banka'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs ${exchangeType === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                {exchangeType === 'BUY' 
                  ? `+${parseFloat(foreignAmount) || 0} ${foreignCurrency} girecek` 
                  : `-${parseFloat(foreignAmount) || 0} ${foreignCurrency} çıkacak`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Wallet className="w-4 h-4" />
                TL Kasa *
              </Label>
              <Select value={tlCashRegisterId} onValueChange={setTlCashRegisterId}>
                <SelectTrigger>
                  <SelectValue placeholder="TL Kasa seçin" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTlCashRegisters.map((cr) => (
                    <SelectItem key={cr.id} value={cr.id}>
                      {cr.name} ({cr.type === 'CASH' ? 'Nakit' : 'Banka'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs ${exchangeType === 'BUY' ? 'text-red-600' : 'text-green-600'}`}>
                {exchangeType === 'BUY' 
                  ? `-${formatTL(tlAmount)} TL çıkacak` 
                  : `+${formatTL(tlAmount)} TL girecek`}
              </p>
            </div>
          </div>

          {/* Özet */}
          <div className={`p-4 border-2 rounded-lg ${exchangeType === 'BUY' ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'}`}>
            <h4 className={`font-semibold mb-2 ${exchangeType === 'BUY' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              İşlem Özeti
            </h4>
            <div className="text-sm space-y-1">
              <p>
                {exchangeType === 'BUY' ? (
                  <>
                    ✅ <strong>{foreignCurrency} Kasa</strong>'ya <strong>{parseFloat(foreignAmount) || 0} {foreignCurrency}</strong> GİRECEK<br/>
                    ❌ <strong>TL Kasa</strong>'dan <strong>{formatTL(tlAmount)} TL</strong> ÇIKACAK
                  </>
                ) : (
                  <>
                    ❌ <strong>{foreignCurrency} Kasa</strong>'dan <strong>{parseFloat(foreignAmount) || 0} {foreignCurrency}</strong> ÇIKACAK<br/>
                    ✅ <strong>TL Kasa</strong>'ya <strong>{formatTL(tlAmount)} TL</strong> GİRECEK
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Notlar */}
          <div className="space-y-2">
            <Label>Notlar (opsiyonel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="İşlem notları..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            İptal
          </Button>
        )}
        <Button type="submit" disabled={loading} className={exchangeType === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Kaydediliyor...' : `Döviz ${exchangeType === 'BUY' ? 'Alış' : 'Satış'} Kaydet`}
        </Button>
      </div>
    </form>
  );
};

export default ExchangeForm;
