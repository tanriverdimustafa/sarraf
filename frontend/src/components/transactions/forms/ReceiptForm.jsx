import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import SearchableSelect from '../../SearchableSelect';
import { Save, ArrowDownLeft, AlertCircle, CheckCircle, Percent, CreditCard, Wallet, User } from 'lucide-react';
import { toast } from 'sonner';
import { createFinancialTransaction, getPaymentMethods, getCurrencies, getParties, getLatestPriceSnapshot } from '../../../services/financialV2Service';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ReceiptForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [parties, setParties] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [hasPrice, setHasPrice] = useState('');
  
  // Cash register state
  const [cashRegisters, setCashRegisters] = useState([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState('');
  
  // Selected party debt info
  const [selectedParty, setSelectedParty] = useState(null);
  
  // Payment tracking
  const [receivedAmount, setReceivedAmount] = useState('');
  const [shortfallOption, setShortfallOption] = useState('partial'); // 'partial' (bakiye) or 'discount' - Default: bakiye
  
  // DÖVİZ STATE
  const [exchangeRate, setExchangeRate] = useState('');
  const [foreignEquivalent, setForeignEquivalent] = useState(0);
  
  const [formData, setFormData] = useState({
    type_code: 'RECEIPT',
    party_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    currency: 'TRY',
    payment_method_code: 'CASH_TRY',
    cash_register_id: '',
    notes: '',
  });

  useEffect(() => {
    loadLookups();
    loadCashRegisters();
  }, []);

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

  const loadLookups = async () => {
    try {
      const [methodsData, currenciesData, partiesData, snapshotData] = await Promise.all([
        getPaymentMethods(),
        getCurrencies(),
        getParties(),
        getLatestPriceSnapshot(),
      ]);
      setPaymentMethods(methodsData);
      setCurrencies(currenciesData);
      setParties(partiesData || []);
      setPriceSnapshot(snapshotData);
      
      // Set default HAS price (buy price for receipt - we're receiving)
      if (snapshotData?.has_buy_tl) {
        setHasPrice(snapshotData.has_buy_tl.toString());
      }
    } catch (error) {
      toast.error('Lookup verileri yüklenemedi');
    }
  };

  // DÖVİZ: Ödeme yöntemi değiştiğinde kuru set et
  useEffect(() => {
    const pm = formData.payment_method_code || '';
    if (pm.includes('USD') && priceSnapshot) {
      const usdRate = priceSnapshot.usd_sell || priceSnapshot.usd_buy || 42.50;
      setExchangeRate(usdRate.toString());
    } else if (pm.includes('EUR') && priceSnapshot) {
      const eurRate = priceSnapshot.eur_sell || priceSnapshot.eur_buy || 46.00;
      setExchangeRate(eurRate.toString());
    } else {
      setExchangeRate('');
      setForeignEquivalent(0);
    }
  }, [formData.payment_method_code, priceSnapshot]);

  // DÖVİZ: TL tutarı veya kur değişince döviz karşılığını hesapla
  useEffect(() => {
    const pm = formData.payment_method_code || '';
    const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
    
    if (isForeignCurrency && exchangeRate) {
      const rate = parseFloat(exchangeRate) || 0;
      const tlAmount = parseFloat(receivedAmount) || 0;
      if (rate > 0) {
        const foreignAmount = tlAmount / rate;
        setForeignEquivalent(foreignAmount);
      }
    } else {
      setForeignEquivalent(0);
    }
  }, [receivedAmount, exchangeRate, formData.payment_method_code]);

  // When party is selected, get their debt info
  useEffect(() => {
    if (formData.party_id) {
      const party = parties.find(p => p.id === formData.party_id);
      setSelectedParty(party);
      
      // Get HAS balance from party.balance.has_gold_balance
      const hasBalance = party?.balance?.has_gold_balance || 0;
      
      // If party has negative balance (they owe us), set as expected amount
      if (party && hasBalance < 0) {
        const debtHAS = Math.abs(hasBalance);
        const debtTL = debtHAS * parseFloat(hasPrice || 0);
        setReceivedAmount(debtTL.toFixed(2));
      }
    } else {
      setSelectedParty(null);
    }
  }, [formData.party_id, parties, hasPrice]);

  // Calculate totals
  const calculations = useMemo(() => {
    const hasPriceNum = parseFloat(hasPrice) || 0;
    
    // Party's debt to us (negative balance = they owe us)
    const hasBalance = selectedParty?.balance?.has_gold_balance || 0;
    const partyDebtHAS = hasBalance < 0 ? Math.abs(hasBalance) : 0;
    
    // Expected amount in TL (based on debt)
    const expectedTL = partyDebtHAS * hasPriceNum;
    
    // Received amount
    const receivedTL = parseFloat(receivedAmount) || 0;
    
    // Received in HAS terms
    const receivedHAS = hasPriceNum > 0 ? receivedTL / hasPriceNum : 0;
    
    // Difference calculation
    const differenceTL = expectedTL - receivedTL;
    const differenceHAS = hasPriceNum > 0 ? differenceTL / hasPriceNum : 0;
    
    // Determine if there's a shortfall
    const hasShortfall = differenceTL > 0.01 && partyDebtHAS > 0;
    
    // Calculate discount or remaining debt based on option
    let discountTL = 0;
    let discountHAS = 0;
    let remainingDebtHAS = 0;
    
    if (hasShortfall) {
      if (shortfallOption === 'discount') {
        discountTL = differenceTL;
        discountHAS = differenceHAS;
        remainingDebtHAS = 0;
      } else {
        discountTL = 0;
        discountHAS = 0;
        remainingDebtHAS = differenceHAS;
      }
    }
    
    // Total HAS being closed (received + discount)
    const totalClosedHAS = receivedHAS + discountHAS;
    
    return {
      partyDebtHAS,
      expectedTL,
      receivedTL,
      receivedHAS,
      differenceTL,
      differenceHAS,
      hasShortfall,
      discountTL,
      discountHAS,
      remainingDebtHAS,
      totalClosedHAS,
      hasPriceNum,
    };
  }, [selectedParty, hasPrice, receivedAmount, shortfallOption]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.party_id) {
      toast.error('Party seçimi gereklidir');
      return;
    }

    if (!receivedAmount || parseFloat(receivedAmount) <= 0) {
      toast.error('Tahsilat tutarı pozitif olmalıdır');
      return;
    }

    setLoading(true);
    try {
      // DÖVİZ BİLGİLERİ
      const pm = formData.payment_method_code || '';
      const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
      const paymentCurrency = pm.includes('USD') ? 'USD' : pm.includes('EUR') ? 'EUR' : 'TRY';
      
      const payload = {
        ...formData,
        total_amount_currency: calculations.receivedTL,
        // Discount/partial payment fields
        expected_amount_tl: calculations.expectedTL,
        actual_amount_tl: calculations.receivedTL,
        discount_tl: calculations.discountTL,
        discount_has: calculations.discountHAS,
        total_has_amount: calculations.totalClosedHAS, // Total debt being closed
        collected_has: calculations.receivedHAS, // Actually received
        remaining_debt_has: calculations.remainingDebtHAS,
        is_discount: calculations.discountHAS > 0.001,
        has_price_used: calculations.hasPriceNum,
        party_debt_has: calculations.partyDebtHAS,
        cash_register_id: selectedCashRegister && selectedCashRegister !== 'none' ? selectedCashRegister : null,
        // DÖVİZ BİLGİLERİ
        payment_currency: paymentCurrency,
        foreign_amount: isForeignCurrency ? foreignEquivalent : null,
        exchange_rate: isForeignCurrency ? parseFloat(exchangeRate) : null,
        idempotency_key: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      const result = await createFinancialTransaction(payload);
      
      // Show appropriate success message
      if (calculations.discountHAS > 0) {
        toast.success(`Tahsilat kaydedildi! İskonto: ${calculations.discountTL.toFixed(2)} TL (${calculations.discountHAS.toFixed(4)} HAS)`);
      } else if (calculations.remainingDebtHAS > 0) {
        toast.success(`Kısmi tahsilat kaydedildi! Kalan borç: ${calculations.remainingDebtHAS.toFixed(4)} HAS`);
      } else {
        toast.success('Tahsilat işlemi başarıyla tamamlandı!');
      }
      
      if (onSuccess) onSuccess(result);
    } catch (error) {
      toast.error('İşlem oluşturulamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* HAS Price Display */}
      {priceSnapshot && (
        <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-green-800 dark:text-green-400">HAS Altın Alış Fiyatı (TL/gr)</Label>
                <p className="text-xs text-muted-foreground">Tahsilat hesaplamasında kullanılacak</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={hasPrice}
                  onChange={(e) => setHasPrice(e.target.value)}
                  className="w-32 text-right font-mono text-lg font-semibold"
                />
                <span className="text-green-800 dark:text-green-400 font-semibold">₺</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Party Selection & Info */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-green-600" />
            <div>
              <CardTitle>Tahsilat İşlemi (RECEIPT)</CardTitle>
              <CardDescription>Müşteriden/Party'den tahsilat (HAS IN)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Müşteri/Party *</Label>
              <SearchableSelect
                options={parties.map(party => {
                  const hasBalance = party.balance?.has_gold_balance || 0;
                  return {
                    value: party.id,
                    label: `${party.name}${hasBalance < 0 ? ` (Borç: ${Math.abs(hasBalance).toFixed(4)} HAS)` : ''}`
                  };
                })}
                value={formData.party_id}
                onChange={(value) => handleChange('party_id', value)}
                placeholder="Cari ara ve seç..."
                noOptionsMessage="Cari bulunamadı"
              />
            </div>

            <div className="space-y-2">
              <Label>İşlem Tarihi *</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => handleChange('transaction_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Para Birimi</Label>
              <Select value={formData.currency} onValueChange={(value) => handleChange('currency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((cur) => (
                    <SelectItem key={cur.code} value={cur.code}>
                      {cur.name} ({cur.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Party Debt Info */}
          {selectedParty && calculations.partyDebtHAS > 0 && (
            <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-800 dark:text-red-400 font-medium">
                      {selectedParty.name} - Mevcut Borcu
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-red-600">
                      {calculations.partyDebtHAS.toFixed(4)} HAS
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ≈ {formatTL(calculations.expectedTL)} ₺
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Payment Section */}
      <Card className="border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Tahsilat Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Card */}
          {calculations.partyDebtHAS > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white dark:bg-background rounded-lg border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Borç (HAS)</p>
                <p className="text-xl font-bold text-red-600">{calculations.partyDebtHAS.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Beklenen Tutar</p>
                <p className="text-xl font-bold text-primary">{formatTL(calculations.expectedTL)} ₺</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Tahsil Edilen</p>
                <p className="text-xl font-bold text-green-600">{formatTL(calculations.receivedTL)} ₺</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {calculations.discountTL > 0 ? 'İskonto' : calculations.remainingDebtHAS > 0 ? 'Kalan Borç' : 'Fark'}
                </p>
                <p className={`text-xl font-bold ${calculations.discountTL > 0 ? 'text-purple-600' : calculations.remainingDebtHAS > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {calculations.discountTL > 0 
                    ? `${formatTL(calculations.discountTL)} ₺`
                    : calculations.remainingDebtHAS > 0 
                      ? `${calculations.remainingDebtHAS.toFixed(4)} HAS`
                      : '0'}
                </p>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ödeme Yöntemi</Label>
              <Select
                value={formData.payment_method_code}
                onValueChange={(value) => {
                  handleChange('payment_method_code', value);
                  setSelectedCashRegister('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.code} value={method.code}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kasa (opsiyonel)</Label>
              <Select
                value={selectedCashRegister}
                onValueChange={setSelectedCashRegister}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kasa seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçilmedi</SelectItem>
                  {cashRegisters
                    .filter(cr => {
                      const pm = formData.payment_method_code || '';
                      // Ödeme yönteminden para birimi ve tip çıkar
                      let currency = 'TRY';
                      let type = null;
                      
                      if (pm.includes('USD')) currency = 'USD';
                      else if (pm.includes('EUR')) currency = 'EUR';
                      else if (pm.includes('TRY') || pm === 'CREDIT_CARD' || pm === 'CHECK') currency = 'TRY';
                      
                      if (pm.includes('CASH')) type = 'CASH';
                      else if (pm.includes('BANK')) type = 'BANK';
                      
                      // Para birimi eşleşmeli
                      if (cr.currency !== currency) return false;
                      // Tip belirtilmişse eşleşmeli
                      if (type && cr.type !== type) return false;
                      
                      return true;
                    })
                    .map((cr) => (
                      <SelectItem key={cr.id} value={cr.id}>
                        {cr.name} ({cr.type === 'CASH' ? 'Nakit' : 'Banka'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* DÖVİZ SEÇİLİ DEĞİLSE - Normal TL Tutar */}
            {!(formData.payment_method_code?.includes('USD') || formData.payment_method_code?.includes('EUR')) && (
              <div className="space-y-2">
                <Label>Tahsil Edilen Tutar (TL) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-lg font-mono"
                  required
                />
              </div>
            )}

            {/* DÖVİZ SEÇİLİYSE - Döviz Hesabı */}
            {(formData.payment_method_code?.includes('USD') || formData.payment_method_code?.includes('EUR')) && (
              <div className="col-span-full space-y-4">
                <div className="space-y-2">
                  <Label>Tahsil Edilen Tutar (TL) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg font-mono"
                    required
                  />
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
                    <Wallet className="w-5 h-5" />
                    Döviz Hesabı
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm text-green-600 dark:text-green-400">Döviz Kuru (TL/{formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'})</Label>
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
                      <Label className="text-sm text-green-600 dark:text-green-400">TL Tutar</Label>
                      <Input
                        type="text"
                        value={formatTL(parseFloat(receivedAmount) || 0)}
                        disabled
                        className="font-mono bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-green-600 dark:text-green-400">
                        Döviz Karşılığı ({formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'})
                      </Label>
                      <Input
                        type="text"
                        value={foreignEquivalent > 0 ? foreignEquivalent.toFixed(2) : '0.00'}
                        disabled
                        className="font-mono bg-muted text-lg font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    💰 Kasaya <strong>{foreignEquivalent > 0 ? foreignEquivalent.toFixed(2) : '0.00'} {formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'}</strong> girecek
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Shortfall Options */}
          {calculations.hasShortfall && calculations.differenceTL > 0.01 && (
            <div className="p-4 border-2 border-yellow-500/50 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                    Tahsil edilen tutar borçtan {formatTL(calculations.differenceTL)} TL düşük!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Bu farkı nasıl işlemek istiyorsunuz?
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${shortfallOption === 'discount' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : 'hover:bg-muted/50'}`}>
                  <input
                    type="radio"
                    name="shortfallOption"
                    value="discount"
                    checked={shortfallOption === 'discount'}
                    onChange={(e) => setShortfallOption(e.target.value)}
                    className="w-4 h-4"
                  />
                  <Percent className="w-5 h-5 text-purple-600" />
                  <div className="flex-1">
                    <span className="font-medium">İskonto olarak kabul et</span>
                    <p className="text-xs text-muted-foreground">
                      {formatTL(calculations.differenceTL)} TL ({calculations.differenceHAS.toFixed(4)} HAS) iskonto yapılacak. Kalan borç: 0
                    </p>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${shortfallOption === 'partial' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted/50'}`}>
                  <input
                    type="radio"
                    name="shortfallOption"
                    value="partial"
                    checked={shortfallOption === 'partial'}
                    onChange={(e) => setShortfallOption(e.target.value)}
                    className="w-4 h-4"
                  />
                  <CreditCard className="w-5 h-5 text-red-600" />
                  <div className="flex-1">
                    <span className="font-medium">Kısmi tahsilat (borç devam)</span>
                    <p className="text-xs text-muted-foreground">
                      İskonto yok. Kalan borç: {calculations.differenceHAS.toFixed(4)} HAS
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Full Payment Indicator */}
          {!calculations.hasShortfall && calculations.receivedTL > 0 && calculations.partyDebtHAS > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-950/30 rounded-lg text-green-800 dark:text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Tam tahsilat - Borç tamamen kapatılacak</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Notlar</Label>
            <Textarea
              placeholder="Tahsilat açıklaması..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            İptal
          </Button>
        )}
        <Button type="submit" disabled={loading || !receivedAmount}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Kaydediliyor...' : 'Tahsilatı Kaydet'}
        </Button>
      </div>
    </form>
  );
};

export default ReceiptForm;
