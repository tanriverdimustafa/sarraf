import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Save, X, Banknote, Wallet, Receipt, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { expenseService, cashService } from '../../services';
import api from '../../lib/api';

const NewExpensePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    description: '',
    amount: '',
    payment_method: 'CASH_TRY',
    cash_register_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    payee: '',
    receipt_no: '',
    notes: '',
  });
  
  // Döviz state
  const [exchangeRate, setExchangeRate] = useState('');
  const [foreignEquivalent, setForeignEquivalent] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load categories
      const cats = await expenseService.getCategories();
      setCategories(cats.filter(c => c.is_active !== false));
      
      // Load cash registers
      const regs = await cashService.getRegisters();
      setCashRegisters(regs.filter(r => r.is_active !== false));
      
      // Load price snapshot for exchange rates
      try {
        const priceRes = await api.get('/api/price-snapshots/latest');
        setPriceSnapshot(priceRes.data);
      } catch (e) {
        console.error('Price snapshot load error:', e);
      }
      
      // Load payment methods
      try {
        const pmRes = await api.get('/api/financial-v2/lookups/payment-methods');
        setPaymentMethods(pmRes.data.filter(m => m.code !== 'GOLD_SCRAP'));
      } catch (e) {
        console.error('Payment methods load error:', e);
      }
    } catch (error) {
      toast.error('Veriler yüklenemedi: ' + error.message);
    }
  };

  // Ödeme yöntemi değişince kuru set et
  useEffect(() => {
    const pm = formData.payment_method || '';
    if (pm.includes('USD') && priceSnapshot) {
      setExchangeRate((priceSnapshot.usd_buy || 42.50).toString());
    } else if (pm.includes('EUR') && priceSnapshot) {
      setExchangeRate((priceSnapshot.eur_buy || 46.00).toString());
    } else {
      setExchangeRate('');
      setForeignEquivalent(0);
    }
  }, [formData.payment_method, priceSnapshot]);

  // TL tutarı veya kur değişince döviz karşılığını hesapla
  useEffect(() => {
    const pm = formData.payment_method || '';
    const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
    
    if (isForeignCurrency && exchangeRate) {
      const rate = parseFloat(exchangeRate) || 0;
      const tlAmount = parseFloat(formData.amount) || 0;
      if (rate > 0) {
        setForeignEquivalent(tlAmount / rate);
      }
    } else {
      setForeignEquivalent(0);
    }
  }, [formData.amount, exchangeRate, formData.payment_method]);

  // Kasa filtreleme
  const filteredCashRegisters = cashRegisters.filter(cr => {
    const pm = formData.payment_method || '';
    let currency = 'TRY';
    let type = null;
    
    if (pm.includes('USD')) currency = 'USD';
    else if (pm.includes('EUR')) currency = 'EUR';
    
    if (pm.includes('CASH')) type = 'CASH';
    else if (pm.includes('BANK')) type = 'BANK';
    
    if (cr.currency !== currency) return false;
    if (type && cr.type !== type) return false;
    
    return true;
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset cash register when payment method changes
    if (field === 'payment_method') {
      setFormData(prev => ({ ...prev, cash_register_id: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.category_id) {
      toast.error('Kategori seçiniz');
      return;
    }
    if (!formData.description) {
      toast.error('Açıklama giriniz');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Tutar giriniz');
      return;
    }
    if (!formData.cash_register_id) {
      toast.error('Kasa seçiniz');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        exchange_rate: exchangeRate ? parseFloat(exchangeRate) : null,
        foreign_amount: foreignEquivalent > 0 ? foreignEquivalent : null,
      };
      
      await expenseService.create(payload);
      
      toast.success('Gider başarıyla kaydedildi');
      navigate('/expenses');
    } catch (error) {
      toast.error('Gider kaydedilemedi: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const isForeignCurrency = formData.payment_method?.includes('USD') || formData.payment_method?.includes('EUR');
  const foreignCurrency = formData.payment_method?.includes('USD') ? 'USD' : formData.payment_method?.includes('EUR') ? 'EUR' : 'TRY';

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Banknote className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold">Yeni Gider</h1>
            <p className="text-muted-foreground">İşletme gideri kaydı oluşturun</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Temel Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle>Gider Bilgileri</CardTitle>
              <CardDescription>Giderin temel bilgilerini girin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gider Tarihi *</Label>
                  <Input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => handleChange('expense_date', e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Kategori *</Label>
                  <Select value={formData.category_id} onValueChange={(v) => handleChange('category_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Açıklama *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Gider açıklaması"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tutar (TL) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  placeholder="0.00"
                  className="text-lg font-mono"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Ödeme Bilgileri */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <CardTitle>Ödeme Bilgileri</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ödeme Yöntemi *</Label>
                  <Select value={formData.payment_method} onValueChange={(v) => handleChange('payment_method', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ödeme yöntemi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.code} value={pm.code}>
                          {pm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Kasa *</Label>
                  <Select value={formData.cash_register_id} onValueChange={(v) => handleChange('cash_register_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kasa seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCashRegisters.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.name} ({cr.type === 'CASH' ? 'Nakit' : 'Banka'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Döviz Hesabı */}
              {isForeignCurrency && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium">
                    <Calculator className="w-5 h-5" />
                    Döviz Hesabı
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm text-blue-600 dark:text-blue-400">Döviz Kuru (TL/{foreignCurrency})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        placeholder="42.50"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-blue-600 dark:text-blue-400">TL Tutar</Label>
                      <Input
                        type="text"
                        value={formatTL(parseFloat(formData.amount) || 0)}
                        disabled
                        className="font-mono bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-blue-600 dark:text-blue-400">Döviz Karşılığı ({foreignCurrency})</Label>
                      <Input
                        type="text"
                        value={foreignEquivalent > 0 ? foreignEquivalent.toFixed(2) : '0.00'}
                        disabled
                        className="font-mono bg-muted text-lg font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    💡 Kasadan <strong>{foreignEquivalent > 0 ? foreignEquivalent.toFixed(2) : '0.00'} {foreignCurrency}</strong> çıkacak
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opsiyonel Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle>Opsiyonel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kime Ödendi</Label>
                  <Input
                    value={formData.payee}
                    onChange={(e) => handleChange('payee', e.target.value)}
                    placeholder="Örn: Ev sahibi Mehmet Bey"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Fiş/Fatura No</Label>
                  <Input
                    value={formData.receipt_no}
                    onChange={(e) => handleChange('receipt_no', e.target.value)}
                    placeholder="Örn: 123456"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Ek notlar..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>
              <X className="w-4 h-4 mr-2" />
              İptal
            </Button>
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Kaydediliyor...' : 'Gideri Kaydet'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default NewExpensePage;
