import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Users, Edit, Trash2, ChevronLeft, ChevronRight, Phone, Mail, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '../../services';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
    salary: '',
    start_date: '',
    notes: ''
  });

  useEffect(() => {
    loadEmployees();
  }, [page, perPage]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await employeeService.getAll({ page, per_page: perPage });
      setEmployees(data.employees || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
        setTotalPages(data.pagination.total_pages || 1);
      }
    } catch (error) {
      toast.error('Personeller yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Personel adı zorunludur');
      return;
    }

    try {
      const payload = {
        ...formData,
        salary: formData.salary ? parseFloat(formData.salary) : 0
      };
      
      if (editingEmployee) {
        await employeeService.update(editingEmployee.id, payload);
        toast.success('Personel güncellendi');
      } else {
        await employeeService.create(payload);
        toast.success('Personel eklendi');
      }
      
      setDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
      setPage(1);
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Hata: ' + error.message);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name || '',
      position: employee.position || '',
      phone: employee.phone || '',
      email: employee.email || '',
      salary: employee.salary?.toString() || '',
      start_date: employee.start_date || '',
      notes: employee.notes || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;

    try {
      await employeeService.delete(employeeToDelete.id);
      toast.success('Personel silindi');
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      loadEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Silme başarısız');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      position: '',
      phone: '',
      email: '',
      salary: '',
      start_date: '',
      notes: ''
    });
  };

  const handlePerPageChange = (value) => {
    setPerPage(parseInt(value));
    setPage(1);
  };

  const openNewDialog = () => {
    setEditingEmployee(null);
    resetForm();
    setDialogOpen(true);
  };

  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Personel</h1>
            <p className="text-muted-foreground">Çalışanları ve maaş/borç bakiyelerini yönetin</p>
          </div>
          <Button onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Personel
          </Button>
        </div>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Personel Listesi
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
            ) : employees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz personel bulunmuyor</p>
                <Button variant="link" onClick={openNewDialog} className="mt-2">
                  İlk personeli ekleyin
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Ad Soyad</th>
                        <th className="text-left py-3 px-4 font-medium">Pozisyon</th>
                        <th className="text-right py-3 px-4 font-medium">Maaş</th>
                        <th className="text-right py-3 px-4 font-medium">Maaş Bakiye</th>
                        <th className="text-right py-3 px-4 font-medium">Borç Bakiye</th>
                        <th className="text-center py-3 px-4 font-medium">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((employee) => (
                        <tr key={employee.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div className="font-medium">{employee.name}</div>
                            {employee.phone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {employee.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {employee.position ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Briefcase className="w-3 h-3" />
                                {employee.position}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatTL(employee.salary)} ₺
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${
                            employee.salary_balance < 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatTL(employee.salary_balance)} ₺
                            {employee.salary_balance < 0 && (
                              <div className="text-xs text-muted-foreground">Biz borçluyuz</div>
                            )}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${
                            employee.debt_balance > 0 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {formatTL(employee.debt_balance)} ₺
                            {employee.debt_balance > 0 && (
                              <div className="text-xs text-muted-foreground">Çalışan borçlu</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(employee)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => {
                                  setEmployeeToDelete(employee);
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

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Personel Düzenle' : 'Yeni Personel'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Personel adı"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Pozisyon</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Satış Danışmanı"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0532 111 2233"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="personel@email.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">Aylık Maaş (TL)</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="30000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">İşe Başlama Tarihi</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ek notlar"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleSubmit}>
                {editingEmployee ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Personel Sil</DialogTitle>
            </DialogHeader>
            <p className="py-4">
              <strong>{employeeToDelete?.name}</strong> isimli personeli silmek istediğinize emin misiniz?
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

export default EmployeesPage;
