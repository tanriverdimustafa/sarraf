import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import SearchableSelect from '../../SearchableSelect';
import { Save, ArrowUpRight, Plus, Trash2, AlertCircle, CheckCircle, Percent, CreditCard, Wallet, Building } from 'lucide-react';
import { toast } from 'sonner';
import { createFinancialTransaction, getPaymentMethods, getCurrencies, getParties, getLatestPriceSnapshot, getKarats } from '../../../services/financialV2Service';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const PaymentForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [parties, setParties] = useState([]);
  const [karats, setKarats] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [hasPrice, setHasPrice] = useState('');
  
  // Cash register state
  const [cashRegisters, setCashRegisters] = useState([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState('');
  
  // Selected party info
  const [selectedParty, setSelectedParty] = useState(null);
  
  // Payment tracking
  const [paidAmount, setPaidAmount] = useState('');
  const [shortfallOption, setShortfallOption] = useState('partial'); // 'partial' (bakiye) or 'discount' - Default: bakiye
  
  // DÖVİZ STATE
  const [exchangeRate, setExchangeRate] = useState('');
  const [foreignEquivalent, setForeignEquivalent] = useState(0);
  
  const [formData, setFormData] = useState({
    type_code: 'PAYMENT',
    party_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    currency: 'TRY',
    payment_method_code: 'CASH_TRY',
    cash_register_id: '',
    notes: '',
  });
  
  // Hurda Altın state
  const [scrapLines, setScrapLines] = useState([
    { karat_id: '', weight_gram: '', fineness: '', has_amount: 0, tl_amount: 0 }
  ]);

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
      const [methodsData, currenciesData, partiesData, karatsData, snapshotData] = await Promise.all([
        getPaymentMethods(),
        getCurrencies(),
        getParties(),
        getKarats(),
        getLatestPriceSnapshot(),
      ]);
      
      setPaymentMethods(methodsData);
      setCurrencies(currenciesData);
      setParties(partiesData || []);
      setKarats(karatsData || []);
      setPriceSnapshot(snapshotData);
      
      // Set default HAS price (sell price - we're paying out)
      if (snapshotData?.has_sell_tl) {
        setHasPrice(snapshotData.has_sell_tl.toString());
      }
    } catch (error) {
      toast.error('Lookup verileri yüklenemedi: ' + error.message);
    }
  };

  // DÖVİZ: Ödeme yöntemi değiştiğinde kuru set et
  useEffect(() => {
    const pm = formData.payment_method_code || '';
    if (pm.includes('USD') && priceSnapshot) {
      const usdRate = priceSnapshot.usd_buy || priceSnapshot.usd_sell || 42.50;
      setExchangeRate(usdRate.toString());
    } else if (pm.includes('EUR') && priceSnapshot) {
      const eurRate = priceSnapshot.eur_buy || priceSnapshot.eur_sell || 46.00;
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
      const tlAmount = parseFloat(paidAmount) || 0;
      if (rate > 0) {
        const foreignAmount = tlAmount / rate;
        setForeignEquivalent(foreignAmount);
      }
    } else {
      setForeignEquivalent(0);
    }
  }, [paidAmount, exchangeRate, formData.payment_method_code]);

  // When party is selected, get their balance info
  useEffect(() => {
    if (formData.party_id) {
      const party = parties.find(p => p.id === formData.party_id);
      setSelectedParty(party);
      
      // Get HAS balance from party.balance.has_gold_balance
      const hasBalance = party?.balance?.has_gold_balance || 0;
      
      // If party has positive balance (we owe them), set as expected amount
      if (party && hasBalance > 0) {
        const debtHAS = hasBalance;
        const debtTL = debtHAS * parseFloat(hasPrice || 0);
        setPaidAmount(debtTL.toFixed(2));
      }
    } else {
      setSelectedParty(null);
    }
  }, [formData.party_id, parties, hasPrice]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  
  // Hurda Altın fonksiyonları
  const addScrapLine = () => {
    setScrapLines([...scrapLines, { karat_id: '', weight_gram: '', fineness: '', has_amount: 0, tl_amount: 0 }]);
  };
  
  const removeScrapLine = (index) => {
    if (scrapLines.length > 1) {
      setScrapLines(scrapLines.filter((_, i) => i !== index));
    }
  };
  
  const handleScrapLineChange = (index, field, value) => {
    const newLines = [...scrapLines];
    newLines[index][field] = value;
    
    // Karat seçildiğinde milyem otomatik doldur
    if (field === 'karat_id' && value) {
      const selectedKarat = karats.find(k => k.id.toString() === value);
      if (selectedKarat) {
        newLines[index].fineness = selectedKarat.fineness;
      }
    }
    
    // HAS hesapla (gram × milyem)
    if (newLines[index].weight_gram && newLines[index].fineness) {
      const hasAmount = parseFloat(newLines[index].weight_gram) * parseFloat(newLines[index].fineness);
      newLines[index].has_amount = hasAmount;
      
      // TL hesapla (HAS × güncel has fiyatı)
      if (priceSnapshot?.has_sell_tl) {
        newLines[index].tl_amount = hasAmount * priceSnapshot.has_sell_tl;
      }
    } else {
      newLines[index].has_amount = 0;
      newLines[index].tl_amount = 0;
    }
    
    setScrapLines(newLines);
  };
  
  const getTotalScrapHas = () => {
    return scrapLines.reduce((sum, line) => sum + (line.has_amount || 0), 0);
  };
  
  const getTotalScrapTl = () => {
    return scrapLines.reduce((sum, line) => sum + (line.tl_amount || 0), 0);
  };
  
  const isGoldScrapMethod = formData.payment_method_code === 'GOLD_SCRAP';

  // Calculate totals
  const calculations = useMemo(() => {
    const hasPriceNum = parseFloat(hasPrice) || 0;
    
    // Our debt to party (positive balance = we owe them)
    const hasBalance = selectedParty?.balance?.has_gold_balance || 0;
    const ourDebtHAS = hasBalance > 0 ? hasBalance : 0;
    
    // Expected amount in TL (based on our debt)
    const expectedTL = ourDebtHAS * hasPriceNum;
    
    // Paid amount (from gold scrap or cash)
    const paidTL = isGoldScrapMethod ? getTotalScrapTl() : (parseFloat(paidAmount) || 0);
    
    // Paid in HAS terms
    const paidHAS = isGoldScrapMethod ? getTotalScrapHas() : (hasPriceNum > 0 ? paidTL / hasPriceNum : 0);
    
    // Difference calculation
    const differenceTL = expectedTL - paidTL;
    const differenceHAS = hasPriceNum > 0 ? differenceTL / hasPriceNum : 0;
    
    // Determine if there's a shortfall
    const hasShortfall = differenceTL > 0.01 && ourDebtHAS > 0;
    
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
    
    // Total HAS being closed (paid + discount)
    const totalClosedHAS = paidHAS + discountHAS;
    
    return {
      ourDebtHAS,
      expectedTL,
      paidTL,
      paidHAS,
      differenceTL,
      differenceHAS,
      hasShortfall,
      discountTL,
      discountHAS,
      remainingDebtHAS,
      totalClosedHAS,
      hasPriceNum,
    };
  }, [selectedParty, hasPrice, paidAmount, shortfallOption, isGoldScrapMethod, scrapLines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.party_id) {
      toast.error('Party seçimi gereklidir');
      return;
    }

    // Hurda Altın ile ödeme kontrolü
    if (isGoldScrapMethod) {
      const validLines = scrapLines.filter(line => line.karat_id && line.weight_gram && line.fineness);
      if (validLines.length === 0) {
        toast.error('En az bir hurda kalemi ekleyin');
        return;
      }
    } else {
      if (!paidAmount || parseFloat(paidAmount) <= 0) {
        toast.error('Ödeme tutarı pozitif olmalıdır');
        return;
      }
    }

    setLoading(true);
    try {
      // DÖVİZ BİLGİLERİ
      const pm = formData.payment_method_code || '';
      const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
      const paymentCurrency = pm.includes('USD') ? 'USD' : pm.includes('EUR') ? 'EUR' : 'TRY';
      
      const payload = {
        ...formData,
        total_amount_currency: calculations.paidTL,
        // Discount/partial payment fields
        expected_amount_tl: calculations.expectedTL,
        actual_amount_tl: calculations.paidTL,
        discount_tl: calculations.discountTL,
        discount_has: calculations.discountHAS,
        total_has_amount: -calculations.totalClosedHAS, // Negative (OUT) - total debt being closed
        paid_has: -calculations.paidHAS, // Actually paid
        remaining_debt_has: calculations.remainingDebtHAS,
        is_discount: calculations.discountHAS > 0.001,
        has_price_used: calculations.hasPriceNum,
        our_debt_has: calculations.ourDebtHAS,
        cash_register_id: selectedCashRegister && selectedCashRegister !== 'none' ? selectedCashRegister : null,
        // DÖVİZ BİLGİLERİ
        payment_currency: paymentCurrency,
        foreign_amount: isForeignCurrency ? foreignEquivalent : null,
        exchange_rate: isForeignCurrency ? parseFloat(exchangeRate) : null,
        idempotency_key: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      
      // Hurda Altın ise scrap_lines ekle
      if (isGoldScrapMethod) {
        payload.scrap_lines = scrapLines
          .filter(line => line.karat_id && line.weight_gram && line.fineness)
          .map(line => ({
            karat_id: parseInt(line.karat_id),
            weight_gram: parseFloat(line.weight_gram),
            fineness: parseFloat(line.fineness),
            has_amount: parseFloat(line.has_amount)
          }));
      }

      const result = await createFinancialTransaction(payload);
      
      // Show appropriate success message
      if (calculations.discountHAS > 0) {
        toast.success(`Ödeme kaydedildi! Alınan iskonto: ${calculations.discountTL.toFixed(2)} TL (${calculations.discountHAS.toFixed(4)} HAS)`);
      } else if (calculations.remainingDebtHAS > 0) {
        toast.success(`Kısmi ödeme kaydedildi! Kalan borcumuz: ${calculations.remainingDebtHAS.toFixed(4)} HAS`);
      } else {
        toast.success('Ödeme işlemi başarıyla tamamlandı!');
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
        <Card className="border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-orange-800 dark:text-orange-400">HAS Altın Satış Fiyatı (TL/gr)</Label>
                <p className="text-xs text-muted-foreground">Ödeme hesaplamasında kullanılacak</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={hasPrice}
                  onChange={(e) => setHasPrice(e.target.value)}
                  className="w-32 text-right font-mono text-lg font-semibold"
                />
                <span className="text-orange-800 dark:text-orange-400 font-semibold">₺</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Party Selection & Info */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-red-600" />
            <div>
              <CardTitle>Ödeme İşlemi (PAYMENT)</CardTitle>
              <CardDescription>Tedarikçiye/Party'ye ödeme yapma (HAS OUT)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tedarikçi/Party *</Label>
              <SearchableSelect
                options={parties.map(party => {
                  const hasBalance = party.balance?.has_gold_balance || 0;
                  return {
                    value: party.id,
                    label: `${party.name}${hasBalance > 0 ? ` (Borcumuz: ${hasBalance.toFixed(4)} HAS)` : ''}`
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

          {/* Our Debt Info */}
          {selectedParty && calculations.ourDebtHAS > 0 && (
            <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-800 dark:text-red-400 font-medium">
                      {selectedParty.name} - Borcumuz
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-red-600">
                      {calculations.ourDebtHAS.toFixed(4)} HAS
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

      {/* Payment Method Selection */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ödeme Yöntemi *</Label>
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
            
            {formData.payment_method_code !== 'GOLD_SCRAP' && (
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
            )}

            {/* DÖVİZ BİLGİLERİ - Döviz seçildiğinde göster */}
            {(formData.payment_method_code?.includes('USD') || formData.payment_method_code?.includes('EUR')) && (
              <div className="col-span-full p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium">
                  <Wallet className="w-5 h-5" />
                  Döviz Hesabı
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-600 dark:text-blue-400">Döviz Kuru (TL/{formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'})</Label>
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
                      value={formatTL(parseFloat(paidAmount) || 0)}
                      disabled
                      className="font-mono bg-muted"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-600 dark:text-blue-400">
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
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  💡 Kasadan <strong>{foreignEquivalent > 0 ? foreignEquivalent.toFixed(2) : '0.00'} {formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'}</strong> çıkacak
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gold Scrap Payment */}
      {isGoldScrapMethod && (
        <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-800 dark:text-amber-400">Hurda Altın ile Ödeme</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addScrapLine}>
                <Plus className="w-4 h-4 mr-2" />
                Kalem Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scrapLines.map((line, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3 bg-white/50 dark:bg-background/50">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Hurda #{index + 1}</span>
                  {scrapLines.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeScrapLine(index)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ayar</Label>
                    <Select
                      value={line.karat_id.toString()}
                      onValueChange={(value) => handleScrapLineChange(index, 'karat_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seç" />
                      </SelectTrigger>
                      <SelectContent>
                        {karats.map((karat) => (
                          <SelectItem key={karat.id} value={karat.id.toString()}>
                            {karat.karat || karat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ağırlık (gr)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={line.weight_gram}
                      onChange={(e) => handleScrapLineChange(index, 'weight_gram', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Milyem</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={line.fineness}
                      onChange={(e) => handleScrapLineChange(index, 'fineness', e.target.value)}
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">HAS</Label>
                    <Input
                      type="text"
                      value={line.has_amount.toFixed(4)}
                      readOnly
                      className="bg-muted font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="flex justify-between items-center p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <span className="font-medium text-amber-800 dark:text-amber-400">Toplam Hurda</span>
              <div className="text-right">
                <p className="font-bold text-lg">{getTotalScrapHas().toFixed(4)} HAS</p>
                <p className="text-sm text-muted-foreground">{formatTL(getTotalScrapTl())} ₺</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Payment Section */}
      {!isGoldScrapMethod && (
        <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Ödeme Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Card */}
            {calculations.ourDebtHAS > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white dark:bg-background rounded-lg border">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Borcumuz (HAS)</p>
                  <p className="text-xl font-bold text-red-600">{calculations.ourDebtHAS.toFixed(4)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Beklenen Tutar</p>
                  <p className="text-xl font-bold text-primary">{formatTL(calculations.expectedTL)} ₺</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Ödenen Tutar</p>
                  <p className="text-xl font-bold text-green-600">{formatTL(calculations.paidTL)} ₺</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {calculations.discountTL > 0 ? 'Alınan İskonto' : calculations.remainingDebtHAS > 0 ? 'Kalan Borç' : 'Fark'}
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

            {/* Paid Amount Input */}
            <div className="space-y-2">
              <Label>Ödenen Tutar (TL) *</Label>
              <Input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-mono"
                required
              />
            </div>

            {/* Shortfall Options */}
            {calculations.hasShortfall && calculations.differenceTL > 0.01 && (
              <div className="p-4 border-2 border-yellow-500/50 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                      Ödenen tutar borçtan {formatTL(calculations.differenceTL)} TL düşük!
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
                        Tedarikçi {formatTL(calculations.differenceTL)} TL ({calculations.differenceHAS.toFixed(4)} HAS) iskonto yaptı. Kalan borcumuz: 0
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
                      <span className="font-medium">Kısmi ödeme (borç devam)</span>
                      <p className="text-xs text-muted-foreground">
                        İskonto yok. Kalan borcumuz: {calculations.differenceHAS.toFixed(4)} HAS
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Full Payment Indicator */}
            {!calculations.hasShortfall && calculations.paidTL > 0 && calculations.ourDebtHAS > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-950/30 rounded-lg text-green-800 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Tam ödeme - Borç tamamen kapatılacak</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Notlar</Label>
            <Textarea
              placeholder="Ödeme açıklaması..."
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
        <Button type="submit" disabled={loading || (!isGoldScrapMethod && !paidAmount) || (isGoldScrapMethod && getTotalScrapHas() <= 0)}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Kaydediliyor...' : 'Ödemeyi Kaydet'}
        </Button>
      </div>
    </form>
  );
};

export default PaymentForm;
