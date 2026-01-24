import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, History, ChevronLeft, ChevronRight, Filter, ArrowUpCircle, ArrowDownCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { cashService } from '../../services';
import api from '../../lib/api';

const paymentMethods = [
  { value: 'CASH_TRY', label: 'Nakit TL', currency: 'TRY', type: 'CASH' },
  { value: 'BANK_TRY', label: 'Havale TL', currency: 'TRY', type: 'BANK' },
  { value: 'CASH_USD', label: 'Nakit USD', currency: 'USD', type: 'CASH' },
  { value: 'BANK_USD', label: 'Havale USD', currency: 'USD', type: 'BANK' },
  { value: 'CASH_EUR', label: 'Nakit EUR', currency: 'EUR', type: 'CASH' },
  { value: 'BANK_EUR', label: 'Havale EUR', currency: 'EUR', type: 'BANK' },
];

const EmployeeDebtsPage = () => {
  const [movements, setMovements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cashRegisters, setCashRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Dialogs
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    employee_id: '',
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

  const loadMovements = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (filterEmployee && filterEmployee !== 'all') params.employee_id = filterEmployee;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;
      
      const response = await api.get('/api/employee-debts', { params });
      const data = response.data;
      setMovements(data.movements || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
        setTotalPages(data.pagination.total_pages || 1);
      }
    } catch (error) {
      toast.error('Borç hareketleri yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(1);
    loadMovements();
  };

  const handleSubmit = async (type) => {
    if (!formData.employee_id) {
      toast.error('Personel seçiniz');
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
    if (type === 'DEBT' && !formData.description) {
      toast.error('Borç için açıklama zorunludur');
      return;
    }

    const method = paymentMethods.find(m => m.value === formData.payment_method);
    const isForeign = method && (method.currency === 'USD' || method.currency === 'EUR');
    
    if (isForeign && (!formData.exchange_rate || parseFloat(formData.exchange_rate) <= 0)) {
      toast.error('Döviz kuru giriniz');
      return;
    }

    const endpoint = type === 'DEBT' ? '/api/employee-debts/debt' : '/api/employee-debts/payment';

    try {
      await api.post(endpoint, {
        employee_id: formData.employee_id,
        type: type,
        amount: parseFloat(formData.amount),
        currency: method.currency,
        cash_register_id: formData.cash_register_id,
        exchange_rate: isForeign ? parseFloat(formData.exchange_rate) : null,
        description: formData.description || null,
        movement_date: formData.movement_date
      });

      toast.success(type === 'DEBT' ? 'Borç verme kaydedildi' : 'Borç tahsilatı kaydedildi');
      setDebtDialogOpen(false);
      setPaymentDialogOpen(false);
      resetForm();
      loadMovements();
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
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

  const selectedEmployee = employees.find(e => e.id === formData.employee_id);

  const renderForm = (type) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>İşlem Tarihi *</Label>
        <Input
          type="date"
          value={formData.movement_date}
          onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Personel *</Label>
        <Select 
          value={formData.employee_id} 
          onValueChange={(v) => setFormData({ ...formData, employee_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Personel seçin" />
          </SelectTrigger>
          <SelectContent>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} (Borç: {formatTL(e.debt_balance)} ₺)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedEmployee && selectedEmployee.debt_balance > 0 && (
          <p className="text-sm text-orange-600">
            Mevcut Borcu: {formatTL(selectedEmployee.debt_balance)} ₺
          </p>
        )}
      </div>
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
      {isForeignCurrency && (
        <div className="space-y-2">
          <Label>Döviz Kuru (TL/{selectedMethod?.currency})</Label>
          <Input
            type="number"
            step="0.0001"
            value={formData.exchange_rate}
            onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
            placeholder="Örn: 42.50"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Tutar ({selectedMethod?.currency || 'TRY'}) *</Label>
        <Input
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          placeholder="Tutar giriniz"
        />
      </div>
      {isForeignCurrency && formData.amount && formData.exchange_rate && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">TL Karşılığı:</span>
            <span className="font-mono font-semibold">{formatTL(tlEquivalent)} TL</span>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Açıklama {type === 'DEBT' ? '*' : ''}</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={type === 'DEBT' ? 'Örn: Avans' : 'Örn: Borç ödemesi'}
        />
      </div>
      <div className={`p-3 rounded-lg text-sm ${
        type === 'DEBT' 
          ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
          : 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
      }`}>
        {type === 'DEBT' 
          ? '⚠️ Borç verme: Kasadan ÇIKIŞ yapılır, çalışan borcu ARTAR.'
          : '✅ Borç tahsilatı: Kasaya GİRİŞ yapılır, çalışan borcu AZALIR.'}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Personel Borç İşlemleri</h1>
            <p className="text-muted-foreground">Personel avans ve borç tahsilatlarını yönetin</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { resetForm(); setDebtDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Borç Ver
            </Button>
            <Button onClick={() => { resetForm(); setPaymentDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Borç Tahsilatı
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Personel</Label>
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tüm personel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm personel</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
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
                <CreditCard className="w-5 h-5" />
                Borç Hareketleri
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
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz borç hareketi bulunmuyor</p>
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
                        <th className="text-right py-3 px-4 font-medium">Tutar</th>
                        <th className="text-left py-3 px-4 font-medium">Kasa</th>
                        <th className="text-left py-3 px-4 font-medium">Açıklama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((movement) => (
                        <tr key={movement.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{formatDate(movement.movement_date)}</td>
                          <td className="py-3 px-4 font-medium">{movement.employee_name}</td>
                          <td className="py-3 px-4 text-center">
                            {movement.type === 'DEBT' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                <ArrowDownCircle className="w-3 h-3" />
                                Borç Verme
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <ArrowUpCircle className="w-3 h-3" />
                                Tahsilat
                              </span>
                            )}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${
                            movement.type === 'DEBT' ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {movement.type === 'DEBT' ? '-' : '+'}{formatTL(movement.amount)} {movement.currency}
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

        {/* Debt Dialog */}
        <Dialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Personele Borç Verme</DialogTitle>
            </DialogHeader>
            {renderForm('DEBT')}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDebtDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={() => handleSubmit('DEBT')}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Personel Borç Tahsilatı</DialogTitle>
            </DialogHeader>
            {renderForm('PAYMENT')}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={() => handleSubmit('PAYMENT')}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default EmployeeDebtsPage;
