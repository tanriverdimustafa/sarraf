import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Plus, FolderOpen, Edit, Trash2, Save, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { expenseService } from '../../services';

const ExpenseCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await expenseService.getCategories();
      setCategories(data);
    } catch (error) {
      toast.error('Kategoriler yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        code: category.code,
        name: category.name,
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({ code: '', name: '', description: '' });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({ code: '', name: '', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name) {
      toast.error('Kod ve isim zorunludur');
      return;
    }
    
    try {
      if (editingCategory) {
        await expenseService.updateCategory(editingCategory.id, {
          name: formData.name,
          description: formData.description,
        });
        toast.success('Kategori güncellendi');
      } else {
        await expenseService.createCategory(formData);
        toast.success('Kategori oluşturuldu');
      }
      
      handleCloseDialog();
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`"${category.name}" kategorisini silmek istediğinize emin misiniz?`)) {
      return;
    }
    
    try {
      const result = await expenseService.deleteCategory(category.id);
      toast.success(result.message || 'Kategori silindi');
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };

  const handleToggleActive = async (category) => {
    try {
      await expenseService.updateCategory(category.id, { is_active: !category.is_active });
      toast.success(`Kategori ${category.is_active ? 'pasifleştirildi' : 'aktifleştirildi'}`);
      loadCategories();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold">Gider Kategorileri</h1>
              <p className="text-muted-foreground">Gider kategorilerini yönetin</p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kategori
          </Button>
        </div>

        {/* Categories Table */}
        <Card>
          <CardHeader>
            <CardTitle>Kategori Listesi</CardTitle>
            <CardDescription>Tüm gider kategorileri</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz kategori bulunmuyor</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Kod</th>
                      <th className="text-left py-3 px-4 font-medium">Kategori Adı</th>
                      <th className="text-left py-3 px-4 font-medium">Açıklama</th>
                      <th className="text-center py-3 px-4 font-medium">Durum</th>
                      <th className="text-center py-3 px-4 font-medium">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className={`border-b hover:bg-muted/50 ${!cat.is_active ? 'opacity-50' : ''}`}>
                        <td className="py-3 px-4 font-mono text-sm">{cat.code}</td>
                        <td className="py-3 px-4 font-medium">{cat.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{cat.description || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${cat.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {cat.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(cat)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(cat)}
                            >
                              {cat.is_active ? (
                                <X className="w-4 h-4 text-red-600" />
                              ) : (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(cat)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}</DialogTitle>
              <DialogDescription>
                {editingCategory ? 'Kategori bilgilerini güncelleyin' : 'Yeni bir gider kategorisi oluşturun'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Kod *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="RENT"
                    disabled={!!editingCategory}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Benzersiz kategori kodu (değiştirilemez)</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Kategori Adı *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Kira"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Kategori açıklaması..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  İptal
                </Button>
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  {editingCategory ? 'Güncelle' : 'Oluştur'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ExpenseCategoriesPage;
