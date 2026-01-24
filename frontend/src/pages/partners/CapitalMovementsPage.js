import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, History, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Filter, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { partnerService, cashService } from '../../services';
import api from '../../lib/api';

const paymentMethods = [
  { value: 'CASH_TRY', label: 'Nakit TL', currency: 'TRY', type: 'CASH' },
  { value: 'BANK_TRY', label: 'Havale TL', currency: 'TRY', type: 'BANK' },
  { value: 'CASH_USD', label: 'Nakit USD', currency: 'USD', type: 'CASH' },
  { value: 'BANK_USD', label: 'Havale USD', currency: 'USD', type: 'BANK' },
  { value: 'CASH_EUR', label: 'Nakit EUR', currency: 'EUR', type: 'CASH' },
  { value: 'BANK_EUR', label: 'Havale EUR', currency: 'EUR', type: 'BANK' },
];

const CapitalMovementsPage = () => {
  const [movements, setMovements] = useState([]);
  const [partners, setPartners] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [filterPartner, setFilterPartner] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    partner_id: '',
    type: 'IN',
    payment_method: '',
    cash_register_id: '',
    amount: '',
    exchange_rate: '',
    description: '',
    movement_date: new Date().toISOString().split('T')[0]
  });
  const [filteredCashRegisters, setFilteredCashRegisters] = useState([]);

  useEffect(() => {
    loadPartners();
    loadCashRegisters();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [page, perPage]);

  useEffect(() => {
    // Filter cash registers based on payment method
    if (!formData.payment_method || !cashRegisters.length) {
      setFilteredCashRegisters([]);
      return;
    }
    
    const method = paymentMethods.find(m => m.value === formData.payment_method);
    if (!method) {
      setFilteredCashRegisters([]);
      return;
    }
    
    const filtered = cashRegisters.filter(cr => 
      cr.currency === method.currency && cr.type === method.type
    );
    
    setFilteredCashRegisters(filtered);
    setFormData(prev => ({ ...prev, cash_register_id: '' }));
  }, [formData.payment_method, cashRegisters]);

  const loadPartners = async () => {
    try {
      const response = await api.get('/api/partners/all');
      setPartners(response.data);
    } catch (error) {
      console.error('Partners load error:', error);
    }
  };

  const loadCashRegisters = async () => {
    try {
      const data = await cashService.getRegisters();
      setCashRegisters(data);
    } catch (error) {
      console.error('Cash registers load error:', error);
    }
  };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (filterPartner && filterPartner !== 'all') params.partner_id = filterPartner;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;
      
      const data = await partnerService.getCapitalMovements(params);
      setMovements(data.movements || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
        setTotalPages(data.pagination.total_pages || 1);
      }
    } catch (error) {
      toast.error('Sermaye hareketleri yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(1);
    loadMovements();
  };

  const handleSubmit = async () => {
    // Validations
    if (!formData.partner_id) {
      toast.error('Ortak seçiniz');
      return;
    }
    if (!formData.payment_method) {
      toast.error('Ödeme yöntemi seçiniz');
      return;
    }
    if (!formData.cash_register_id) {
      toast.error('Kasa seçiniz');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Geçerli bir tutar giriniz');
      return;
    }
    if (!formData.movement_date) {
      toast.error('Tarih seçiniz');
      return;
    }

    const method = paymentMethods.find(m => m.value === formData.payment_method);
    const isForeign = method && (method.currency === 'USD' || method.currency === 'EUR');
    
    if (isForeign && (!formData.exchange_rate || parseFloat(formData.exchange_rate) <= 0)) {
      toast.error('Döviz kuru giriniz');
      return;
    }

    try {
      const payload = {
        partner_id: formData.partner_id,
        type: formData.type,
        amount: parseFloat(formData.amount),
        currency: method.currency,
        cash_register_id: formData.cash_register_id,
        exchange_rate: isForeign ? parseFloat(formData.exchange_rate) : null,
        description: formData.description || null,
        movement_date: formData.movement_date
      };
      
      await partnerService.createCapitalMovement(payload);

      toast.success(`Sermaye ${formData.type === 'IN' ? 'girişi' : 'çıkışı'} kaydedildi`);
      setDialogOpen(false);
      resetForm();
      setPage(1);
      loadMovements();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const resetForm = () => {
    setFormData({
      partner_id: '',
      type: 'IN',
      payment_method: '',
      cash_register_id: '',
      amount: '',
      exchange_rate: '',
      description: '',
      movement_date: new Date().toISOString().split('T')[0]
    });
  };

  const handlePerPageChange = (value) => {
    setPerPage(parseInt(value));
    setPage(1);
  };

  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  };

  const selectedMethod = paymentMethods.find(m => m.value === formData.payment_method);
  const isForeignCurrency = selectedMethod && (selectedMethod.currency === 'USD' || selectedMethod.currency === 'EUR');
  const tlEquivalent = isForeignCurrency && formData.amount && formData.exchange_rate
    ? parseFloat(formData.amount) * parseFloat(formData.exchange_rate)
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sermaye Hareketleri</h1>
            <p className="text-muted-foreground">Ortakların sermaye giriş ve çıkışlarını takip edin</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Sermaye Girişi/Çıkışı
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Ortak</Label>
                <Select value={filterPartner} onValueChange={setFilterPartner}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tüm ortaklar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm ortaklar</SelectItem>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Başlangıç</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-2">
                <Label>Bitiş</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={handleFilter}>
                <Filter className="w-4 h-4 mr-2" />
                Filtrele
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Movements Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Hareket Listesi
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sayfa başı:</span>
                  <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  Toplam: {totalCount} kayıt
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz sermaye hareketi bulunmuyor</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Tarih</th>
                        <th className="text-left py-3 px-4 font-medium">Ortak</th>
                        <th className="text-center py-3 px-4 font-medium">Tür</th>
                        <th className="text-right py-3 px-4 font-medium">Tutar</th>
                        <th className="text-left py-3 px-4 font-medium">Kasa</th>
                        <th className="text-left py-3 px-4 font-medium">Açıklama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{formatDate(movement.movement_date)}</td>
                          <td className="py-3 px-4 font-medium">{movement.partner_name}</td>
                          <td className="py-3 px-4 text-center">
                            {movement.type === 'IN' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <ArrowUpCircle className="w-3 h-3" />
                                Giriş
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <ArrowDownCircle className="w-3 h-3" />
                                Çıkış
                              </span>
                            )}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${
                            movement.type === 'IN' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {movement.type === 'IN' ? '+' : '-'}{formatTL(movement.amount)} {movement.currency}
                            {movement.tl_equivalent && (
                              <div className="text-xs text-muted-foreground">
                                ({formatTL(movement.tl_equivalent)} TL)
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {movement.cash_register_name}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                            {movement.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Toplam {totalCount} kayıt • Sayfa {page} / {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Önceki
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages || totalPages === 0}
                    >
                      Sonraki
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Movement Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sermaye Hareketi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Movement Date */}
              <div className="space-y-2">
                <Label htmlFor="movement_date">İşlem Tarihi *</Label>
                <Input
                  id="movement_date"
                  type="date"
                  value={formData.movement_date}
                  onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
                />
              </div>
              
              {/* Partner */}
              <div className="space-y-2">
                <Label>Ortak *</Label>
                <Select 
                  value={formData.partner_id} 
                  onValueChange={(v) => setFormData({ ...formData, partner_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ortak seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Type */}
              <div className="space-y-2">
                <Label>İşlem Türü *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Sermaye Girişi</SelectItem>
                    <SelectItem value="OUT">Sermaye Çıkışı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Ödeme Yöntemi *</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ödeme yöntemi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Cash Register */}
              <div className="space-y-2">
                <Label>Kasa *</Label>
                <Select 
                  value={formData.cash_register_id} 
                  onValueChange={(v) => setFormData({ ...formData, cash_register_id: v })}
                  disabled={filteredCashRegisters.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kasa seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCashRegisters.map(cr => (
                      <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Exchange Rate (for foreign currency) */}
              {isForeignCurrency && (
                <div className="space-y-2">
                  <Label>Döviz Kuru (TL/{selectedMethod?.currency})</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.exchange_rate}
                    onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
                    placeholder="Ör: 42.50"
                  />
                </div>
              )}
              
              {/* Amount */}
              <div className="space-y-2">
                <Label>Tutar ({selectedMethod?.currency || 'TRY'}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Tutar giriniz"
                />
              </div>
              
              {/* TL Equivalent (for foreign currency) */}
              {isForeignCurrency && formData.amount && formData.exchange_rate && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">TL Karşılığı:</span>
                    <span className="font-mono font-semibold">{formatTL(tlEquivalent)} TL</span>
                  </div>
                </div>
              )}
              
              {/* Description */}
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ör: Sermaye artırımı"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleSubmit}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CapitalMovementsPage;
