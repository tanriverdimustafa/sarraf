import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Calendar, Edit, Lock, Unlock, ChevronLeft, ChevronRight, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const months = [
  { value: 1, label: 'Ocak' },
  { value: 2, label: 'Şubat' },
  { value: 3, label: 'Mart' },
  { value: 4, label: 'Nisan' },
  { value: 5, label: 'Mayıs' },
  { value: 6, label: 'Haziran' },
  { value: 7, label: 'Temmuz' },
  { value: 8, label: 'Ağustos' },
  { value: 9, label: 'Eylül' },
  { value: 10, label: 'Ekim' },
  { value: 11, label: 'Kasım' },
  { value: 12, label: 'Aralık' },
];

const AccrualPeriodsPage = () => {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  useEffect(() => {
    loadPeriods();
  }, [page, perPage]);

  const loadPeriods = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/accrual-periods?page=${page}&per_page=${perPage}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPeriods(data.periods || []);
        if (data.pagination) {
          setTotalCount(data.pagination.total || 0);
          setTotalPages(data.pagination.total_pages || 1);
        }
      }
    } catch (error) {
      toast.error('Dönemler yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/accrual-periods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          year: formData.year,
          month: formData.month
        })
      });

      if (res.ok) {
        toast.success('Dönem eklendi');
        setDialogOpen(false);
        setPage(1);
        loadPeriods();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'İşlem başarısız');
      }
    } catch (error) {
      toast.error('Hata: ' + error.message);
    }
  };

  const handleClose = async () => {
    if (!selectedPeriod) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/accrual-periods/${selectedPeriod.id}/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Dönem kapatıldı');
        setCloseDialogOpen(false);
        setSelectedPeriod(null);
        loadPeriods();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'İşlem başarısız');
      }
    } catch (error) {
      toast.error('Hata: ' + error.message);
    }
  };

  const handleReopen = async (period) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/accrual-periods/${period.id}/reopen`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Dönem yeniden açıldı');
        loadPeriods();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'İşlem başarısız');
      }
    } catch (error) {
      toast.error('Hata: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedPeriod) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/accrual-periods/${selectedPeriod.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Dönem silindi');
        setDeleteDialogOpen(false);
        setSelectedPeriod(null);
        loadPeriods();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Silme başarısız');
      }
    } catch (error) {
      toast.error('Hata: ' + error.message);
    }
  };

  const handlePerPageChange = (value) => {
    setPerPage(parseInt(value));
    setPage(1);
  };

  const openNewDialog = () => {
    setFormData({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1
    });
    setDialogOpen(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  };

  // Generate preview
  const selectedMonth = months.find(m => m.value === formData.month);
  const previewName = selectedMonth ? `${selectedMonth.label} ${formData.year}` : '';
  const previewCode = `${formData.year}-${formData.month.toString().padStart(2, '0')}`;

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tahakkuk Dönemleri</h1>
            <p className="text-muted-foreground">Maaş tahakkuk dönemlerini yönetin</p>
          </div>
          <Button onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Dönem
          </Button>
        </div>

        {/* Periods Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Dönem Listesi
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
            ) : periods.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz dönem bulunmuyor</p>
                <Button variant="link" onClick={openNewDialog} className="mt-2">
                  İlk dönemi ekleyin
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Kod</th>
                        <th className="text-left py-3 px-4 font-medium">Dönem Adı</th>
                        <th className="text-left py-3 px-4 font-medium">Başlangıç</th>
                        <th className="text-left py-3 px-4 font-medium">Bitiş</th>
                        <th className="text-center py-3 px-4 font-medium">Durum</th>
                        <th className="text-center py-3 px-4 font-medium">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-mono">{period.code}</td>
                          <td className="py-3 px-4 font-medium">{period.name}</td>
                          <td className="py-3 px-4">{formatDate(period.start_date)}</td>
                          <td className="py-3 px-4">{formatDate(period.end_date)}</td>
                          <td className="py-3 px-4 text-center">
                            {period.is_closed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                                <XCircle className="w-3 h-3" />
                                Kapalı
                              </span>
                            ) : period.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                Pasif
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {!period.is_closed ? (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  title="Dönemi Kapat"
                                  onClick={() => {
                                    setSelectedPeriod(period);
                                    setCloseDialogOpen(true);
                                  }}
                                >
                                  <Lock className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  title="Dönemi Aç"
                                  onClick={() => handleReopen(period)}
                                >
                                  <Unlock className="w-4 h-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                title="Sil"
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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

        {/* Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Tahakkuk Dönemi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Yıl *</Label>
                  <Select 
                    value={formData.year.toString()} 
                    onValueChange={(v) => setFormData({ ...formData, year: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ay *</Label>
                  <Select 
                    value={formData.month.toString()} 
                    onValueChange={(v) => setFormData({ ...formData, month: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Preview */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Dönem Kodu:</span>
                  <span className="font-mono">{previewCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Dönem Adı:</span>
                  <span className="font-medium">{previewName}</span>
                </div>
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

        {/* Close Confirmation Dialog */}
        <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dönem Kapat</DialogTitle>
            </DialogHeader>
            <p className="py-4">
              <strong>{selectedPeriod?.name}</strong> dönemini kapatmak istediğinize emin misiniz?
              <br /><br />
              <span className="text-sm text-muted-foreground">
                Kapalı dönemlere maaş tahakkuku veya ödemesi yapılamaz.
              </span>
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleClose}>
                <Lock className="w-4 h-4 mr-2" />
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dönem Sil</DialogTitle>
            </DialogHeader>
            <p className="py-4">
              <strong>{selectedPeriod?.name}</strong> dönemini silmek istediğinize emin misiniz?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                İptal
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AccrualPeriodsPage;
