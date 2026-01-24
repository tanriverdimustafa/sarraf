import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { partyService, lookupService } from '../services';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, 
  Edit, 
  Coins,
  Calculator,
  DollarSign,
  Euro,
  FileText,
  Package,
  CreditCard,
  Scale
} from 'lucide-react';
import PartyFormDialog from '../components/PartyFormDialog';
import { toast } from 'sonner';
import { useMarketData } from '../contexts/MarketDataContext';

const PartyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { marketData } = useMarketData();

  useEffect(() => {
    fetchPartyDetails();
  }, [id]);

  const fetchPartyDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch party details, balance, and transactions in parallel using services
      const [partyData, balanceData, transactionsData] = await Promise.all([
        partyService.getById(id),
        partyService.getBalance(id),
        partyService.getTransactions(id, { page: 1, limit: 20 })
      ]);
      
      console.log('📊 Party:', partyData);
      console.log('📊 Balance:', balanceData);
      console.log('📊 Transactions:', transactionsData);
      
      // Merge balance data into party object
      setParty({
        ...partyData,
        balance: balanceData
      });
      
      // Set transactions (handle both old and new response formats)
      if (transactionsData.transactions) {
        setTransactions(transactionsData.transactions);
        setPagination(transactionsData.pagination);
      } else {
        setTransactions(transactionsData);
      }
      
    } catch (error) {
      console.error('❌ Error fetching party:', error);
      toast.error('Party bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const [partyTypes, setPartyTypes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const data = await lookupService.getPartyTypes();
      setPartyTypes(data);
    } catch (error) {
      console.error('Error fetching lookups:', error);
    }
  };

  const getPositionValue = (assetKey) => {
    // New API format: party.balance.total_has_balance
    if (!party?.balance) return 0;
    
    // HAS balance - this is THE primary balance
    if (assetKey === 'has_gold_balance' || assetKey === 'has_net') {
      return party.balance.has_gold_balance || 0;
    }
    
    // USD balance
    if (assetKey === 'usd_balance') {
      return party.balance.usd_balance || 0;
    }
    
    // EUR balance
    if (assetKey === 'eur_balance') {
      return party.balance.eur_balance || 0;
    }
    
    return 0;
  };
  
  // Calculate TL equivalent from HAS balance using current market price
  const getTLEquivalent = () => {
    const hasBalance = getPositionValue('has_gold_balance');
    const currentHasPrice = marketData?.has_sell_tl || 5850;
    return hasBalance * currentHasPrice;
  };

  const formatBalance = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00';
    if (value === 0) return '0.00';
    return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const getPartyTypeName = (typeId) => {
    const type = partyTypes.find(t => t.id === typeId);
    return type ? type.name : '';
  };

  const getTypeColor = (typeId) => {
    const colors = {
      1: 'bg-green-500/10 text-green-500 border-green-500/20',
      2: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      3: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      4: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      5: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      6: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      7: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    };
    return colors[typeId] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-muted-foreground mb-4">Party bulunamadı</div>
        <Button onClick={() => navigate('/parties')}>Geri Dön</Button>
      </div>
    );
  }

  const hasGold = getPositionValue('has_gold_balance');
  const tlEquivalent = getTLEquivalent();
  const usdBalance = getPositionValue('usd_balance');
  const eurBalance = getPositionValue('eur_balance');
  
  // Party'nin direkt HAS bakiyesi (ürün alışlarından)
  const directHasBalance = party?.has_balance || 0;

  return (
    <div className="space-y-6" data-testid="party-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/parties')}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-serif font-medium text-foreground">{party.name}</h1>
              <Badge className={getTypeColor(party.party_type_id)}>
                {getPartyTypeName(party.party_type_id)}
              </Badge>
              <Badge variant={party.is_active ? 'default' : 'secondary'}>
                {party.is_active ? 'Aktif' : 'Pasif'}
              </Badge>
            </div>
            {party.code && (
              <p className="text-muted-foreground mt-1">Kod: {party.code}</p>
            )}
          </div>
        </div>
        <Button onClick={() => setShowEditDialog(true)} data-testid="edit-party-btn">
          <Edit className="w-4 h-4 mr-2" />
          Düzenle
        </Button>
      </div>

      {/* Party Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Müşteri için Kişisel Bilgiler / Tedarikçi için Firma Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-sans">
              {party.party_type_id === 1 ? 'Kişisel Bilgiler' : 'Firma Bilgileri'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {party.party_type_id === 1 ? (
              // MÜŞTERİ
              <>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Ad Soyad</span>
                  <span className="font-medium">
                    {party.first_name && party.last_name 
                      ? `${party.first_name} ${party.last_name}` 
                      : party.name}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">TC Kimlik No</span>
                  <span className="font-medium font-mono">{party.tc_kimlik_no || '-'}</span>
                </div>
              </>
            ) : (
              // TEDARİKÇİ
              <>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Firma Adı</span>
                  <span className="font-medium">{party.company_name || party.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Vergi No</span>
                  <span className="font-medium font-mono">{party.tax_number || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Vergi Dairesi</span>
                  <span className="font-medium">{party.tax_office || '-'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Yetkili Kişi</span>
                  <span className="font-medium">{party.contact_person || '-'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* İletişim ve Adres Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-sans">İletişim & Adres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Telefon</span>
              <span className="font-medium">{party.phone || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">E-posta</span>
              <span className="font-medium">{party.email || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">İl / İlçe</span>
              <span className="font-medium">
                {party.city || party.district 
                  ? `${party.city || ''} ${party.city && party.district ? '/' : ''} ${party.district || ''}`.trim() 
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Adres</span>
              <span className="font-medium text-right max-w-[250px]">{party.address || '-'}</span>
            </div>
            {party.notes && (
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Notlar</span>
                <span className="font-medium text-sm">{party.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Position Cards - HAS, TL Equivalent, USD, EUR + Ürün Borcu */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Has Altın - Primary Balance (İşlemlerden) */}
        <Card className={`border-primary/20 ${hasGold !== 0 ? 'gold-glow' : ''}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold">HAS Pozisyonu</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-bold ${hasGold > 0 ? 'text-green-600' : hasGold < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {hasGold > 0 && '+'}{formatBalance(hasGold)}
              </span>
              <span className="text-sm text-muted-foreground">gr</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {hasGold > 0 ? 'Alacak (Biz borçluyuz)' : hasGold < 0 ? 'Borç (Bize borçlu)' : 'Bakiye yok'}
            </div>
          </CardContent>
        </Card>
        
        {/* Cari HAS Bakiye (Party has_balance - Ana Kaynak) */}
        <Card className={`border-2 ${directHasBalance > 0 ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : directHasBalance < 0 ? 'border-green-400 bg-green-50 dark:bg-green-950/20' : 'border-gray-300 bg-gray-50 dark:bg-gray-900/20'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold">Cari HAS Bakiye</CardTitle>
              {/* Badge ile durum gösterimi */}
              <Badge className={`${directHasBalance > 0 ? 'bg-red-100 text-red-700 border-red-300' : directHasBalance < 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                {directHasBalance > 0 ? 'Borçluyuz' : directHasBalance < 0 ? 'Alacaklıyız' : 'Dengede'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-bold ${directHasBalance > 0 ? 'text-red-600' : directHasBalance < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                {Math.abs(directHasBalance).toFixed(6)}
              </span>
              <span className="text-sm text-muted-foreground">HAS</span>
            </div>
            <div className="text-sm mt-2">
              {directHasBalance > 0 && (
                <span className="text-red-600 font-medium">⬆️ Biz {party.name}'e borçluyuz</span>
              )}
              {directHasBalance < 0 && (
                <span className="text-green-600 font-medium">⬇️ {party.name} bize borçlu</span>
              )}
              {directHasBalance === 0 && (
                <span className="text-gray-500 font-medium">✓ Bakiye dengede</span>
              )}
            </div>
            {/* TL Karşılığı */}
            {marketData?.has_gold_sell && directHasBalance !== 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                ≈ {(Math.abs(directHasBalance) * marketData.has_gold_sell).toLocaleString('tr-TR', {maximumFractionDigits: 0})} TL
              </p>
            )}
          </CardContent>
        </Card>

        {/* TL Karşılığı - Calculated from HAS */}
        <Card className={tlEquivalent !== 0 ? 'border-chart-1/20' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold">TL Karşılığı</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-chart-1/10 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-chart-1" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-bold ${tlEquivalent > 0 ? 'text-green-600' : tlEquivalent < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {tlEquivalent > 0 && '+'}{formatBalance(tlEquivalent)}
              </span>
              <span className="text-sm text-muted-foreground">₺</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              HAS × Güncel Fiyat ({formatBalance(marketData?.has_sell_tl || 5850)} ₺)
            </div>
          </CardContent>
        </Card>

        {/* USD Pozisyonu */}
        <Card className={usdBalance !== 0 ? 'border-green-500/20' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold">USD Pozisyonu</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-bold ${usdBalance > 0 ? 'text-green-600' : usdBalance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {usdBalance > 0 && '+'}{formatBalance(usdBalance)}
              </span>
              <span className="text-sm text-muted-foreground">$</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {usdBalance > 0 ? 'Alacak (Biz borçluyuz)' : usdBalance < 0 ? 'Borç (Bize borçlu)' : 'Bakiye yok'}
            </div>
          </CardContent>
        </Card>

        {/* EUR Pozisyonu */}
        <Card className={eurBalance !== 0 ? 'border-blue-500/20' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-sans font-semibold">EUR Pozisyonu</CardTitle>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Euro className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-bold ${eurBalance > 0 ? 'text-green-600' : eurBalance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {eurBalance > 0 && '+'}{formatBalance(eurBalance)}
              </span>
              <span className="text-sm text-muted-foreground">€</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {eurBalance > 0 ? 'Alacak (Biz borçluyuz)' : eurBalance < 0 ? 'Borç (Bize borçlu)' : 'Bakiye yok'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs defaultValue="transactions" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="transactions" data-testid="tab-transactions">
                <FileText className="w-4 h-4 mr-2" />
                İşlemler
              </TabsTrigger>
              <TabsTrigger value="stock" data-testid="tab-stock">
                <Package className="w-4 h-4 mr-2" />
                Stok Hareketleri
              </TabsTrigger>
              <TabsTrigger value="payments" data-testid="tab-payments">
                <CreditCard className="w-4 h-4 mr-2" />
                Ödemeler
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="transactions">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Henüz işlem bulunmuyor</p>
                  <p className="text-sm mt-2">Bu party ile yapılan işlemler burada görüntülenecek</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Transactions List */}
                  {transactions.map((tx) => (
                    <Card key={tx.code || tx._id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-mono font-semibold text-primary">{tx.code}</span>
                              <Badge variant="outline">{tx.type_code}</Badge>
                              {tx.status && (
                                <Badge variant={tx.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                  {tx.status}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(tx.transaction_date).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            {tx.notes && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {tx.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {tx.total_has_amount !== undefined && (
                              <div className={`text-lg font-mono font-bold ${
                                tx.total_has_amount > 0 ? 'text-green-600' : 
                                tx.total_has_amount < 0 ? 'text-red-600' : 
                                'text-muted-foreground'
                              }`}>
                                {tx.total_has_amount > 0 ? '+' : ''}
                                {formatBalance(tx.total_has_amount)} HAS
                              </div>
                            )}
                            {tx.total_amount_currency !== undefined && tx.currency && (
                              <div className="text-sm text-muted-foreground">
                                {tx.currency} {formatBalance(tx.total_amount_currency)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Pagination */}
                  {pagination && pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <div className="text-sm text-muted-foreground">
                        Toplam {pagination.total} işlem ({pagination.total_pages} sayfa)
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagination.page === 1}
                          onClick={() => {
                            // Implement pagination handler
                            console.log('Previous page');
                          }}
                        >
                          Önceki
                        </Button>
                        <div className="flex items-center px-3 text-sm">
                          Sayfa {pagination.page} / {pagination.total_pages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagination.page === pagination.total_pages}
                          onClick={() => {
                            // Implement pagination handler
                            console.log('Next page');
                          }}
                        >
                          Sonraki
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="stock">
              {(() => {
                // Filter transactions for PURCHASE, SALE, and HURDA types
                const stockTransactions = transactions.filter(tx => 
                  tx.type_code === 'PURCHASE' || tx.type_code === 'SALE' || tx.type_code === 'HURDA'
                );
                
                return stockTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Henüz stok hareketi bulunmuyor</p>
                    <p className="text-sm mt-2">Alış/Satış/Hurda işlemleri burada görüntülenecek</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stockTransactions.map((tx) => (
                      <Card key={tx.code || tx._id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-mono font-semibold text-primary">{tx.code}</span>
                                <Badge variant={
                                  tx.type_code === 'PURCHASE' ? 'default' : 
                                  tx.type_code === 'SALE' ? 'destructive' : 
                                  'secondary'
                                }>
                                  {tx.type_code === 'PURCHASE' ? 'Alış' : 
                                   tx.type_code === 'SALE' ? 'Satış' : 'Hurda'}
                                </Badge>
                                {tx.status && (
                                  <Badge variant={tx.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                    {tx.status}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(tx.transaction_date).toLocaleDateString('tr-TR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                              {tx.notes && (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {tx.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {tx.total_has_amount !== undefined && (
                                <div className={`text-lg font-mono font-bold ${
                                  tx.total_has_amount > 0 ? 'text-green-600' : 
                                  tx.total_has_amount < 0 ? 'text-red-600' : 
                                  'text-muted-foreground'
                                }`}>
                                  {tx.total_has_amount > 0 ? '+' : ''}
                                  {formatBalance(tx.total_has_amount)} HAS
                                </div>
                              )}
                              {tx.total_amount_currency !== undefined && tx.currency && (
                                <div className="text-sm text-muted-foreground">
                                  {tx.currency} {formatBalance(tx.total_amount_currency)}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="payments">
              {(() => {
                // Filter transactions for PAYMENT and RECEIPT types
                const paymentTransactions = transactions.filter(tx => 
                  tx.type_code === 'PAYMENT' || tx.type_code === 'RECEIPT'
                );
                
                return paymentTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Henüz ödeme/tahsilat işlemi bulunmuyor</p>
                    <p className="text-sm mt-2">Nakit, banka, hurda ödemeleri burada görüntülenecek</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentTransactions.map((tx) => (
                      <Card key={tx.code || tx._id} className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-mono font-semibold text-primary">{tx.code}</span>
                                <Badge variant={tx.type_code === 'PAYMENT' ? 'destructive' : 'default'}>
                                  {tx.type_code === 'PAYMENT' ? 'Ödeme' : 'Tahsilat'}
                                </Badge>
                                {tx.payment_method && (
                                  <Badge variant="outline">{tx.payment_method}</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(tx.transaction_date).toLocaleDateString('tr-TR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                              {tx.notes && (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {tx.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              {tx.total_amount_currency !== undefined && tx.currency && (
                                <div className={`text-lg font-mono font-bold ${
                                  tx.type_code === 'RECEIPT' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {tx.type_code === 'RECEIPT' ? '+' : '-'}
                                  {formatBalance(tx.total_amount_currency)} {tx.currency}
                                </div>
                              )}
                              {tx.total_has_amount !== undefined && tx.total_has_amount !== 0 && (
                                <div className="text-sm text-muted-foreground">
                                  {formatBalance(tx.total_has_amount)} HAS
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Edit Dialog */}
      <PartyFormDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSuccess={() => {
          setShowEditDialog(false);
          fetchPartyDetails();
        }}
        party={party}
      />
    </div>
  );
};

export default PartyDetailPage;
