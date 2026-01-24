import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import SearchableSelect from '../../components/SearchableSelect';
import { Plus, History, ChevronLeft, ChevronRight, Filter, Calendar, Banknote } from 'lucide-react';
import { toast } from 'sonner';

import { employeeService, cashService } from '../../services';
import api from '../../lib/api';

const paymentMethods = [
  { value: 'CASH_TRY', label: 'Nakit TL', currency: 'TRY', type: 'CASH' },
  { value: 'BANK_TRY', label: 'Havale TL', currency: 'TRY', type: 'BANK' },
  { value: 'CASH_USD', label: 'Nakit USD', currency: 'USD', type: 'CASH' },
  { value: 'BANK_USD', label: 'Havale USD', currency: 'USD', type: 'BANK' },
  { value: 'CASH_EUR', label: 'Nakit EUR', currency: 'EUR', type: 'CASH' },
  { value: 'BANK_EUR', label: 'Havale EUR', currency: 'EUR', type: 'BANK' },
];

const SalaryMovementsPage = () => {
  const [movements, setMovements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [accrualPeriods, setAccrualPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Dialogs
  const [accrualDialogOpen, setAccrualDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  
  // Form states
  const [accrualForm, setAccrualForm] = useState({
    employee_id: '',
    period: '',
    amount: '',
    description: '',
    movement_date: new Date().toISOString().split('T')[0]
  });
  
  const [paymentForm, setPaymentForm] = useState({
    employee_id: '',
    period: '',
    payment_method: '',
    cash_register_id: '',
    amount: '',
    exchange_rate: '',
    description: '',
    movement_date: new Date().toISOString().split('T')[0]
  });
  
  const [filteredCashRegisters, setFilteredCashRegisters] = useState([]);

  useEffect(() => {
    loadEmployees();
    loadCashRegisters();
    loadAccrualPeriods();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [page, perPage]);

  useEffect(() => {
    // Filter cash registers based on payment method
    if (!paymentForm.payment_method || !cashRegisters.length) {
      setFilteredCashRegisters([]);
      return;
    }
    
    const method = paymentMethods.find(m => m.value === paymentForm.payment_method);
    if (!method) {
      setFilteredCashRegisters([]);
      return;
    }
    
    const filtered = cashRegisters.filter(cr => 
      cr.currency === method.currency && cr.type === method.type
    );
    
    setFilteredCashRegisters(filtered);
    setPaymentForm(prev => ({ ...prev, cash_register_id: '' }));
  }, [paymentForm.payment_method, cashRegisters]);

  // Auto-fill salary when employee selected for accrual
  useEffect(() => {
    if (accrualForm.employee_id) {
      const emp = employees.find(e => e.id === accrualForm.employee_id);
      if (emp && emp.salary) {
        setAccrualForm(prev => ({ ...prev, amount: emp.salary.toString() }));
      }
    }
  }, [accrualForm.employee_id, employees]);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/api/employees/all');
      setEmployees(response.data);
    } catch (error) {
      console.error('Employees load error:', error);
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

  const loadAccrualPeriods = async () => {
    try {
      const response = await api.get('/api/accrual-periods/active');
      setAccrualPeriods(response.data);
    } catch (error) {
      console.error('Accrual periods load error:', error);
    }
  };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (filterEmployee && filterEmployee !== 'all') params.employee_id = filterEmployee;
      if (filterPeriod && filterPeriod !== 'all') params.period = filterPeriod;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;
      
      const data = await employeeService.getSalaryMovements(params);
      setMovements(data.movements || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
        setTotalPages(data.pagination.total_pages || 1);
      }
    } catch (error) {
      toast.error('Maaş hareketleri yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(1);
    loadMovements();
  };

  const handleAccrualSubmit = async () => {
    if (!accrualForm.employee_id) {
      toast.error('Personel seçiniz');
      return;
    }
    if (!accrualForm.period) {
      toast.error('Dönem seçiniz');
      return;
    }
    if (!accrualForm.amount || parseFloat(accrualForm.amount) <= 0) {
      toast.error('Geçerli bir tutar giriniz');
      return;
    }

    try {
      await api.post('/api/salary-movements/accrual', {
        employee_id: accrualForm.employee_id,
        period: accrualForm.period,
        amount: parseFloat(accrualForm.amount),
        description: accrualForm.description || null,
        movement_date: accrualForm.movement_date
      });

      toast.success('Maaş tahakkuku kaydedildi');
      setAccrualDialogOpen(false);
      resetAccrualForm();
      loadMovements();
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentForm.employee_id) {
      toast.error('Personel seçiniz');
      return;
    }
    if (!paymentForm.payment_method) {
      toast.error('Ödeme yöntemi seçiniz');
      return;
    }
    if (!paymentForm.cash_register_id) {
      toast.error('Kasa seçiniz');
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Geçerli bir tutar giriniz');
      return;
    }

    const method = paymentMethods.find(m => m.value === paymentForm.payment_method);
    const isForeign = method && (method.currency === 'USD' || method.currency === 'EUR');
    
    if (isForeign && (!paymentForm.exchange_rate || parseFloat(paymentForm.exchange_rate) <= 0)) {
      toast.error('Döviz kuru giriniz');
      return;
    }

    try {
      await api.post('/api/salary-movements/payment', {
        employee_id: paymentForm.employee_id,
        period: (paymentForm.period && paymentForm.period !== 'none') ? paymentForm.period : null,
        amount: parseFloat(paymentForm.amount),
        currency: method.currency,
        cash_register_id: paymentForm.cash_register_id,
        exchange_rate: isForeign ? parseFloat(paymentForm.exchange_rate) : null,
        description: paymentForm.description || null,
        movement_date: paymentForm.movement_date
      });

      toast.success('Maaş ödemesi kaydedildi');
      setPaymentDialogOpen(false);
      resetPaymentForm();
      loadMovements();
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const resetAccrualForm = () => {
    setAccrualForm({
      employee_id: '',
      period: '',
      amount: '',
      description: '',
      movement_date: new Date().toISOString().split('T')[0]
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      employee_id: '',
      period: '',
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

  const formatPeriod = (period) => {
    if (!period) return '-';
    const [year, month] = period.split('-');
    const months = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return `${months[parseInt(month)]} ${year}`;
  };

  const selectedPaymentMethod = paymentMethods.find(m => m.value === paymentForm.payment_method);
  const isForeignCurrency = selectedPaymentMethod && (selectedPaymentMethod.currency === 'USD' || selectedPaymentMethod.currency === 'EUR');
  const tlEquivalent = isForeignCurrency && paymentForm.amount && paymentForm.exchange_rate
    ? parseFloat(paymentForm.amount) * parseFloat(paymentForm.exchange_rate)
    : 0;

  const selectedEmployee = employees.find(e => e.id === paymentForm.employee_id);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Maaş İşlemleri</h1>
            <p className="text-muted-foreground">Maaş tahakkuk ve ödemelerini yönetin</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { resetAccrualForm(); setAccrualDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Maaş Tahakkuku
            </Button>
            <Button onClick={() => { resetPaymentForm(); setPaymentDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Maaş Ödemesi
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Personel</Label>
                <div className="w-48">
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Tüm personel' },
                      ...employees.map(e => ({ value: e.id, label: e.name }))
                    ]}
                    value={filterEmployee}
                    onChange={setFilterEmployee}
                    placeholder="Personel filtrele..."
                    noOptionsMessage="Personel bulunamadı"
                    isClearable={true}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dönem</Label>
                <div className="w-40">
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Tüm dönemler' },
                      ...accrualPeriods.map(p => ({ value: p.code, label: p.name }))
                    ]}
                    value={filterPeriod}
                    onChange={setFilterPeriod}
                    placeholder="Dönem filtrele..."
                    noOptionsMessage="Dönem bulunamadı"
                    isClearable={true}
                  />
                </div>
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
                Maaş Hareketleri
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
                <Banknote className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz maaş hareketi bulunmuyor</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Tarih</th>
                        <th className="text-left py-3 px-4 font-medium">Personel</th>
                        <th className="text-center py-3 px-4 font-medium">İşlem</th>
                        <th className="text-left py-3 px-4 font-medium">Dönem</th>
                        <th className="text-right py-3 px-4 font-medium">Tutar</th>
                        <th className="text-left py-3 px-4 font-medium">Kasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{formatDate(movement.movement_date)}</td>
                          <td className="py-3 px-4 font-medium">{movement.employee_name}</td>
                          <td className="py-3 px-4 text-center">
                            {movement.type === 'ACCRUAL' ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Tahakkuk
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Ödeme
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">{formatPeriod(movement.period)}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {formatTL(movement.amount)} {movement.currency}
                            {movement.tl_equivalent && (
                              <div className="text-xs text-muted-foreground">
                                ({formatTL(movement.tl_equivalent)} TL)
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {movement.cash_register_name || '-'}
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

        {/* Accrual Dialog */}
        <Dialog open={accrualDialogOpen} onOpenChange={setAccrualDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Maaş Tahakkuku</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Personel *</Label>
                <SearchableSelect
                  options={employees.map(e => ({ value: e.id, label: e.name }))}
                  value={accrualForm.employee_id}
                  onChange={(v) => setAccrualForm({ ...accrualForm, employee_id: v })}
                  placeholder="Personel ara ve seç..."
                  noOptionsMessage="Personel bulunamadı"
                />
              </div>
              <div className="space-y-2">
                <Label>Dönem *</Label>
                <SearchableSelect
                  options={accrualPeriods.map(p => ({ value: p.code, label: p.name }))}
                  value={accrualForm.period}
                  onChange={(v) => setAccrualForm({ ...accrualForm, period: v })}
                  placeholder="Dönem ara ve seç..."
                  noOptionsMessage="Dönem bulunamadı"
                />
              </div>
              <div className="space-y-2">
                <Label>Tutar (TL) *</Label>
                <Input
                  type="number"
                  value={accrualForm.amount}
                  onChange={(e) => setAccrualForm({ ...accrualForm, amount: e.target.value })}
                  placeholder="Maaş otomatik gelir"
                />
              </div>
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Input
                  value={accrualForm.description}
                  onChange={(e) => setAccrualForm({ ...accrualForm, description: e.target.value })}
                  placeholder="Örn: Aralık 2025 maaşı"
                />
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                ℹ️ Tahakkuk kasaya dokunmaz, sadece maaş borcu kaydı oluşturur.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccrualDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleAccrualSubmit}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Maaş Ödemesi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>İşlem Tarihi *</Label>
                <Input
                  type="date"
                  value={paymentForm.movement_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, movement_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Personel *</Label>
                <SearchableSelect
                  options={employees.map(e => ({ 
                    value: e.id, 
                    label: `${e.name} (Bakiye: ${formatTL(e.salary_balance)} ₺)` 
                  }))}
                  value={paymentForm.employee_id}
                  onChange={(v) => setPaymentForm({ ...paymentForm, employee_id: v })}
                  placeholder="Personel ara ve seç..."
                  noOptionsMessage="Personel bulunamadı"
                />
                {selectedEmployee && selectedEmployee.salary_balance < 0 && (
                  <p className="text-sm text-red-600">
                    Maaş Bakiyesi: {formatTL(selectedEmployee.salary_balance)} ₺ (Biz borçluyuz)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Dönem</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Belirtilmemiş' },
                    ...accrualPeriods.map(p => ({ value: p.code, label: p.name }))
                  ]}
                  value={paymentForm.period}
                  onChange={(v) => setPaymentForm({ ...paymentForm, period: v })}
                  placeholder="Dönem seçin (opsiyonel)"
                  noOptionsMessage="Dönem bulunamadı"
                  isClearable={true}
                />
              </div>
              <div className="space-y-2">
                <Label>Ödeme Yöntemi *</Label>
                <Select 
                  value={paymentForm.payment_method} 
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}
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
              <div className="space-y-2">
                <Label>Kasa *</Label>
                <Select 
                  value={paymentForm.cash_register_id} 
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, cash_register_id: v })}
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
              {isForeignCurrency && (
                <div className="space-y-2">
                  <Label>Döviz Kuru (TL/{selectedPaymentMethod?.currency})</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={paymentForm.exchange_rate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, exchange_rate: e.target.value })}
                    placeholder="Örn: 42.50"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Tutar ({selectedPaymentMethod?.currency || 'TRY'}) *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="Tutar giriniz"
                />
              </div>
              {isForeignCurrency && paymentForm.amount && paymentForm.exchange_rate && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">TL Karşılığı:</span>
                    <span className="font-mono font-semibold">{formatTL(tlEquivalent)} TL</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Input
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  placeholder="Örn: Aralık maaş ödemesi"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handlePaymentSubmit}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SalaryMovementsPage;
