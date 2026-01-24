import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import SearchableSelect from '../../SearchableSelect';
import { Plus, Trash2, Save, Package, User, Coins, Calculator, Layers, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { 
  createFinancialTransaction, 
  getPaymentMethods, 
  getCurrencies, 
  getParties, 
  getKarats, 
  getProductTypes,
  getLatestPriceSnapshot,
  getStockPoolInfo 
} from '../../../services/financialV2Service';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const PurchaseForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [parties, setParties] = useState([]);
  const [karats, setKarats] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [hasPrice, setHasPrice] = useState('');
  
  // Cash register state
  const [cashRegisters, setCashRegisters] = useState([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState('');
  
  // Calculated values
  const [calculatedHas, setCalculatedHas] = useState(0);
  const [calculatedTL, setCalculatedTL] = useState(0);
  
  // DÖVİZ STATE
  const [exchangeRate, setExchangeRate] = useState('');
  const [foreignEquivalent, setForeignEquivalent] = useState(0);
  
  // ÖDEME FARK SEÇİMİ STATE
  const [paymentDifferenceAction, setPaymentDifferenceAction] = useState('PROFIT_LOSS');
  
  // POOL MODE STATE - Bilezik için
  const [poolMode, setPoolMode] = useState(false);
  const [poolInfo, setPoolInfo] = useState(null);
  const [poolFormData, setPoolFormData] = useState({
    product_type_id: 13, // GOLD_BRACELET
    karat_id: '',
    weight_gram: '',
    labor_per_gram: '',  // İşçilik HAS/gr
  });
  
  const [formData, setFormData] = useState({
    type_code: 'PURCHASE',
    party_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    currency: 'TRY',
    total_amount_currency: '',
    payment_method_code: 'CASH_TRY',
    notes: '',
    lines: [
      {
        product_type_code: '',
        karat_id: '',
        weight_gram: '',
        quantity: 1,
        labor_has_value: '',
        line_total_has: '',
        note: '',
      },
    ],
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
      const [methodsData, currenciesData, partiesData, karatsData, productTypesData, snapshotData] = await Promise.all([
        getPaymentMethods(),
        getCurrencies(),
        getParties(),
        getKarats(),
        getProductTypes(),
        getLatestPriceSnapshot(),
      ]);
      
      setPaymentMethods(methodsData || []);
      setCurrencies(currenciesData || []);
      setParties(partiesData || []);
      setKarats(karatsData || []);
      setProductTypes(productTypesData || []);
      setPriceSnapshot(snapshotData);
      
      // Set default HAS price (buy price for purchase)
      if (snapshotData?.has_buy_tl) {
        setHasPrice(snapshotData.has_buy_tl.toString());
      }
    } catch (error) {
      console.error('Lookup load error:', error);
      toast.error('Veriler yüklenemedi: ' + error.message);
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
      const tlAmount = parseFloat(formData.total_amount_currency) || calculatedTL || 0;
      if (rate > 0) {
        const foreignAmount = tlAmount / rate;
        setForeignEquivalent(foreignAmount);
      }
    } else {
      setForeignEquivalent(0);
    }
  }, [formData.total_amount_currency, exchangeRate, calculatedTL, formData.payment_method_code]);

  // POOL MODE: Karat değiştiğinde havuz bilgisini yükle
  useEffect(() => {
    const loadPoolInfo = async () => {
      if (poolMode && poolFormData.karat_id) {
        try {
          const info = await getStockPoolInfo(poolFormData.product_type_id, parseInt(poolFormData.karat_id));
          setPoolInfo(info);
        } catch (error) {
          console.log('Pool info not found, will be created on first purchase');
          setPoolInfo({ total_weight: 0, total_cost_has: 0, avg_cost_per_gram: 0 });
        }
      }
    };
    loadPoolInfo();
  }, [poolMode, poolFormData.karat_id, poolFormData.product_type_id]);

  // POOL MODE: Hesaplamalar
  const poolCalculations = React.useMemo(() => {
    if (!poolMode || !poolFormData.karat_id) return null;
    
    const weight = parseFloat(poolFormData.weight_gram) || 0;
    const laborPerGram = parseFloat(poolFormData.labor_per_gram) || 0;
    const karat = karats.find(k => k.id === parseInt(poolFormData.karat_id));
    const fineness = karat?.fineness || 0.916;
    
    const materialHas = weight * fineness;
    const laborHas = weight * laborPerGram;
    const totalCostHas = materialHas + laborHas;
    
    const currentPool = poolInfo?.total_weight || 0;
    const currentCost = poolInfo?.total_cost_has || 0;
    const newPoolWeight = currentPool + weight;
    const newPoolCost = currentCost + totalCostHas;
    const newAvgCost = newPoolWeight > 0 ? newPoolCost / newPoolWeight : 0;
    
    const hasPriceNum = parseFloat(hasPrice) || 0;
    const totalTL = totalCostHas * hasPriceNum;
    
    return {
      weight,
      fineness,
      materialHas,
      laborHas,
      totalCostHas,
      totalTL,
      currentPool,
      newPoolWeight,
      newPoolCost,
      newAvgCost,
    };
  }, [poolMode, poolFormData, karats, poolInfo, hasPrice]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index, field, value) => {
    setFormData((prev) => {
      const newLines = [...prev.lines];
      newLines[index] = { ...newLines[index], [field]: value };
      
      // Product type seçildiğinde track_type, unit, fixed_weight, default_labor_rate ve fineness otomatik set et
      if (field === 'product_type_code') {
        const productType = productTypes.find(pt => pt.code === value);
        if (productType) {
          newLines[index].track_type = productType.track_type;
          newLines[index].unit = productType.unit;
          newLines[index].product_type_id = productType.id;
          
          if (productType.fixed_weight) {
            newLines[index].weight_gram = productType.fixed_weight.toString();
            newLines[index].fixed_weight = productType.fixed_weight;
          }
          
          // Default işçilik değerini set et (hurda için 0)
          if (productType.default_labor_rate !== undefined && productType.default_labor_rate !== null) {
            newLines[index].labor_has_value = productType.default_labor_rate.toString();
          }
          
          // Hurda tipi için product_type'ın kendi fineness değerini kullan
          if (productType.fineness && productType.group === 'HURDA') {
            newLines[index].fineness = productType.fineness;
            newLines[index].is_scrap = true;
            // Hurda için karat seçimi gerekmez, fineness product_type'tan gelir
          }
          
          // İşçilik var mı kontrolü
          newLines[index].has_labor = productType.has_labor !== false;
        }
      }
      
      // Auto-calculate line_total_has when weight, quantity, labor or karat changes
      if (['weight_gram', 'quantity', 'karat_id', 'product_type_code', 'labor_has_value'].includes(field)) {
        const line = newLines[index];
        const weight = parseFloat(line.weight_gram) || 0;
        const qty = parseInt(line.quantity) || 1;
        
        // Hurda tipi için product_type'ın fineness'ını kullan, değilse karat'tan al
        let fineness = line.fineness;
        if (!line.is_scrap) {
          const karat = karats.find(k => k.id === parseInt(line.karat_id));
          fineness = karat?.fineness || 0.995;
        }
        
        const totalWeight = weight * qty;
        const materialHas = totalWeight * fineness;
        const laborHas = parseFloat(line.labor_has_value) || 0;
        const laborTotal = line.has_labor !== false ? (totalWeight * laborHas) : 0;  // Hurda için işçilik yok
        const lineTotal = materialHas + laborTotal;
        
        newLines[index].line_total_has = lineTotal.toFixed(6);
        newLines[index].fineness = fineness;
      }
      
      return { ...prev, lines: newLines };
    });
  };

  // Recalculate totals when lines change
  useEffect(() => {
    // POOL mode için ayrı hesaplama
    if (poolMode && poolCalculations) {
      setCalculatedHas(poolCalculations.totalCostHas);
      setCalculatedTL(poolCalculations.totalTL);
      return;
    }
    
    const totalHas = formData.lines.reduce((sum, line) => {
      return sum + (parseFloat(line.line_total_has) || 0);
    }, 0);
    setCalculatedHas(totalHas);
    
    if (hasPrice) {
      setCalculatedTL(totalHas * parseFloat(hasPrice));
    }
  }, [formData.lines, hasPrice, poolMode, poolCalculations]);

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          product_type_code: '',
          karat_id: '',
          weight_gram: '',
          quantity: 1,
          labor_has_value: '',
          line_total_has: '',
          note: '',
        },
      ],
    }));
  };

  const removeLine = (index) => {
    if (formData.lines.length <= 1) {
      toast.warning('En az bir satır olmalı');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.party_id) {
      toast.error('Lütfen bir cari seçin');
      return;
    }
    
    // POOL MODE için farklı validasyon
    if (poolMode) {
      if (!poolFormData.karat_id) {
        toast.error('Lütfen ayar seçin');
        return;
      }
      if (!poolFormData.weight_gram || parseFloat(poolFormData.weight_gram) <= 0) {
        toast.error('Lütfen gram miktarı girin');
        return;
      }
    } else {
      if (!formData.lines[0].product_type_code) {
        toast.error('Lütfen ürün tipi seçin');
        return;
      }
    }

    setLoading(true);
    try {
      let payload;
      
      // Cash register ID for all transactions
      const cashRegId = selectedCashRegister && selectedCashRegister !== 'none' ? selectedCashRegister : null;
      
      // DÖVİZ BİLGİLERİ
      const pm = formData.payment_method_code || '';
      const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
      const paymentCurrency = pm.includes('USD') ? 'USD' : pm.includes('EUR') ? 'EUR' : 'TRY';
      
      if (poolMode) {
        // POOL MODE PAYLOAD
        const karat = karats.find(k => k.id === parseInt(poolFormData.karat_id));
        const fineness = karat?.fineness || 0.916;
        const weight = parseFloat(poolFormData.weight_gram) || 0;
        const laborPerGram = parseFloat(poolFormData.labor_per_gram) || 0;
        const totalLabor = weight * laborPerGram;
        
        payload = {
          type_code: 'PURCHASE',
          party_id: formData.party_id,
          transaction_date: new Date(formData.transaction_date).toISOString(),
          currency: formData.currency,
          total_amount_currency: parseFloat(formData.total_amount_currency) || calculatedTL,
          payment_method_code: formData.payment_method_code,
          cash_register_id: cashRegId,
          // DÖVİZ BİLGİLERİ
          payment_currency: paymentCurrency,
          foreign_amount: isForeignCurrency ? foreignEquivalent : null,
          exchange_rate: isForeignCurrency ? parseFloat(exchangeRate) : null,
          // ÖDEME FARKI SEÇİMİ
          payment_difference_action: paymentDifferenceAction,
          notes: formData.notes || `Bilezik havuza alış: ${weight}g`,
          idempotency_key: `purchase-pool-${Date.now()}`,
          meta: {
            has_price_used: parseFloat(hasPrice) || 0,
            actual_amount_tl: parseFloat(formData.total_amount_currency) || calculatedTL,
            cash_register_id: cashRegId,
          },
          lines: [{
            product_type_code: 'GOLD_BRACELET',
            karat_id: parseInt(poolFormData.karat_id),
            fineness: fineness,
            weight_gram: weight,
            quantity: weight, // POOL için quantity = gram
            labor_has_value: totalLabor,
            line_total_has: poolCalculations?.totalCostHas || 0,
            note: `Bilezik ${karat?.name || '22K'} - ${weight}g`,
          }],
        };
      } else {
        // NORMAL MODE PAYLOAD (mevcut kod)
        payload = {
          ...formData,
          transaction_date: new Date(formData.transaction_date).toISOString(),
          total_amount_currency: parseFloat(formData.total_amount_currency) || calculatedTL,
          cash_register_id: cashRegId,
          // DÖVİZ BİLGİLERİ
          payment_currency: paymentCurrency,
          foreign_amount: isForeignCurrency ? foreignEquivalent : null,
          exchange_rate: isForeignCurrency ? parseFloat(exchangeRate) : null,
          // ÖDEME FARKI SEÇİMİ
          payment_difference_action: paymentDifferenceAction,
          idempotency_key: `purchase-${Date.now()}`,
          meta: {
            ...(formData.meta || {}),
            has_price_used: parseFloat(hasPrice) || 0,
            actual_amount_tl: parseFloat(formData.total_amount_currency) || calculatedTL,
            cash_register_id: cashRegId,
          },
          lines: formData.lines.map((line) => {
            console.log('Line before send:', line);
            console.log('Line quantity:', line.quantity, 'parsed:', parseInt(line.quantity));
            
            // GRAM tipi için: weight_gram = birim_ağırlık × adet
            const birimAgirlik = parseFloat(line.weight_gram) || 0;
            const adet = parseInt(line.quantity) || 1;
            const toplamAgirlik = birimAgirlik * adet;
            
            return {
              ...line,
              product_type_code: line.product_type_code,
              karat_id: line.karat_id ? parseInt(line.karat_id) : null,
              weight_gram: toplamAgirlik,  // Toplam ağırlık (birim × adet)
              quantity: adet,
              labor_has_value: parseFloat(line.labor_has_value) || 0,
              line_total_has: parseFloat(line.line_total_has) || 0,
            };
          }),
        };
      }
      
      console.log('Full payload:', JSON.stringify(payload, null, 2));

      const result = await createFinancialTransaction(payload);
      
      if (poolMode) {
        toast.success(`Bilezik havuza eklendi! ${poolFormData.weight_gram}g`);
      } else if (result.created_products_count > 0) {
        toast.success(`İşlem başarılı! ${result.created_products_count} ürün stoğa eklendi.`);
      } else {
        toast.success('İşlem başarıyla kaydedildi');
      }
      
      onSuccess?.(result);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPartyName = (partyId) => {
    const party = parties.find(p => p.id === partyId);
    return party?.name || '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* POOL MODE TOGGLE - Bilezik Havuz Modu */}
      <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-6 h-6 text-amber-600" />
              <div>
                <Label className="text-amber-800 dark:text-amber-400 font-semibold">Bilezik Havuz Modu</Label>
                <p className="text-xs text-muted-foreground">22 ayar bilezik alışları için havuz sistemi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="poolMode" className="text-sm">Normal</Label>
              <input
                type="checkbox"
                id="poolMode"
                checked={poolMode}
                onChange={(e) => setPoolMode(e.target.checked)}
                className="w-10 h-5 rounded-full appearance-none bg-gray-300 checked:bg-amber-500 transition-colors cursor-pointer relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-5"
              />
              <Label htmlFor="poolMode" className="text-sm text-amber-600 font-semibold">Havuz</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            {poolMode ? 'Bilezik Havuza Alış' : 'Ürün Alışı (Stok Girişi)'}
          </CardTitle>
          <CardDescription>
            {poolMode 
              ? 'Bilezik havuzuna gram bazlı alış yapın. Havuzdaki tüm bilezikler ortalama maliyet ile takip edilir.'
              : 'Müşteriden veya tedarikçiden ürün alımı yapın. Alınan ürünler otomatik olarak stoğa eklenecektir.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tarih */}
          <div className="space-y-2">
            <Label>İşlem Tarihi</Label>
            <Input
              type="date"
              value={formData.transaction_date}
              onChange={(e) => handleChange('transaction_date', e.target.value)}
              required
            />
          </div>

          {/* Cari Seçimi */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Kimden Alınıyor?
            </Label>
            <SearchableSelect
              options={parties.map(p => ({
                value: p.id,
                label: `${p.name} ${p.party_type_id === 2 ? '(Tedarikçi)' : '(Müşteri)'}`
              }))}
              value={formData.party_id}
              onChange={(value) => handleChange('party_id', value)}
              placeholder="Cari ara ve seç..."
              noOptionsMessage="Cari bulunamadı"
            />
          </div>

          {/* Para Birimi */}
          <div className="space-y-2">
            <Label>Para Birimi</Label>
            <Select 
              value={formData.currency} 
              onValueChange={(value) => {
                handleChange('currency', value);
                setSelectedCashRegister(''); // Reset kasa when currency changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Para birimi seçin" />
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

          {/* Ödeme Yöntemi */}
          <div className="space-y-2">
            <Label>Ödeme Yöntemi</Label>
            <Select
              value={formData.payment_method_code}
              onValueChange={(value) => {
                handleChange('payment_method_code', value);
                setSelectedCashRegister(''); // Reset kasa when payment method changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ödeme yöntemi seçin" />
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

          {/* Kasa Seçimi */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Wallet className="w-4 h-4" />
              Kasa (opsiyonel)
            </Label>
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

          {/* DÖVİZ BİLGİLERİ - Döviz seçildiğinde göster */}
          {(formData.payment_method_code?.includes('USD') || formData.payment_method_code?.includes('EUR')) && (
            <div className="col-span-full p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium">
                <Coins className="w-5 h-5" />
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
                    value={new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(parseFloat(formData.total_amount_currency) || calculatedTL || 0)}
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
        </CardContent>
      </Card>

      {/* HAS Fiyatı */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="w-5 h-5" />
            Güncel HAS Fiyatı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>1 gr HAS = TL</Label>
              <Input
                type="number"
                step="0.01"
                value={hasPrice}
                onChange={(e) => setHasPrice(e.target.value)}
                placeholder="Örn: 5869.36"
              />
            </div>
            {priceSnapshot && (
              <div className="text-sm text-muted-foreground">
                Anlık: {priceSnapshot.has_buy_tl?.toFixed(2)} TL (Alış)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* POOL MODE UI - Bilezik Havuz Alışı */}
      {poolMode && (
        <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-700 dark:text-amber-400">
              <Layers className="w-5 h-5" />
              Bilezik Havuza Alış
            </CardTitle>
            <CardDescription>
              Altın Bilezik 22K - Havuz Sistemi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mevcut Havuz Bilgisi */}
            {poolInfo && (
              <div className="p-4 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">Mevcut Havuz Durumu</div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Toplam Stok</div>
                    <div className="text-xl font-bold text-amber-600">{poolInfo.total_weight?.toFixed(2) || '0.00'} g</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Toplam Maliyet</div>
                    <div className="text-xl font-bold text-amber-600">{poolInfo.total_cost_has?.toFixed(4) || '0.0000'} HAS</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ort. Maliyet/gr</div>
                    <div className="text-xl font-bold text-amber-600">{poolInfo.avg_cost_per_gram?.toFixed(4) || '0.0000'} HAS</div>
                  </div>
                </div>
              </div>
            )}

            {/* Alış Formu */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Ayar Seçimi */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">Ayar *</Label>
                <Select
                  value={poolFormData.karat_id?.toString() || ''}
                  onValueChange={(value) => setPoolFormData(prev => ({ ...prev, karat_id: value }))}
                >
                  <SelectTrigger className="border-amber-300">
                    <SelectValue placeholder="Ayar seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {karats.map((k) => (
                      <SelectItem key={k.id} value={k.id.toString()}>
                        {k.karat} ({(k.fineness * 1000).toFixed(0)} milyem)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gram Miktarı */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">Alış Miktarı (gram) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="border-amber-300 text-lg font-mono"
                  value={poolFormData.weight_gram}
                  onChange={(e) => setPoolFormData(prev => ({ ...prev, weight_gram: e.target.value }))}
                  placeholder="Örn: 100.50"
                />
              </div>

              {/* İşçilik HAS/gr */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">İşçilik (HAS/gr)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="border-amber-300"
                  value={poolFormData.labor_per_gram}
                  onChange={(e) => setPoolFormData(prev => ({ ...prev, labor_per_gram: e.target.value }))}
                  placeholder="Örn: 0.05"
                />
              </div>

              {/* Toplam HAS */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">Toplam Maliyet (HAS)</Label>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-md text-center">
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {poolCalculations?.totalCostHas?.toFixed(4) || '0.0000'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hesaplama Detayları */}
            {poolCalculations && poolCalculations.weight > 0 && (
              <div className="p-4 bg-white dark:bg-background rounded-lg border space-y-3">
                <div className="text-sm font-medium">Hesaplama Detayları</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">Ağırlık HAS</div>
                    <div className="font-mono">{poolCalculations.weight?.toFixed(2)}g × {poolCalculations.fineness?.toFixed(3)} = <strong>{poolCalculations.materialHas?.toFixed(4)}</strong></div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">İşçilik HAS</div>
                    <div className="font-mono">{poolCalculations.weight?.toFixed(2)}g × {(parseFloat(poolFormData.labor_per_gram) || 0)?.toFixed(3)} = <strong>{poolCalculations.laborHas?.toFixed(4)}</strong></div>
                  </div>
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                    <div className="text-xs text-muted-foreground">Toplam Maliyet</div>
                    <div className="font-mono font-bold text-amber-700">{poolCalculations.totalCostHas?.toFixed(4)} HAS</div>
                  </div>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                    <div className="text-xs text-muted-foreground">TL Karşılığı</div>
                    <div className="font-mono font-bold text-green-700">{poolCalculations.totalTL?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</div>
                  </div>
                </div>

                {/* Havuz Sonrası */}
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-2">Alış Sonrası Havuz Durumu</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-center">
                      <div className="text-xs text-muted-foreground">Yeni Toplam Stok</div>
                      <div className="font-bold text-amber-600">{poolCalculations.currentPool?.toFixed(2)} → <span className="text-green-600">{poolCalculations.newPoolWeight?.toFixed(2)} g</span></div>
                    </div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-center">
                      <div className="text-xs text-muted-foreground">Yeni Toplam Maliyet</div>
                      <div className="font-bold text-amber-600">{poolCalculations.newPoolCost?.toFixed(4)} HAS</div>
                    </div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-center">
                      <div className="text-xs text-muted-foreground">Yeni Ort. Maliyet</div>
                      <div className="font-bold text-amber-600">{poolCalculations.newAvgCost?.toFixed(4)} HAS/g</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ürün Satırları - SADECE NORMAL MODDA GÖSTER */}
      {!poolMode && (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Alınan Ürünler</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-1" /> Satır Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.lines.map((line, index) => (
            <div key={index} className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Satır {index + 1}</span>
                {formData.lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Ürün Tipi */}
                <div className="space-y-1">
                  <Label className="text-xs">Ürün Tipi</Label>
                  <Select
                    value={line.product_type_code}
                    onValueChange={(value) => handleLineChange(index, 'product_type_code', value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {productTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.code}>
                          {pt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ayar */}
                <div className="space-y-1">
                  <Label className="text-xs">Ayar</Label>
                  <Select
                    value={line.karat_id?.toString() || ''}
                    onValueChange={(value) => handleLineChange(index, 'karat_id', value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {karats.map((k) => (
                        <SelectItem key={k.id} value={k.id.toString()}>
                          {k.karat} ({(k.fineness * 1000).toFixed(0)} milyem)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Birim Ağırlık */}
                <div className="space-y-1">
                  <Label className="text-xs">Birim Ağırlık (gr)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    className="h-9"
                    value={line.weight_gram}
                    onChange={(e) => handleLineChange(index, 'weight_gram', e.target.value)}
                    placeholder="Örn: 1.6"
                  />
                </div>

                {/* Adet */}
                <div className="space-y-1">
                  <Label className="text-xs">Adet</Label>
                  <Input
                    type="number"
                    min="1"
                    className="h-9"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                    placeholder="1"
                  />
                </div>

                {/* İşçilik HAS */}
                <div className="space-y-1">
                  <Label className="text-xs">İşçilik (HAS)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    className="h-9"
                    value={line.labor_has_value}
                    onChange={(e) => handleLineChange(index, 'labor_has_value', e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Toplam HAS (otomatik hesaplanan) */}
                <div className="space-y-1">
                  <Label className="text-xs">Toplam HAS</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    className="h-9 bg-muted font-mono"
                    value={line.line_total_has}
                    onChange={(e) => handleLineChange(index, 'line_total_has', e.target.value)}
                    placeholder="Otomatik"
                  />
                </div>

                {/* Açıklama */}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Açıklama</Label>
                  <Input
                    className="h-9"
                    value={line.note}
                    onChange={(e) => handleLineChange(index, 'note', e.target.value)}
                    placeholder="Örn: Çeyrek Altın, Hurda vb."
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* Özet ve Notlar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="w-5 h-5" />
            Özet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="text-xs text-muted-foreground">Toplam HAS</div>
              <div className="text-xl font-bold text-primary">{calculatedHas.toFixed(4)} gr</div>
            </div>
            <div className="p-3 bg-chart-1/10 rounded-lg">
              <div className="text-xs text-muted-foreground">TL Karşılığı</div>
              <div className="text-xl font-bold text-chart-1">
                {calculatedTL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Ödenen Tutar (TL)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.total_amount_currency}
                onChange={(e) => handleChange('total_amount_currency', e.target.value)}
                placeholder={calculatedTL.toFixed(2)}
              />
            </div>
          </div>
          
          {/* ÖDEME FARKI SEÇİMİ */}
          {(() => {
            const odenenTutar = parseFloat(formData.total_amount_currency) || 0;
            const beklenenTutar = calculatedTL;
            const fark = beklenenTutar - odenenTutar;
            
            // Fark 1 TL'den büyükse ve ödeme yapılmışsa göster
            if (Math.abs(fark) > 1 && odenenTutar > 0) {
              return (
                <div className={`border rounded-lg p-4 mt-4 ${fark > 0 ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'}`}>
                  <h4 className={`font-semibold ${fark > 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {fark > 0 
                      ? `💰 ${fark.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ eksik ödeme`
                      : `⚠️ ${Math.abs(fark).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ fazla ödeme`
                    }
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Beklenen: {beklenenTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ | Ödenen: {odenenTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                  </p>
                  
                  <div className="space-y-2">
                    <label className="flex items-center cursor-pointer p-2 rounded hover:bg-white/50 dark:hover:bg-black/20">
                      <input
                        type="radio"
                        name="farkIslem"
                        value="PROFIT_LOSS"
                        checked={paymentDifferenceAction === "PROFIT_LOSS"}
                        onChange={(e) => setPaymentDifferenceAction(e.target.value)}
                        className="mr-3 w-4 h-4"
                      />
                      <span className="text-sm">
                        {fark > 0 
                          ? `✅ Bakiye sıfırlansın (Şirket ${fark.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ KAR etti)`
                          : `✅ Bakiye sıfırlansın (Şirket ${Math.abs(fark).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ ZARAR etti)`
                        }
                      </span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer p-2 rounded hover:bg-white/50 dark:hover:bg-black/20">
                      <input
                        type="radio"
                        name="farkIslem"
                        value="CREDIT"
                        checked={paymentDifferenceAction === "CREDIT"}
                        onChange={(e) => setPaymentDifferenceAction(e.target.value)}
                        className="mr-3 w-4 h-4"
                      />
                      <span className="text-sm">
                        {fark > 0 
                          ? `📋 Müşteri alacaklandırılsın (${fark.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ borç kalsın)`
                          : `📋 Müşteriden alacaklı ol (${Math.abs(fark).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺ alacak)`
                        }
                      </span>
                    </label>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          <div className="space-y-2">
            <Label>Notlar</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="İşlemle ilgili notlar..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            İptal
          </Button>
        )}
        <Button type="submit" disabled={loading} className="min-w-32">
          {loading ? (
            <span className="animate-pulse">Kaydediliyor...</span>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Kaydet ve Stoğa Ekle
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default PurchaseForm;
