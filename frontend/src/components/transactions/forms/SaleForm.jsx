import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import SearchableSelect from '../../SearchableSelect';
import { Plus, Trash2, Save, Barcode, AlertCircle, CheckCircle, CreditCard, Percent, Wallet, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { createFinancialTransaction, getPaymentMethods, getCurrencies, getParties, getProducts, getLatestPriceSnapshot, getProductTypes, getStockPoolInfo, getKarats } from '../../../services/financialV2Service';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const SaleForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [karats, setKarats] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [hasPrice, setHasPrice] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Cash register state
  const [cashRegisters, setCashRegisters] = useState([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState('');
  
  // Payment tracking state
  const [receivedAmount, setReceivedAmount] = useState('');
  const [isCredit, setIsCredit] = useState(false); // Veresiye
  const [shortfallOption, setShortfallOption] = useState('debt'); // 'debt' (borç) or 'discount' - Default: borç olarak kalsın
  
  // DÖVIZ STATE
  const [exchangeRate, setExchangeRate] = useState('');
  const [foreignAmount, setForeignAmount] = useState('');
  const [tlEquivalent, setTlEquivalent] = useState(0);
  
  // POOL MODE STATE - Bilezik için
  const [poolMode, setPoolMode] = useState(false);
  const [poolInfo, setPoolInfo] = useState(null);
  const [poolSaleData, setPoolSaleData] = useState({
    karat_id: '',
    weight_gram: '',
    labor_per_gram: '',  // İşçilik HAS/gr (satış işçiliği)
  });
  
  const [formData, setFormData] = useState({
    type_code: 'SALE',
    party_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    currency: 'TRY',
    payment_method_code: 'CASH_TRY',
    cash_register_id: '',
    notes: '',
    lines: [],
  });

  // Helper functions to get track_type and unit with fallback to product_type
  const getTrackType = (product) => {
    if (product.track_type) return product.track_type;
    const pt = productTypes.find(p => p.id === product.product_type_id);
    return pt?.track_type || 'UNIQUE';
  };

  const getUnit = (product) => {
    if (product.unit) return product.unit;
    const pt = productTypes.find(p => p.id === product.product_type_id);
    return pt?.unit || 'GRAM';
  };

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
      const [methodsData, currenciesData, partiesData, productsData, snapshotData, productTypesData, karatsData] = await Promise.all([
        getPaymentMethods(),
        getCurrencies(),
        getParties(),
        getProducts({ stock_status_id: 1 }), // Only IN_STOCK products
        getLatestPriceSnapshot(),
        getProductTypes(),
        getKarats(),
      ]);
      setPaymentMethods(methodsData);
      setCurrencies(currenciesData);
      setParties(partiesData || []);
      setProducts(productsData || []);
      setPriceSnapshot(snapshotData);
      setProductTypes(productTypesData || []);
      setKarats(karatsData || []);
      // Set default HAS price (sell price for sale)
      if (snapshotData?.has_sell_tl) {
        setHasPrice(snapshotData.has_sell_tl.toString());
      }
    } catch (error) {
      toast.error('Lookup verileri yüklenemedi');
    }
  };

  // POOL MODE: Karat değiştiğinde havuz bilgisini yükle
  useEffect(() => {
    const loadPoolInfo = async () => {
      if (poolMode && poolSaleData.karat_id) {
        try {
          console.log('Loading pool info for karat_id:', poolSaleData.karat_id);
          const info = await getStockPoolInfo(13, parseInt(poolSaleData.karat_id)); // 13 = GOLD_BRACELET
          console.log('Pool info received:', info);
          if (info) {
            setPoolInfo(info);
          } else {
            console.warn('No pool info returned');
            setPoolInfo({ total_weight: 0, total_cost_has: 0, avg_cost_per_gram: 0 });
          }
        } catch (error) {
          console.error('Pool info error:', error);
          setPoolInfo({ total_weight: 0, total_cost_has: 0, avg_cost_per_gram: 0 });
        }
      } else if (!poolMode) {
        setPoolInfo(null);
      }
    };
    loadPoolInfo();
  }, [poolMode, poolSaleData.karat_id]);

  // POOL MODE: Açıldığında default işçiliği set et (GOLD_BRACELET = 13)
  useEffect(() => {
    if (poolMode && productTypes.length > 0 && !poolSaleData.labor_per_gram) {
      const braceletType = productTypes.find(pt => pt.code === 'GOLD_BRACELET' || pt.id === 13);
      if (braceletType && braceletType.default_labor_rate !== undefined) {
        setPoolSaleData(prev => ({
          ...prev,
          labor_per_gram: braceletType.default_labor_rate.toString()
        }));
        console.log('Set default labor rate for bracelet:', braceletType.default_labor_rate);
      }
    }
  }, [poolMode, productTypes]);

  // DÖVİZ: Ödeme yöntemi değiştiğinde kuru set et
  useEffect(() => {
    const pm = formData.payment_method_code || '';
    if (pm.includes('USD') && priceSnapshot) {
      // USD kuru (varsa snapshot'tan, yoksa default)
      const usdRate = priceSnapshot.usd_sell || priceSnapshot.usd_buy || 42.50;
      setExchangeRate(usdRate.toString());
    } else if (pm.includes('EUR') && priceSnapshot) {
      // EUR kuru
      const eurRate = priceSnapshot.eur_sell || priceSnapshot.eur_buy || 46.00;
      setExchangeRate(eurRate.toString());
    } else {
      setExchangeRate('');
      setForeignAmount('');
      setTlEquivalent(0);
    }
  }, [formData.payment_method_code, priceSnapshot]);

  // DÖVİZ: Döviz tutarı veya kur değişince TL karşılığını hesapla
  useEffect(() => {
    const rate = parseFloat(exchangeRate) || 0;
    const amount = parseFloat(foreignAmount) || 0;
    const tlValue = amount * rate;
    setTlEquivalent(tlValue);
  }, [foreignAmount, exchangeRate]);

  // POOL MODE: Satış hesaplamaları
  const poolSaleCalculations = useMemo(() => {
    if (!poolMode || !poolSaleData.karat_id || !poolInfo) return null;
    
    const weight = parseFloat(poolSaleData.weight_gram) || 0;
    const laborPerGram = parseFloat(poolSaleData.labor_per_gram) || 0;
    const karat = karats.find(k => k.id === parseInt(poolSaleData.karat_id));
    const fineness = karat?.fineness || 0.916;
    const hasPriceNum = parseFloat(hasPrice) || 0;
    
    // Satış HAS = (gram × milyem) + (gram × işçilik)
    const materialHas = weight * fineness;
    const laborHas = weight * laborPerGram;
    const saleHas = materialHas + laborHas;
    const saleTL = saleHas * hasPriceNum;
    
    // Maliyet (havuzdaki ortalama maliyet üzerinden)
    const avgCost = poolInfo?.avg_cost_per_gram || 0;
    const costHas = weight * avgCost;
    const costTL = costHas * hasPriceNum;
    
    // Kâr
    const profitHas = saleHas - costHas;
    const profitTL = profitHas * hasPriceNum;
    
    // Havuz sonrası
    const currentPool = poolInfo?.total_weight || 0;
    const newPoolWeight = currentPool - weight;
    
    return {
      weight,
      fineness,
      materialHas,
      laborHas,
      saleHas,
      saleTL,
      costHas,
      costTL,
      profitHas,
      profitTL,
      avgCost,
      currentPool,
      newPoolWeight,
      hasPriceNum,
    };
  }, [poolMode, poolSaleData, karats, poolInfo, hasPrice]);

  // Calculate totals
  const calculations = useMemo(() => {
    const hasPriceNum = parseFloat(hasPrice) || 0;
    
    // POOL mode için pool hesaplamalarını kullan
    if (poolMode && poolSaleCalculations) {
      const totalHAS = poolSaleCalculations.saleHas;
      const expectedTL = poolSaleCalculations.saleTL;
      const receivedTL = isCredit ? 0 : (parseFloat(receivedAmount) || 0);
      const differenceTL = expectedTL - receivedTL;
      const differenceHAS = hasPriceNum > 0 ? differenceTL / hasPriceNum : 0;
      const hasShortfall = differenceTL > 0.01 && !isCredit;
      
      let discountTL = 0, discountHAS = 0, debtHAS = 0;
      if (isCredit) {
        debtHAS = totalHAS;
      } else if (hasShortfall) {
        if (shortfallOption === 'discount') {
          discountTL = differenceTL;
          discountHAS = differenceHAS;
        } else {
          debtHAS = differenceHAS;
        }
      }
      
      const collectedHAS = hasPriceNum > 0 ? receivedTL / hasPriceNum : 0;
      
      return {
        totalHAS,
        expectedTL,
        receivedTL,
        differenceTL,
        differenceHAS,
        hasShortfall,
        discountTL,
        discountHAS,
        debtHAS,
        collectedHAS,
        hasPriceNum,
      };
    }
    
    // Calculate total HAS from selected products (with FIFO/FIFO_LOT quantity support)
    let totalHAS = 0;
    formData.lines.forEach(line => {
      const product = Array.isArray(products) ? products.find(p => p.id === line.product_id) : null;
      if (product) {
        // Use helper function with fallback to productTypes
        const trackType = getTrackType(product);
        const quantity = parseFloat(line.quantity) || 1;
        
        // FIFO veya FIFO_LOT ürünler parçalı satılabilir
        if (trackType === 'FIFO' || trackType === 'FIFO_LOT') {
          // Parçalı satış: birim HAS * satış miktarı
          const totalQty = product.quantity || 1;
          const totalSaleHas = product.sale_has_value || product.total_cost_has || 0;
          const unitHas = product.unit_has || (totalSaleHas / totalQty);
          totalHAS += unitHas * quantity;
        } else {
          // UNIQUE: tüm ürün
          totalHAS += (product.sale_has_value || 0);
        }
      }
    });
    
    // Expected amount in TL
    const expectedTL = totalHAS * hasPriceNum;
    
    // Received amount - DÖVİZ İÇİN TL KARŞILIĞINI KULLAN
    const pm = formData.payment_method_code || '';
    const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
    let receivedTL = 0;
    
    if (isCredit) {
      receivedTL = 0;
    } else if (isForeignCurrency) {
      // Döviz ile ödeme: TL karşılığını kullan
      receivedTL = tlEquivalent || 0;
    } else {
      // Normal TL ödeme
      receivedTL = parseFloat(receivedAmount) || 0;
    }
    
    // Difference calculation
    const differenceTL = expectedTL - receivedTL;
    const differenceHAS = hasPriceNum > 0 ? differenceTL / hasPriceNum : 0;
    
    // Determine if there's a shortfall
    const hasShortfall = differenceTL > 0.01 && !isCredit;
    
    // Calculate discount or debt based on option
    let discountTL = 0;
    let discountHAS = 0;
    let debtHAS = 0;
    
    if (isCredit) {
      // Full credit sale - entire amount is debt
      debtHAS = totalHAS;
    } else if (hasShortfall) {
      if (shortfallOption === 'discount') {
        discountTL = differenceTL;
        discountHAS = differenceHAS;
        debtHAS = 0;
      } else {
        discountTL = 0;
        discountHAS = 0;
        debtHAS = differenceHAS;
      }
    }
    
    // Collected HAS (what we actually received in HAS equivalent)
    const collectedHAS = hasPriceNum > 0 ? receivedTL / hasPriceNum : 0;
    
    return {
      totalHAS,
      expectedTL,
      receivedTL,
      differenceTL,
      differenceHAS,
      hasShortfall,
      discountTL,
      discountHAS,
      debtHAS,
      collectedHAS,
      hasPriceNum,
      // Döviz bilgisi
      isForeignCurrency,
      foreignAmount: isForeignCurrency ? (parseFloat(foreignAmount) || 0) : 0,
      exchangeRate: isForeignCurrency ? (parseFloat(exchangeRate) || 0) : 0,
      paymentCurrency: pm.includes('USD') ? 'USD' : pm.includes('EUR') ? 'EUR' : 'TRY',
    };
  }, [formData.lines, formData.payment_method_code, products, productTypes, hasPrice, receivedAmount, isCredit, shortfallOption, poolMode, poolSaleCalculations, tlEquivalent, foreignAmount, exchangeRate]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index, field, value) => {
    setFormData((prev) => {
      const newLines = [...prev.lines];
      newLines[index] = { ...newLines[index], [field]: value };
      return { ...prev, lines: newLines };
    });
  };

  const handleProductSelect = (index, productId) => {
    const product = Array.isArray(products) ? products.find(p => p.id === productId) : null;
    if (product) {
      // Use helper functions with fallback to productTypes
      const trackType = getTrackType(product);
      const unit = getUnit(product);
      const remainingQty = product.remaining_quantity || product.quantity || 1;
      
      // FIFO ürünler için birim HAS hesapla
      const totalQty = product.quantity || 1;
      const totalSaleHas = product.sale_has_value || product.total_cost_has || 0;
      const unitHas = product.unit_has || (totalSaleHas / totalQty);
      
      // Varsayılan miktar: FIFO ise 1, değilse 1
      const defaultQty = 1;
      
      setFormData((prev) => {
        const newLines = [...prev.lines];
        newLines[index] = {
          ...newLines[index],
          product_id: productId,
          unit_price_currency: product.sale_has_value || 0,
          line_amount_currency: (product.sale_has_value || 0) * calculations.hasPriceNum,
          quantity: defaultQty,
          unit_has: unitHas,
          track_type: trackType,
          remaining_quantity: remainingQty,
          unit: unit,
          total_quantity: totalQty,
          note: `${product.name} - ${product.barcode || 'N/A'}`,
        };
        return { ...prev, lines: newLines };
      });
    }
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) {
      toast.error('Lütfen barkod giriniz');
      return;
    }

    try {
      const product = Array.isArray(products) ? products.find(p => p.barcode === barcodeInput.trim()) : null;
      
      if (!product) {
        toast.error('Barkod ile eşleşen ürün bulunamadı');
        return;
      }

      // Check if product already in lines
      const existingLineIndex = formData.lines.findIndex(line => line.product_id === product.id);
      
      if (existingLineIndex >= 0) {
        toast.info('Bu ürün zaten eklendi');
        return;
      }

      // Add product to lines
      setFormData((prev) => ({
        ...prev,
        lines: [
          ...prev.lines,
          {
            product_id: product.id,
            unit_price_currency: product.sale_has_value || 0,
            line_amount_currency: (product.sale_has_value || 0) * calculations.hasPriceNum,
            quantity: 1,
            note: `${product.name} - ${product.barcode}`,
          },
        ],
      }));

      setBarcodeInput('');
      toast.success(`Ürün eklendi: ${product.name}`);
    } catch (error) {
      toast.error('Ürün arama hatası');
    }
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          product_id: '',
          unit_price_currency: '',
          line_amount_currency: '',
          quantity: 1,
          note: '',
        },
      ],
    }));
  };

  const removeLine = (index) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  // Auto-fill received amount when expected changes (for convenience)
  useEffect(() => {
    if (calculations.expectedTL > 0 && !receivedAmount && !isCredit) {
      setReceivedAmount(calculations.expectedTL.toFixed(2));
    }
  }, [calculations.expectedTL]);

  // Reset received amount when credit is toggled
  useEffect(() => {
    if (isCredit) {
      setReceivedAmount('0');
    }
  }, [isCredit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.party_id) {
      toast.error('Müşteri seçimi gereklidir');
      return;
    }

    // POOL MODE için farklı validasyon
    if (poolMode) {
      if (!poolSaleData.karat_id) {
        toast.error('Lütfen ayar seçin');
        return;
      }
      if (!poolSaleData.weight_gram || parseFloat(poolSaleData.weight_gram) <= 0) {
        toast.error('Lütfen gram miktarı girin');
        return;
      }
      const weight = parseFloat(poolSaleData.weight_gram);
      const available = poolInfo?.total_weight || 0;
      if (weight > available) {
        toast.error(`Yetersiz havuz stoğu! Mevcut: ${available.toFixed(2)}g`);
        return;
      }
    } else {
      if (!formData.lines || formData.lines.length === 0) {
        toast.error('En az bir ürün eklenmelidir');
        return;
      }

      // Check all lines have product_id
      const missingProduct = formData.lines.some(line => !line.product_id);
      if (missingProduct) {
        toast.error('Tüm satırlar için ürün seçimi gereklidir');
        return;
      }

      // Validate FIFO product quantities
      for (const line of formData.lines) {
        const product = Array.isArray(products) ? products.find(p => p.id === line.product_id) : null;
        if (product) {
          // Use helper function with fallback to productTypes
          const trackType = getTrackType(product);
          const unit = getUnit(product);
          
          if (trackType === 'FIFO') {
            const qty = parseFloat(line.quantity);
            const isGram = unit === 'GRAM';
            const minQty = isGram ? 0.01 : 1;
            const unitLabel = isGram ? 'gram' : 'adet';
            
            if (isNaN(qty) || qty < minQty) {
              toast.error(`"${product.name}" için satış miktarı girmelisiniz! (min: ${minQty} ${unitLabel})`);
              return;
            }
            
            if (!isGram && !Number.isInteger(qty)) {
              toast.error(`"${product.name}" için tam sayı adet girmelisiniz!`);
              return;
            }
          }
        }
      }
    }

    setLoading(true);
    try {
      let payload;
      
      if (poolMode) {
        // POOL MODE PAYLOAD - Bilezik satışı
        const karat = karats.find(k => k.id === parseInt(poolSaleData.karat_id));
        const fineness = karat?.fineness || 0.916;
        const weight = parseFloat(poolSaleData.weight_gram) || 0;
        const laborPerGram = parseFloat(poolSaleData.labor_per_gram) || 0;
        
        // Havuzdaki bir ürünü bul (POOL track_type olan)
        const poolProduct = Array.isArray(products) ? products.find(p => 
          p.product_type_id === 13 && // GOLD_BRACELET
          p.track_type === 'POOL'
        ) : null;
        
        payload = {
          type_code: 'SALE',
          party_id: formData.party_id,
          transaction_date: new Date(formData.transaction_date).toISOString(),
          currency: formData.currency,
          payment_method_code: formData.payment_method_code,
          cash_register_id: selectedCashRegister || null,
          notes: formData.notes || `Bilezik havuzdan satış: ${weight}g`,
          expected_amount_tl: calculations.expectedTL,
          actual_amount_tl: calculations.receivedTL,
          discount_tl: calculations.discountTL,
          discount_has: calculations.discountHAS,
          sale_has_value: poolSaleCalculations?.saleHas || 0,
          collected_has: calculations.collectedHAS,
          total_has_amount: -(poolSaleCalculations?.saleHas || 0),
          customer_debt_has: calculations.debtHAS,
          is_credit_sale: isCredit,
          has_price_used: calculations.hasPriceNum,
          total_amount_currency: calculations.receivedTL,
          idempotency_key: `sale-pool-${Date.now()}`,
          lines: [{
            product_id: poolProduct?.id || null,
            product_type_code: 'GOLD_BRACELET',
            karat_id: parseInt(poolSaleData.karat_id),
            fineness: fineness,
            weight_gram: weight,
            quantity: weight,
            labor_has_value: laborPerGram * weight,
            unit_price_currency: poolSaleCalculations?.saleHas || 0,
            line_amount_currency: poolSaleCalculations?.saleTL || 0,
            note: `Bilezik ${karat?.name || '22K'} - ${weight}g`,
          }],
        };
      } else {
        // NORMAL MODE PAYLOAD (mevcut kod)
        // Döviz bilgilerini al
        const pm = formData.payment_method_code || '';
        const isForeignCurrency = pm.includes('USD') || pm.includes('EUR');
        const paymentCurrency = pm.includes('USD') ? 'USD' : pm.includes('EUR') ? 'EUR' : 'TRY';
        
        payload = {
          ...formData,
          // Sale-specific fields
          expected_amount_tl: calculations.expectedTL,
          actual_amount_tl: calculations.receivedTL,
          discount_tl: calculations.discountTL,
          discount_has: calculations.discountHAS,
          sale_has_value: calculations.totalHAS,
          collected_has: calculations.collectedHAS,
          total_has_amount: -calculations.totalHAS, // Negative for sale (stock out)
          customer_debt_has: calculations.debtHAS,
          is_credit_sale: isCredit,
          has_price_used: calculations.hasPriceNum,
          total_amount_currency: calculations.receivedTL,
          cash_register_id: selectedCashRegister || null,
          // DÖVİZ BİLGİLERİ
          payment_currency: paymentCurrency,
          foreign_amount: isForeignCurrency ? (parseFloat(foreignAmount) || 0) : null,
          exchange_rate: isForeignCurrency ? (parseFloat(exchangeRate) || 0) : null,
          tl_equivalent: isForeignCurrency ? tlEquivalent : null,
          lines: formData.lines.map((line) => {
            const product = Array.isArray(products) ? products.find(p => p.id === line.product_id) : null;
            // Use helper function with fallback to productTypes
            const unit = product ? getUnit(product) : 'GRAM';
            const isGram = unit === 'GRAM';
            const qty = parseFloat(line.quantity) || 1;
            return {
              ...line,
              unit_price_currency: line.unit_price_currency ? parseFloat(line.unit_price_currency) : null,
              line_amount_currency: line.line_amount_currency ? parseFloat(line.line_amount_currency) : null,
              quantity: isGram ? qty : Math.floor(qty),  // Gram: float, Adet: int
              product_has_value: product?.sale_has_value || 0,
            };
          }),
          idempotency_key: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
      }

      const result = await createFinancialTransaction(payload);
      
      // Show appropriate success message
      if (poolMode) {
        toast.success(`Bilezik havuzdan satıldı! ${poolSaleData.weight_gram}g - Kâr: ${poolSaleCalculations?.profitHas?.toFixed(4) || 0} HAS`);
      } else if (isCredit) {
        toast.success(`Veresiye satış kaydedildi! Müşteri borcu: ${calculations.totalHAS.toFixed(4)} HAS`);
      } else if (calculations.discountTL > 0) {
        toast.success(`Satış kaydedildi! İskonto: ${calculations.discountTL.toFixed(2)} TL`);
      } else if (calculations.debtHAS > 0) {
        toast.success(`Satış kaydedildi! Müşteri borcu: ${calculations.debtHAS.toFixed(4)} HAS`);
      } else {
        toast.success('Satış işlemi başarıyla tamamlandı!');
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
      {/* POOL MODE TOGGLE - Bilezik Havuz Satışı */}
      <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-6 h-6 text-amber-600" />
              <div>
                <Label className="text-amber-800 dark:text-amber-400 font-semibold">Bilezik Havuz Satışı</Label>
                <p className="text-xs text-muted-foreground">22 ayar bilezik satışları için havuz sistemi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="poolSaleMode" className="text-sm">Normal</Label>
              <input
                type="checkbox"
                id="poolSaleMode"
                checked={poolMode}
                onChange={(e) => {
                  const isPoolMode = e.target.checked;
                  setPoolMode(isPoolMode);
                  // Pool mode açıldığında varsayılan 22K seç
                  if (isPoolMode && !poolSaleData.karat_id) {
                    const karat22 = karats.find(k => k.karat === '22K');
                    if (karat22) {
                      setPoolSaleData(prev => ({ ...prev, karat_id: karat22.id.toString() }));
                    }
                  }
                }}
                className="w-10 h-5 rounded-full appearance-none bg-gray-300 checked:bg-amber-500 transition-colors cursor-pointer relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-5"
              />
              <Label htmlFor="poolSaleMode" className="text-sm text-amber-600 font-semibold">Havuz</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HAS Price Display */}
      {priceSnapshot && (
        <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-green-800 dark:text-green-400">HAS Altın Satış Fiyatı (TL/gr)</Label>
                <p className="text-xs text-muted-foreground">Satış işleminde kullanılacak</p>
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

      {/* POOL MODE UI - Bilezik Havuzdan Satış */}
      {poolMode && (
        <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-700 dark:text-amber-400">
              <Layers className="w-5 h-5" />
              Bilezik Havuzdan Satış
            </CardTitle>
            <CardDescription>
              Altın Bilezik 22K - Terazi ile tartarak gram bazlı satış
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mevcut Havuz Bilgisi */}
            {poolInfo && (
              <div className="p-4 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">Mevcut Havuz Stoğu</div>
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

            {/* Satış Formu */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Ayar Seçimi */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">Ayar *</Label>
                <Select
                  value={poolSaleData.karat_id?.toString() || ''}
                  onValueChange={(value) => setPoolSaleData(prev => ({ ...prev, karat_id: value }))}
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

              {/* Gram Miktarı (Terazi) */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">Satış Miktarı (gram) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={poolInfo?.total_weight || 9999}
                  className="border-amber-300 text-lg font-mono"
                  value={poolSaleData.weight_gram}
                  onChange={(e) => setPoolSaleData(prev => ({ ...prev, weight_gram: e.target.value }))}
                  placeholder="Terazi değeri"
                />
                {poolInfo && parseFloat(poolSaleData.weight_gram) > poolInfo.total_weight && (
                  <p className="text-xs text-red-500">⚠️ Yetersiz stok! Max: {poolInfo.total_weight?.toFixed(2)}g</p>
                )}
              </div>

              {/* İşçilik HAS/gr */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">İşçilik (HAS/gr)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="border-amber-300"
                  value={poolSaleData.labor_per_gram}
                  onChange={(e) => setPoolSaleData(prev => ({ ...prev, labor_per_gram: e.target.value }))}
                  placeholder="Örn: 0.06"
                />
              </div>

              {/* Satış HAS */}
              <div className="space-y-2">
                <Label className="text-amber-700 dark:text-amber-400">Satış Tutarı (HAS)</Label>
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-md text-center">
                  <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {poolSaleCalculations?.saleHas?.toFixed(4) || '0.0000'}
                  </span>
                </div>
              </div>
            </div>

            {/* Hesaplama Detayları */}
            {poolSaleCalculations && poolSaleCalculations.weight > 0 && (
              <div className="p-4 bg-white dark:bg-background rounded-lg border space-y-3">
                <div className="text-sm font-medium">Hesaplama Detayları</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">Ağırlık HAS</div>
                    <div className="font-mono text-xs">{poolSaleCalculations.weight?.toFixed(2)}g × {poolSaleCalculations.fineness?.toFixed(3)}</div>
                    <div className="font-bold">{poolSaleCalculations.materialHas?.toFixed(4)}</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-xs text-muted-foreground">İşçilik HAS</div>
                    <div className="font-mono text-xs">{poolSaleCalculations.weight?.toFixed(2)}g × {(parseFloat(poolSaleData.labor_per_gram) || 0)?.toFixed(3)}</div>
                    <div className="font-bold">{poolSaleCalculations.laborHas?.toFixed(4)}</div>
                  </div>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                    <div className="text-xs text-muted-foreground">Satış HAS</div>
                    <div className="font-bold text-green-700">{poolSaleCalculations.saleHas?.toFixed(4)}</div>
                    <div className="text-xs text-green-600">{poolSaleCalculations.saleTL?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</div>
                  </div>
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
                    <div className="text-xs text-muted-foreground">Maliyet HAS</div>
                    <div className="font-bold text-red-700">{poolSaleCalculations.costHas?.toFixed(4)}</div>
                    <div className="text-xs text-red-600">{poolSaleCalculations.costTL?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</div>
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <div className="text-xs text-muted-foreground">Tahmini Kâr</div>
                    <div className={`font-bold ${poolSaleCalculations.profitHas >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {poolSaleCalculations.profitHas?.toFixed(4)} HAS
                    </div>
                    <div className={`text-xs ${poolSaleCalculations.profitTL >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {poolSaleCalculations.profitTL?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                    </div>
                  </div>
                </div>

                {/* Havuz Sonrası */}
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-2">Satış Sonrası Havuz</div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded flex-1 text-center">
                      <div className="text-xs text-muted-foreground">Mevcut Stok</div>
                      <div className="font-bold text-amber-600">{poolSaleCalculations.currentPool?.toFixed(2)} g</div>
                    </div>
                    <span className="text-2xl text-muted-foreground">→</span>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded flex-1 text-center">
                      <div className="text-xs text-muted-foreground">Satış Sonrası</div>
                      <div className={`font-bold ${poolSaleCalculations.newPoolWeight >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                        {poolSaleCalculations.newPoolWeight?.toFixed(2)} g
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Barcode Search - SADECE NORMAL MODDA */}
      {!poolMode && (
      <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-blue-800 dark:text-blue-400">Barkod ile Ürün Ekle</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Barkod numarasını girin..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBarcodeSearch())}
                  className="flex-1"
                />
                <Button type="button" onClick={handleBarcodeSearch} variant="outline">
                  <Barcode className="w-4 h-4 mr-2" />
                  Ara
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Customer & Date Selection */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>{poolMode ? 'Bilezik Satışı' : 'Satış İşlemi (SALE)'}</CardTitle>
          <CardDescription>{poolMode ? 'Müşteriye bilezik havuzdan satış' : 'Müşteriye ürün satışı'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Müşteri *</Label>
              <SearchableSelect
                options={parties.map(p => ({ value: p.id, label: p.name }))}
                value={formData.party_id}
                onChange={(value) => handleChange('party_id', value)}
                placeholder="Müşteri ara ve seç..."
                noOptionsMessage="Müşteri bulunamadı"
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
        </CardContent>
      </Card>

      {/* Products Section - SADECE NORMAL MODDA */}
      {!poolMode && (
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Satılan Ürünler</CardTitle>
              <CardDescription>{formData.lines.length} ürün seçildi</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-2" />
              Ürün Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.lines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Henüz ürün eklenmedi.</p>
              <p className="text-sm">Barkod ile arayın veya Ürün Ekle butonuna tıklayın.</p>
            </div>
          ) : (
            formData.lines.map((line, index) => {
              const selectedProduct = Array.isArray(products) ? products.find(p => p.id === line.product_id) : null;
              
              // Use helper functions with fallback to productTypes
              const trackType = selectedProduct ? getTrackType(selectedProduct) : (line.track_type || 'UNIQUE');
              const unit = selectedProduct ? getUnit(selectedProduct) : (line.unit || 'PIECE');
              
              // FIFO ürünler parçalı satılabilir (GRAM veya PIECE fark etmez)
              const showPartialSale = trackType === 'FIFO';
              
              // Unit'e göre input ayarları
              const isGramBased = unit === 'GRAM';
              const unitLabel = isGramBased ? 'gram' : 'adet';
              const inputStep = isGramBased ? 0.01 : 1;
              const inputMin = isGramBased ? 0.01 : 1;
              
              const remainingQty = line.remaining_quantity || selectedProduct?.remaining_quantity || selectedProduct?.quantity || 1;
              
              // Birim HAS hesapla
              const totalQty = line.total_quantity || selectedProduct?.quantity || 1;
              const totalSaleHas = selectedProduct?.sale_has_value || selectedProduct?.total_cost_has || 0;
              const unitHas = line.unit_has || selectedProduct?.unit_has || (totalSaleHas / totalQty);
              
              const lineQuantity = parseFloat(line.quantity) || 1;
              const lineHas = showPartialSale ? unitHas * lineQuantity : totalSaleHas;
              
              return (
                <div key={index} className="p-4 border border-primary/20 rounded-lg space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Ürün #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ürün *</Label>
                      <SearchableSelect
                        options={products.map((product) => {
                          const pTrack = getTrackType(product);
                          const pUnit = getUnit(product);
                          const pRemaining = product.remaining_quantity || product.quantity || 1;
                          const pUnitLabel = pUnit === 'GRAM' ? 'gram' : 'adet';
                          const showStock = pTrack === 'FIFO';
                          return {
                            value: product.id,
                            label: `${product.name} - ${product.barcode || 'N/A'}${showStock ? ` (Stok: ${pUnit === 'GRAM' ? pRemaining.toFixed(2) : Math.floor(pRemaining)} ${pUnitLabel})` : ''}`
                          };
                        })}
                        value={line.product_id}
                        onChange={(value) => handleProductSelect(index, value)}
                        placeholder="Ürün ara ve seç..."
                        noOptionsMessage="Ürün bulunamadı"
                      />
                    </div>

                    {/* FIFO ürünler için parçalı satış miktar girişi */}
                    {selectedProduct && showPartialSale && (
                      <div className="space-y-2">
                        <Label className="text-blue-600 dark:text-blue-400 font-semibold">
                          📦 Satış Miktarı ({unitLabel}) *
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={inputMin}
                            max={remainingQty}
                            step={inputStep}
                            value={line.quantity ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Boş bırakılabilir (kullanıcı silip yazacak)
                              if (value === '') {
                                handleLineChange(index, 'quantity', '');
                                return;
                              }
                              
                              let numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                // Adet için tam sayıya yuvarla
                                if (!isGramBased) {
                                  numValue = Math.floor(numValue);
                                }
                                // Max kontrolü
                                if (numValue > remainingQty) {
                                  toast.error(`Maksimum ${isGramBased ? remainingQty.toFixed(2) : Math.floor(remainingQty)} ${unitLabel} satılabilir`);
                                  numValue = remainingQty;
                                }
                                handleLineChange(index, 'quantity', numValue);
                              }
                            }}
                            onBlur={(e) => {
                              // Blur'da min kontrolü
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val < inputMin) {
                                handleLineChange(index, 'quantity', inputMin);
                              }
                            }}
                            placeholder={isGramBased ? 'Kaç gram?' : 'Kaç adet?'}
                            className="flex-1 text-lg font-mono border-blue-500"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            / {isGramBased ? remainingQty.toFixed(2) : Math.floor(remainingQty)} {unitLabel}
                          </span>
                        </div>
                        <p className="text-xs text-blue-500">
                          Birim HAS: {unitHas?.toFixed(4)} HAS/{unitLabel}
                        </p>
                      </div>
                    )}

                    {selectedProduct && (
                      <div className={`space-y-1 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg ${showPartialSale ? 'md:col-span-2' : ''}`}>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {showPartialSale ? `Satış HAS (${isGramBased ? lineQuantity.toFixed(2) : Math.floor(lineQuantity)} ${unitLabel}):` : 'HAS Değeri:'}
                          </span>
                          <span className="font-semibold text-yellow-600">{lineHas?.toFixed(4)} HAS</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">TL Karşılığı:</span>
                          <span className="font-semibold text-green-600">
                            {formatTL(lineHas * calculations.hasPriceNum)} ₺
                          </span>
                        </div>
                        {showPartialSale && (
                          <div className="flex justify-between text-sm border-t pt-1 mt-1">
                            <span className="text-muted-foreground">Satış sonrası kalan:</span>
                            <span className="font-semibold text-orange-600">
                              {isGramBased ? (remainingQty - lineQuantity).toFixed(2) : Math.floor(remainingQty - lineQuantity)} {unitLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      )}

      {/* Payment Section - Show for both POOL and normal mode */}
      {((poolMode && poolSaleCalculations?.saleHas > 0) || (!poolMode && formData.lines.length > 0 && calculations.totalHAS > 0)) && (
        <Card className="border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Ödeme Bilgileri
            </CardTitle>
            <CardDescription>Satış tutarı ve tahsilat</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white dark:bg-background rounded-lg border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Toplam HAS</p>
                <p className="text-xl font-bold text-primary">{calculations.totalHAS.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Beklenen Tutar</p>
                <p className="text-xl font-bold text-green-600">{formatTL(calculations.expectedTL)} ₺</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Alınan Tutar</p>
                <p className="text-xl font-bold text-blue-600">{formatTL(calculations.receivedTL)} ₺</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {calculations.discountTL > 0 ? 'İskonto' : calculations.debtHAS > 0 ? 'Borç' : 'Fark'}
                </p>
                <p className={`text-xl font-bold ${calculations.discountTL > 0 ? 'text-purple-600' : calculations.debtHAS > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {calculations.discountTL > 0 
                    ? `${formatTL(calculations.discountTL)} ₺`
                    : calculations.debtHAS > 0 
                      ? `${calculations.debtHAS.toFixed(4)} HAS`
                      : '0'}
                </p>
              </div>
            </div>

            {/* Credit Sale Toggle */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <input
                type="checkbox"
                id="isCredit"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <label htmlFor="isCredit" className="flex-1 cursor-pointer">
                <span className="font-medium">Veresiye Satış</span>
                <p className="text-xs text-muted-foreground">Ödeme almadan satış yapılacak (tam borç)</p>
              </label>
            </div>

            {/* Payment Details */}
            {!isCredit && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ödeme Yöntemi</Label>
                  <Select
                    value={formData.payment_method_code}
                    onValueChange={(value) => {
                      handleChange('payment_method_code', value);
                      setSelectedCashRegister(''); // Reset cash register when payment method changes
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

                {/* DÖVİZ İÇİN ÖZEL ALANLAR */}
                {(formData.payment_method_code?.includes('USD') || formData.payment_method_code?.includes('EUR')) ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Döviz Kuru (TL/{formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'})</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          placeholder="0.00"
                          className="text-lg font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Alınan Döviz ({formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'})</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={foreignAmount}
                          onChange={(e) => setForeignAmount(e.target.value)}
                          placeholder="0.00"
                          className="text-lg font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>TL Karşılığı</Label>
                        <Input
                          type="text"
                          value={formatTL(tlEquivalent)}
                          disabled
                          className="text-lg font-mono bg-muted"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {parseFloat(foreignAmount) || 0} {formData.payment_method_code?.includes('USD') ? 'USD' : 'EUR'} × {parseFloat(exchangeRate) || 0} = <strong>{formatTL(tlEquivalent)} TL</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Alınan Tutar (TL)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-lg font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Shortfall Options - Show if there's a difference */}
            {calculations.hasShortfall && calculations.differenceTL > 0.01 && (
              <div className="p-4 border-2 border-yellow-500/50 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                      Alınan tutar beklenen tutardan {formatTL(calculations.differenceTL)} TL düşük!
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
                        {formatTL(calculations.differenceTL)} TL ({calculations.differenceHAS.toFixed(4)} HAS) iskonto yapılacak. Müşteri borcu: 0
                      </p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${shortfallOption === 'debt' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted/50'}`}>
                    <input
                      type="radio"
                      name="shortfallOption"
                      value="debt"
                      checked={shortfallOption === 'debt'}
                      onChange={(e) => setShortfallOption(e.target.value)}
                      className="w-4 h-4"
                    />
                    <CreditCard className="w-5 h-5 text-red-600" />
                    <div className="flex-1">
                      <span className="font-medium">Kalan borç olarak kaydet</span>
                      <p className="text-xs text-muted-foreground">
                        İskonto yok. Müşteri borcu: {calculations.differenceHAS.toFixed(4)} HAS
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Full Payment Indicator */}
            {!isCredit && calculations.differenceTL <= 0.01 && calculations.receivedTL > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-950/30 rounded-lg text-green-800 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Tam ödeme - Müşteri borcu yok</span>
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
              placeholder="İşlem notları..."
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
        <Button 
          type="submit" 
          disabled={loading || 
            // Pool modunda: karat, gram ve müşteri gerekli
            (poolMode ? (!poolSaleData.karat_id || !poolSaleData.weight_gram || !formData.party_id) : 
            // Normal modda: en az bir ürün satırı gerekli
            (formData.lines.length === 0))
          }
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Kaydediliyor...' : 'Satışı Kaydet'}
        </Button>
      </div>
    </form>
  );
};

export default SaleForm;
