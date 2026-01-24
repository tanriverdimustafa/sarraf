import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Users, Edit, Trash2, ChevronLeft, ChevronRight, Phone, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { partnerService } from '../../services';

const PartnersPage = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  useEffect(() => {
    loadPartners();
  }, [page, perPage]);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const data = await partnerService.getAll({ page, per_page: perPage });
      setPartners(data.partners || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
        setTotalPages(data.pagination.total_pages || 1);
      }
    } catch (error) {
      toast.error('Ortaklar yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Ortak adı zorunludur');
      return;
    }

    try {
      if (editingPartner) {
        await partnerService.update(editingPartner.id, formData);
        toast.success('Ortak güncellendi');
      } else {
        await partnerService.create(formData);
        toast.success('Ortak eklendi');
      }
      
      setDialogOpen(false);
      setEditingPartner(null);
      setFormData({ name: '', phone: '', email: '', notes: '' });
      setPage(1);
      loadPartners();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name || '',
      phone: partner.phone || '',
      email: partner.email || '',
      notes: partner.notes || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!partnerToDelete) return;

    try {
      await partnerService.delete(partnerToDelete.id);
      toast.success('Ortak silindi');
      setDeleteDialogOpen(false);
      setPartnerToDelete(null);
      loadPartners();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Silme başarısız');
    }
  };

  const handlePerPageChange = (value) => {
    setPerPage(parseInt(value));
    setPage(1);
  };

  const openNewDialog = () => {
    setEditingPartner(null);
    setFormData({ name: '', phone: '', email: '', notes: '' });
    setDialogOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ortaklar</h1>
            <p className="text-muted-foreground">Şirket ortaklarını yönetin</p>
          </div>
          <Button onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Ortak
          </Button>
        </div>

        {/* Partners Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ortak Listesi
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
            ) : partners.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz ortak bulunmuyor</p>
                <Button variant="link" onClick={openNewDialog} className="mt-2">
                  İlk ortağı ekleyin
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Ad Soyad</th>
                        <th className="text-left py-3 px-4 font-medium">Telefon</th>
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Notlar</th>
                        <th className="text-center py-3 px-4 font-medium">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((partner) => (
                        <tr key={partner.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{partner.name}</td>
                          <td className="py-3 px-4">
                            {partner.phone ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="w-3 h-3" />
                                {partner.phone}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4">
                            {partner.email ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                {partner.email}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                            {partner.notes || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(partner)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => {
                                  setPartnerToDelete(partner);
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
                {editingPartner ? 'Ortak Düzenle' : 'Yeni Ortak'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ortak adı"
                />
              </div>
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
                  placeholder="ortak@email.com"
                />
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
                {editingPartner ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ortak Sil</DialogTitle>
            </DialogHeader>
            <p className="py-4">
              <strong>{partnerToDelete?.name}</strong> isimli ortağı silmek istediğinize emin misiniz?
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

export default PartnersPage;
