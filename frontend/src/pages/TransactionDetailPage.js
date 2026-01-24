import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { ArrowLeft, FileText, Calendar, User, DollarSign, TrendingUp, XCircle, AlertTriangle, Package, Wallet, Settings, Scale, CreditCard } from 'lucide-react';
import { getFinancialTransaction, formatHAS, formatCurrency, getTransactionTypeLabel, getStatusLabel, getStatusColor } from '../services/financialV2Service';
import { partyService } from '../services';
import api from '../lib/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';

// ============= YARDIMCI FONKSİYONLAR =============

// Karat ID'den anlamlı metin
const getKaratDisplay = (karatId, fineness) => {
  const karats = {
    1: '24K (999 milyem)',
    2: '22K (916 milyem)',
    3: '18K (750 milyem)',
    4: '14K (585 milyem)',
    5: '21K (875 milyem)',
    6: '10K (417 milyem)',
    7: '9K (375 milyem)',
    8: '8K (333 milyem)'
  };
  
  if (karatId && karats[karatId]) {
    return karats[karatId];
  }
  
  // Fineness'tan tahmin et
  if (fineness) {
    if (fineness >= 0.99) return '24K (999 milyem)';
    if (fineness >= 0.90) return '22K (916 milyem)';
    if (fineness >= 0.74) return '18K (750 milyem)';
    if (fineness >= 0.58) return '14K (585 milyem)';
    if (fineness >= 0.41) return '10K (417 milyem)';
    return `${(fineness * 1000).toFixed(0)} milyem`;
  }
  
  return karatId ? `${karatId}K` : '-';
};

// Ürün tipi Türkçe çeviri
const getProductTypeName = (type) => {
  const types = {
    'GRAM_GOLD': 'Gram Altın',
    'GOLD_BAR': 'Gram Altın',
    'BRACELET': 'Bilezik',
    'GOLD_BRACELET': 'Altın Bilezik',
    'NECKLACE': 'Kolye',
    'RING': 'Yüzük',
    'EARRING': 'Küpe',
    'SCRAP': 'Hurda Altın',
    'SCRAP_GOLD': 'Hurda Altın',
    'COIN': 'Ziynet',
    'CEYREK': 'Çeyrek',
    'QUARTER': 'Çeyrek',
    'YARIM': 'Yarım',
    'HALF': 'Yarım',
    'TAM': 'Tam',
    'FULL': 'Tam',
    'ATA': 'Ata Lirası',
    'RESAT': 'Reşat',
    'HAMIT': 'Hamit',
    'CUMHURIYET': 'Cumhuriyet',
    'ZIYNET': 'Ziynet'
  };
  return types[type] || type || '-';
};

// Line kind Türkçe
const getLineKindLabel = (kind) => {
  const labels = {
    'INVENTORY': '📦 ÜRÜN',
    'PAYMENT': '💰 ÖDEME',
    'RECEIPT': '💵 TAHSİLAT',
    'ADJUSTMENT': '⚙️ DÜZELTME',
    'FEE': '💳 KOMİSYON'
  };
  return labels[kind] || kind;
};

// Ödeme yöntemi Türkçe
const getPaymentMethodLabel = (code) => {
  const methods = {
    'CASH_TRY': 'Nakit TL',
    'BANK_TRY': 'Havale TL',
    'CASH_USD': 'Nakit USD',
    'BANK_USD': 'Havale USD',
    'CASH_EUR': 'Nakit EUR',
    'BANK_EUR': 'Havale EUR',
    'CREDIT_CARD': 'Kredi Kartı',
    'CHECK': 'Çek',
    'GOLD_SCRAP': 'Hurda Altın'
  };
  return methods[code] || code || '-';
};

// Meta alan isimleri Türkçe
const metaFieldLabels = {
  // Fiyatlandırma
  'has_price_used': 'Kullanılan HAS Fiyatı',
  'total_cost_has': 'Toplam Maliyet (HAS)',
  'total_sale_has': 'Toplam Satış (HAS)',
  'expected_amount_tl': 'Beklenen Tutar',
  'actual_amount_tl': 'Alınan Tutar',
  
  // Kar/Zarar
  'gross_profit_has': 'Brüt Kar (HAS)',
  'commission_has': 'Komisyon (HAS)',
  'net_profit_has': 'Net Kar (HAS)',
  'net_profit_currency': 'Net Kar (TL)',
  'profit_has': 'Kar/Zarar (HAS)',
  
  // Ödeme
  'is_credit_sale': 'Veresiye Satış',
  'discount_tl': 'İskonto (TL)',
  'discount_has': 'İskonto (HAS)',
  'customer_debt_has': 'Müşteri Borcu (HAS)',
  'collected_has': 'Tahsil Edilen (HAS)',
  'effective_sale_has': 'Efektif Satış (HAS)',
  
  // Diğer
  'payment_difference_type': 'Fark İşleme Şekli',
  'balance_change_has': 'Bakiye Değişimi (HAS)'
};

// Meta değer formatlama
const formatMetaValue = (key, value) => {
  if (value === null || value === undefined) return '-';
  
  // Boolean
  if (key === 'is_credit_sale') {
    return value ? 'Evet (Veresiye)' : 'Hayır (Peşin)';
  }
  
  // TL değerleri
  if (key.includes('_tl') || key.includes('_currency') || key === 'has_price_used' || key === 'actual_amount_tl' || key === 'expected_amount_tl') {
    return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
  }
  
  // HAS değerleri
  if (key.includes('_has')) {
    return `${Number(value).toFixed(4)} HAS`;
  }
  
  // Fark işleme şekli
  if (key === 'payment_difference_type') {
    return value === 'PROFIT_LOSS' ? 'Kar/Zarar' : value === 'CREDIT' ? 'Borç/Alacak' : value;
  }
  
  return String(value);
};

// Party gösterim adı
const getPartyDisplayName = (transaction) => {
  // party_name varsa kullan
  if (transaction.party_name) {
    const typeLabel = transaction.party_type_id === 1 ? '(Müşteri)' : 
                      transaction.party_type_id === 2 ? '(Tedarikçi)' : '';
    return `${transaction.party_name} ${typeLabel}`.trim();
  }
  
  // party objesi varsa
  if (transaction.party) {
    const party = transaction.party;
    if (party.party_type_id === 1) {
      const name = `${party.first_name || ''} ${party.last_name || ''}`.trim();
      return name ? `${name} (Müşteri)` : `${party.name} (Müşteri)`;
    } else {
      return `${party.company_name || party.name} (Tedarikçi)`;
    }
  }
  
  return '-';
};

// ============= ANA BİLEŞEN =============

const TransactionDetailPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [partyDetails, setPartyDetails] = useState(null);

  useEffect(() => {
    loadTransaction();
  }, [code]);

  const loadTransaction = async () => {
    setLoading(true);
    try {
      const encodedCode = encodeURIComponent(code);
      const data = await getFinancialTransaction(encodedCode);
      setTransaction(data);
      
      // Party detaylarını yükle
      if (data.party_id) {
        try {
          const partyData = await partyService.getById(data.party_id);
          setPartyDetails(partyData);
        } catch (e) {
          console.error('Party load error:', e);
        }
      }
    } catch (error) {
      console.error('Transaction load error:', error);
      toast.error('İşlem yüklenemedi: ' + error.message);
      setTransaction({ code: code, error: true });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">İşlem bulunamadı</p>
        <Button className="mt-4" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          İşlemlere Dön
        </Button>
      </div>
    );
  }

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await api.post(`/api/financial-transactions/${encodeURIComponent(transaction.code)}/cancel`, {
        reason: cancelReason || 'İşlem iptal edildi'
      });
      
      toast.success('İşlem iptal edildi');
      loadTransaction();
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'İptal başarısız';
      toast.error(errorDetail);
    } finally {
      setIsCancelling(false);
      setCancelReason('');
    }
  };

  // Party display name with details
  const partyDisplayName = partyDetails 
    ? (partyDetails.party_type_id === 1 
        ? `${partyDetails.first_name || ''} ${partyDetails.last_name || ''}`.trim() || partyDetails.name
        : partyDetails.company_name || partyDetails.name)
    : transaction.party_name || '-';
  
  const partyTypeLabel = partyDetails?.party_type_id === 1 ? 'Müşteri' : 
                         partyDetails?.party_type_id === 2 ? 'Tedarikçi' : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-serif font-medium text-foreground">{transaction.code}</h1>
            <p className="text-muted-foreground mt-1">
              {getTransactionTypeLabel(transaction.type_code)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(transaction.status)}>
              {getStatusLabel(transaction.status)}
            </Badge>
            
            {transaction.status !== 'CANCELLED' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <XCircle className="h-4 w-4 mr-2" />
                    İptal Et
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      İşlemi İptal Et
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div>
                        <p><strong>{transaction.code}</strong> kodlu işlemi iptal etmek istediğinize emin misiniz?</p>
                        <ul className="list-disc list-inside mt-3 space-y-1 text-left text-sm">
                          <li>Unified Ledger'a VOID kaydı eklenecek</li>
                          <li>Cari bakiye geri alınacak</li>
                          <li>Kasa hareketi geri alınacak</li>
                          {transaction.type_code === 'SALE' && (
                            <li>Satılan ürünler stoğa geri alınacak</li>
                          )}
                          {transaction.type_code === 'PURCHASE' && (
                            <li>Alınan ürünler silinecek (satılmamışsa)</li>
                          )}
                        </ul>
                        <div className="mt-4">
                          <label className="text-sm font-medium">İptal Sebebi:</label>
                          <Input
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="İptal sebebini yazın..."
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCancel} 
                      className="bg-red-600 hover:bg-red-700"
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'İptal ediliyor...' : 'Evet, İptal Et'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        
        {/* İptal edilmiş işlem uyarısı */}
        {transaction.status === 'CANCELLED' && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 mt-4">
            <XCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Bu işlem iptal edilmiş</p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Sebep: {transaction.cancel_reason || 'Belirtilmemiş'} 
                {transaction.cancelled_at && ` | Tarih: ${new Date(transaction.cancelled_at).toLocaleString('tr-TR')}`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Summary - İşlem Özeti */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                İşlem Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Tarih */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    İşlem Tarihi
                  </div>
                  <div className="font-medium">
                    {new Date(transaction.transaction_date).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {/* Cari */}
                {(transaction.party_id || transaction.party_name) && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      <User className="w-4 h-4 inline mr-1" />
                      Cari
                    </div>
                    <div className="font-medium">
                      {partyDisplayName}
                      {partyTypeLabel && (
                        <span className="text-muted-foreground text-sm ml-1">({partyTypeLabel})</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Toplam HAS */}
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    <Scale className="w-4 h-4 inline mr-1" />
                    Toplam HAS
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      transaction.total_has_amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatHAS(transaction.total_has_amount)} HAS
                  </div>
                </div>

                {/* Tutar */}
                {transaction.currency && transaction.total_amount_currency && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4 inline mr-1" />
                      Tutar
                    </div>
                    <div className="text-xl font-semibold">
                      {Number(transaction.total_amount_currency).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} ₺
                    </div>
                  </div>
                )}
              </div>

              {/* Ödeme Yöntemi */}
              {transaction.payment_method_code && (
                <div className="pt-4 border-t border-primary/10">
                  <div className="text-sm text-muted-foreground mb-1">
                    <CreditCard className="w-4 h-4 inline mr-1" />
                    Ödeme Yöntemi
                  </div>
                  <div className="font-medium">{getPaymentMethodLabel(transaction.payment_method_code)}</div>
                </div>
              )}

              {/* Notlar */}
              {transaction.notes && (
                <div className="pt-4 border-t border-primary/10">
                  <div className="text-sm text-muted-foreground mb-1">📝 Notlar</div>
                  <div className="font-medium">{transaction.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction Lines - İşlem Satırları */}
          {transaction.lines && transaction.lines.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  İşlem Satırları
                </CardTitle>
                <CardDescription>{transaction.lines.length} satır</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transaction.lines.map((line, idx) => {
                    // Ürün adını belirle
                    const productName = line.note || 
                                        line.meta?.product_type_name || 
                                        getProductTypeName(line.product_type_code) ||
                                        'Ürün';
                    
                    return (
                      <div
                        key={idx}
                        className="p-4 border border-primary/20 rounded-lg bg-muted/30"
                      >
                        {/* Satır Başlığı */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-primary/10">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-normal">
                              {getLineKindLabel(line.line_kind)}
                            </Badge>
                            <span className="text-sm font-medium text-muted-foreground">
                              Satır #{line.line_no || idx + 1}
                            </span>
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              line.line_total_has >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatHAS(line.line_total_has)} HAS
                          </div>
                        </div>

                        {/* Satır Detayları */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {/* Ürün Adı */}
                          <div>
                            <span className="text-muted-foreground block text-xs mb-0.5">Ürün Adı</span>
                            <div className="font-medium">{productName}</div>
                          </div>
                          
                          {/* Ürün Tipi */}
                          {line.product_type_code && (
                            <div>
                              <span className="text-muted-foreground block text-xs mb-0.5">Ürün Tipi</span>
                              <div className="font-medium">{getProductTypeName(line.product_type_code)}</div>
                            </div>
                          )}
                          
                          {/* Ayar/Karat */}
                          {(line.karat_id || line.fineness) && (
                            <div>
                              <span className="text-muted-foreground block text-xs mb-0.5">Ayar</span>
                              <div className="font-medium">{getKaratDisplay(line.karat_id, line.fineness)}</div>
                            </div>
                          )}
                          
                          {/* Ağırlık */}
                          {(line.weight_gram || line.quantity) && (
                            <div>
                              <span className="text-muted-foreground block text-xs mb-0.5">Ağırlık/Miktar</span>
                              <div className="font-medium">
                                {line.weight_gram ? `${line.weight_gram} gr` : `${line.quantity} adet`}
                              </div>
                            </div>
                          )}
                          
                          {/* Material HAS */}
                          {line.material_has !== undefined && (
                            <div>
                              <span className="text-muted-foreground block text-xs mb-0.5">Malzeme (HAS)</span>
                              <div className="font-medium">{formatHAS(line.material_has)}</div>
                            </div>
                          )}
                          
                          {/* Labor HAS */}
                          {line.labor_has !== undefined && line.labor_has > 0 && (
                            <div>
                              <span className="text-muted-foreground block text-xs mb-0.5">İşçilik (HAS)</span>
                              <div className="font-medium">{formatHAS(line.labor_has)}</div>
                            </div>
                          )}
                        </div>

                        {/* Not varsa */}
                        {line.note && line.note !== productName && (
                          <div className="text-sm text-muted-foreground italic pt-2 mt-2 border-t border-primary/10">
                            📝 {line.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Meta Information - Ek Bilgiler */}
          {transaction.meta && Object.keys(transaction.meta).length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  İşlem Detayları
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Gruplandırılmış meta bilgiler */}
                <div className="space-y-6">
                  {/* Fiyatlandırma */}
                  {(transaction.meta.has_price_used || transaction.meta.total_cost_has || transaction.meta.actual_amount_tl) && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        💰 FİYATLANDIRMA
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {transaction.meta.has_price_used && (
                          <div>
                            <span className="text-muted-foreground">Kullanılan HAS Fiyatı</span>
                            <div className="font-medium">{formatMetaValue('has_price_used', transaction.meta.has_price_used)}</div>
                          </div>
                        )}
                        {transaction.meta.total_cost_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Toplam Maliyet</span>
                            <div className="font-medium">{formatMetaValue('total_cost_has', transaction.meta.total_cost_has)}</div>
                          </div>
                        )}
                        {transaction.meta.total_sale_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Toplam Satış</span>
                            <div className="font-medium">{formatMetaValue('total_sale_has', transaction.meta.total_sale_has)}</div>
                          </div>
                        )}
                        {transaction.meta.expected_amount_tl !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Beklenen Tutar</span>
                            <div className="font-medium">{formatMetaValue('expected_amount_tl', transaction.meta.expected_amount_tl)}</div>
                          </div>
                        )}
                        {transaction.meta.actual_amount_tl !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Alınan Tutar</span>
                            <div className="font-medium">{formatMetaValue('actual_amount_tl', transaction.meta.actual_amount_tl)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kar/Zarar */}
                  {(transaction.meta.gross_profit_has !== undefined || transaction.meta.net_profit_has !== undefined || transaction.meta.profit_has !== undefined) && (
                    <div className="pt-4 border-t border-primary/10">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        💵 KAR/ZARAR
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {transaction.meta.gross_profit_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Brüt Kar</span>
                            <div className={`font-medium ${transaction.meta.gross_profit_has >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMetaValue('gross_profit_has', transaction.meta.gross_profit_has)}
                            </div>
                          </div>
                        )}
                        {transaction.meta.commission_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Komisyon</span>
                            <div className="font-medium">{formatMetaValue('commission_has', transaction.meta.commission_has)}</div>
                          </div>
                        )}
                        {transaction.meta.net_profit_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Net Kar (HAS)</span>
                            <div className={`font-medium ${transaction.meta.net_profit_has >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMetaValue('net_profit_has', transaction.meta.net_profit_has)}
                            </div>
                          </div>
                        )}
                        {transaction.meta.net_profit_currency !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Net Kar (TL)</span>
                            <div className={`font-medium ${transaction.meta.net_profit_currency >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMetaValue('net_profit_currency', transaction.meta.net_profit_currency)}
                            </div>
                          </div>
                        )}
                        {transaction.meta.profit_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Kar/Zarar</span>
                            <div className={`font-medium ${transaction.meta.profit_has >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMetaValue('profit_has', transaction.meta.profit_has)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ödeme Bilgileri */}
                  {(transaction.meta.is_credit_sale !== undefined || transaction.meta.discount_tl !== undefined || transaction.meta.customer_debt_has !== undefined) && (
                    <div className="pt-4 border-t border-primary/10">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        📝 ÖDEME BİLGİLERİ
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {transaction.meta.is_credit_sale !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Satış Tipi</span>
                            <div className="font-medium">{formatMetaValue('is_credit_sale', transaction.meta.is_credit_sale)}</div>
                          </div>
                        )}
                        {transaction.meta.discount_tl !== undefined && transaction.meta.discount_tl > 0 && (
                          <div>
                            <span className="text-muted-foreground">İskonto (TL)</span>
                            <div className="font-medium">{formatMetaValue('discount_tl', transaction.meta.discount_tl)}</div>
                          </div>
                        )}
                        {transaction.meta.discount_has !== undefined && transaction.meta.discount_has > 0 && (
                          <div>
                            <span className="text-muted-foreground">İskonto (HAS)</span>
                            <div className="font-medium">{formatMetaValue('discount_has', transaction.meta.discount_has)}</div>
                          </div>
                        )}
                        {transaction.meta.customer_debt_has !== undefined && transaction.meta.customer_debt_has > 0 && (
                          <div>
                            <span className="text-muted-foreground">Müşteri Borcu</span>
                            <div className="font-medium">{formatMetaValue('customer_debt_has', transaction.meta.customer_debt_has)}</div>
                          </div>
                        )}
                        {transaction.meta.collected_has !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Tahsil Edilen</span>
                            <div className="font-medium">{formatMetaValue('collected_has', transaction.meta.collected_has)}</div>
                          </div>
                        )}
                        {transaction.meta.payment_difference_type && (
                          <div>
                            <span className="text-muted-foreground">Fark İşleme Şekli</span>
                            <div className="font-medium">{formatMetaValue('payment_difference_type', transaction.meta.payment_difference_type)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cari Bakiye Kartı */}
          {partyDetails && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="w-5 h-5" />
                  📊 Cari Bakiye
                </CardTitle>
                <CardDescription className="font-medium">
                  {partyDisplayName}
                  {partyTypeLabel && <span className="text-muted-foreground"> ({partyTypeLabel})</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* HAS Bakiye */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Toplam HAS Bakiye</div>
                    <div className={`text-2xl font-bold ${
                      (partyDetails.has_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatHAS(partyDetails.has_balance || 0)} HAS
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(partyDetails.has_balance || 0) > 0 
                        ? '⬆️ Biz borçluyuz' 
                        : (partyDetails.has_balance || 0) < 0 
                          ? '⬇️ Bize borçlu'
                          : '✅ Bakiye dengede'}
                    </div>
                  </div>

                  {/* TL Karşılığı (yaklaşık) */}
                  {transaction.meta?.has_price_used && (
                    <div className="pt-3 border-t border-primary/10">
                      <div className="text-xs text-muted-foreground mb-1">TL Karşılığı (yaklaşık)</div>
                      <div className="text-lg font-semibold">
                        {Number((partyDetails.has_balance || 0) * transaction.meta.has_price_used).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} ₺
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teknik Bilgiler */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings className="w-4 h-4" />
                🔧 Teknik Bilgiler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <div className="text-muted-foreground">İşlem Kodu</div>
                <div className="font-mono font-medium">{transaction.code}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Oluşturulma Tarihi</div>
                <div className="font-medium">
                  {new Date(transaction.created_at).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Güncelleme Tarihi</div>
                <div className="font-medium">
                  {new Date(transaction.updated_at).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              {transaction.created_by && (
                <div>
                  <div className="text-muted-foreground">Oluşturan Kullanıcı</div>
                  <div className="font-medium">
                    {transaction.created_by === 'USER-ADMIN-001' ? 'Admin Kullanıcı' : transaction.created_by}
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">İşlem Versiyonu</div>
                <div className="font-medium">{transaction.version || 1}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailPage;
