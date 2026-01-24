import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cashService } from '../services';
import api from '../lib/api';

const CashRegistersPage = () => {
  const [loading, setLoading] = useState(true);
  const [registers, setRegisters] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'CASH',
    currency: 'TRY',
    is_active: true
  });

  const fetchRegisters = async () => {
    try {
      setLoading(true);
      const data = await cashService.getRegisters();
      setRegisters(data);
    } catch (error) {
      console.error('Error fetching registers:', error);
      toast.error('Kasalar alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisters();
  }, []);

  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.code) {
        toast.error('Ad ve kod zorunludur');
        return;
      }
      
      if (editingRegister) {
        await cashService.updateRegister(editingRegister.id, {
          name: formData.name,
          is_active: formData.is_active
        });
        toast.success('Kasa güncellendi');
      } else {
        await api.post('/api/cash-registers', formData);
        toast.success('Kasa oluşturuldu');
      }
      
      setDialogOpen(false);
      setEditingRegister(null);
      setFormData({ name: '', code: '', type: 'CASH', currency: 'TRY', is_active: true });
      fetchRegisters();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleEdit = (register) => {
    setEditingRegister(register);
    setFormData({
      name: register.name,
      code: register.code,
      type: register.type,
      currency: register.currency,
      is_active: register.is_active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (register) => {
    if (!window.confirm(`"${register.name}" kasasını silmek istediğinize emin misiniz?`)) {
      return;
    }
    
    try {
      const response = await api.delete(`/api/cash-registers/${register.id}`);
      toast.success(response.data?.message || 'Kasa silindi');
      fetchRegisters();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Silme işlemi başarısız');
    }
  };

  const formatCurrency = (amount, currency) => {
    const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€';
    return `${parseFloat(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/cash">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Kasa Tanımları</h1>
            <p className="text-muted-foreground mt-1">Nakit ve banka hesaplarınızı yönetin</p>
          </div>
        </div>
        <Button onClick={() => {
          setEditingRegister(null);
          setFormData({ name: '', code: '', type: 'CASH', currency: 'TRY', is_active: true });
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Kasa
        </Button>
      </div>

      {/* Registers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Tanımlı Kasalar ({registers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">ID</th>
                  <th className="text-left py-3 px-4 font-medium">Kasa Adı</th>
                  <th className="text-left py-3 px-4 font-medium">Kod</th>
                  <th className="text-left py-3 px-4 font-medium">Tip</th>
                  <th className="text-left py-3 px-4 font-medium">Para Birimi</th>
                  <th className="text-right py-3 px-4 font-medium">Bakiye</th>
                  <th className="text-center py-3 px-4 font-medium">Durum</th>
                  <th className="text-center py-3 px-4 font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {registers.map((register) => (
                  <tr key={register.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 text-muted-foreground text-sm">{register.id}</td>
                    <td className="py-3 px-4 font-medium">{register.name}</td>
                    <td className="py-3 px-4">
                      <code className="bg-muted px-2 py-1 rounded text-sm">{register.code}</code>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={register.type === 'CASH' ? 'default' : 'secondary'}>
                        {register.type === 'CASH' ? 'Nakit' : 'Banka'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{register.currency}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {formatCurrency(register.current_balance, register.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={register.is_active ? 'default' : 'destructive'}>
                        {register.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(register)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(register)}
                          className="text-destructive hover:text-destructive"
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
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRegister ? 'Kasa Düzenle' : 'Yeni Kasa'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kasa Adı *</Label>
              <Input
                placeholder="örn: TL Kasa"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            {!editingRegister && (
              <>
                <div>
                  <Label>Kasa Kodu *</Label>
                  <Input
                    placeholder="örn: TL_CASH"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>
                
                <div>
                  <Label>Tip</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Nakit</SelectItem>
                      <SelectItem value="BANK">Banka</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Para Birimi</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY (₺)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              {editingRegister ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashRegistersPage;
