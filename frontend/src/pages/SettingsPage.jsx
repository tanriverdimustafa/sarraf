import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Edit, Trash2, Settings, Shield, Coins, CreditCard, DollarSign, Package, Users, Wrench, Archive, FileText, Calendar, Lock, LockOpen, ChevronLeft, ChevronRight, Store, Save, Sun, Moon, Palette } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// Lookup configuration for each tab
const LOOKUP_TABS = [
  {
    key: 'karats',
    name: 'Ayarlar (Karat)',
    icon: Coins,
    endpoint: 'karats',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'name', label: 'Ad', editable: true },
      { key: 'karat', label: 'Karat Kodu', editable: true, hint: 'Örn: 22K' },
      { key: 'fineness', label: 'Saflık', type: 'decimal', editable: true, hint: '0-1 arası' },
    ],
    defaultValues: { name: '', karat: '', fineness: '' }
  },
  {
    key: 'payment-methods',
    name: 'Ödeme Yöntemleri',
    icon: CreditCard,
    endpoint: 'payment-methods',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
      { key: 'commission_rate', label: 'Komisyon (%)', type: 'decimal', editable: true },
    ],
    defaultValues: { code: '', name: '', commission_rate: 0 }
  },
  {
    key: 'currencies',
    name: 'Para Birimleri',
    icon: DollarSign,
    endpoint: 'currencies',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
      { key: 'symbol', label: 'Sembol', editable: true },
    ],
    defaultValues: { code: '', name: '', symbol: '' }
  },
  {
    key: 'product-types',
    name: 'Ürün Tipleri',
    icon: Package,
    endpoint: 'product-types',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
      { key: 'is_gold_based', label: 'Altın Bazlı', type: 'boolean', editable: true },
      { key: 'unit', label: 'Birim', type: 'select', options: ['GRAM', 'PIECE'], editable: true },
      { key: 'fixed_weight', label: 'Sabit Ağırlık', type: 'decimal', editable: true, hint: 'Opsiyonel' },
      { key: 'fineness', label: 'Milyem', type: 'decimal', editable: true, hint: 'Örn: 0.575' },
      { key: 'default_labor_rate', label: 'Default İşçilik (HAS/gr)', type: 'decimal', editable: true, hint: 'Örn: 0.044' },
      { key: 'has_labor', label: 'İşçilik Var', type: 'boolean', editable: true },
    ],
    defaultValues: { code: '', name: '', is_gold_based: false, unit: 'GRAM', fixed_weight: null, fineness: null, default_labor_rate: 0.010, has_labor: true }
  },
  {
    key: 'party-types',
    name: 'Cari Tipleri',
    icon: Users,
    endpoint: 'party-types',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
    ],
    defaultValues: { code: '', name: '' }
  },
  {
    key: 'labor-types',
    name: 'İşçilik Tipleri',
    icon: Wrench,
    endpoint: 'labor-types',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
    ],
    defaultValues: { code: '', name: '' }
  },
  {
    key: 'stock-statuses',
    name: 'Stok Durumları',
    icon: Archive,
    endpoint: 'stock-statuses',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
    ],
    defaultValues: { code: '', name: '' }
  },
  {
    key: 'transaction-types',
    name: 'İşlem Tipleri',
    icon: FileText,
    endpoint: 'transaction-types',
    columns: [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'code', label: 'Kod', editable: true },
      { key: 'name', label: 'Ad', editable: true },
    ],
    defaultValues: { code: '', name: '' }
  },
];

// Turkish month names
const TURKISH_MONTHS = [
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

const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('karats');
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // Accrual Periods State
  const [accrualPeriods, setAccrualPeriods] = useState([]);
  const [accrualPagination, setAccrualPagination] = useState({ page: 1, per_page: 10, total: 0, total_pages: 1 });
  const [accrualDialogOpen, setAccrualDialogOpen] = useState(false);
  const [accrualFormData, setAccrualFormData] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  
  // Shop Name State
  const [shopName, setShopName] = useState('');
  const [shopNameLoading, setShopNameLoading] = useState(false);

  const activeConfig = LOOKUP_TABS.find(t => t.key === activeTab);

  const fetchItems = useCallback(async (lookupKey) => {
    const config = LOOKUP_TABS.find(t => t.key === lookupKey);
    if (!config) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/lookups/${config.endpoint}`);
      setItems(prev => ({ ...prev, [lookupKey]: response.data }));
    } catch (error) {
      console.error(`Error fetching ${lookupKey}:`, error);
      toast.error(`${config.name} yüklenemedi`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccrualPeriods = useCallback(async (page = 1, perPage = 10) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/accrual-periods?page=${page}&per_page=${perPage}`);
      setAccrualPeriods(response.data.periods || []);
      setAccrualPagination(response.data.pagination || { page: 1, per_page: perPage, total: 0, total_pages: 1 });
    } catch (error) {
      console.error('Error fetching accrual periods:', error);
      toast.error('Tahakkuk dönemleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShopName = useCallback(async () => {
    try {
      const response = await api.get('/api/labels/settings/shop-name');
      setShopName(response.data.shop_name || '');
    } catch (error) {
      console.error('Error fetching shop name:', error);
    }
  }, []);

  const handleSaveShopName = async () => {
    if (!shopName.trim()) {
      toast.error('Dükkan adı boş olamaz');
      return;
    }
    
    try {
      setShopNameLoading(true);
      await api.put('/api/labels/settings/shop-name', { shop_name: shopName.trim() });
      toast.success('Dükkan adı kaydedildi');
    } catch (error) {
      console.error('Error saving shop name:', error);
      toast.error('Dükkan adı kaydedilemedi');
    } finally {
      setShopNameLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'accrual-periods') {
      fetchAccrualPeriods(accrualPagination.page, accrualPagination.per_page);
    } else if (activeTab === 'shop-settings') {
      fetchShopName();
    } else {
      fetchItems(activeTab);
    }
  }, [activeTab, fetchItems, fetchAccrualPeriods, fetchShopName]);

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData({ ...activeConfig.defaultValues });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { ...formData };
      delete payload.id;
      delete payload._id;
      delete payload.created_at;
      delete payload.updated_at;

      if (editingItem) {
        await api.put(`/api/lookups/${activeConfig.endpoint}/${editingItem.id}`, payload);
        toast.success('Kayıt güncellendi');
      } else {
        await api.post(`/api/lookups/${activeConfig.endpoint}`, payload);
        toast.success('Kayıt oluşturuldu');
      }

      handleCloseDialog();
      fetchItems(activeTab);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(error.response?.data?.detail || 'Kayıt işlemi başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.name || item.code}" kaydını silmek istediğinize emin misiniz?`)) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/api/lookups/${activeConfig.endpoint}/${item.id}`);
      toast.success('Kayıt silindi');
      fetchItems(activeTab);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(error.response?.data?.detail || 'Kayıt silinemedi');
    } finally {
      setLoading(false);
    }
  };

  // Accrual Period Functions
  const handleCreateAccrualPeriod = async () => {
    try {
      setLoading(true);
      await api.post('/api/accrual-periods', { year: parseInt(accrualFormData.year), month: parseInt(accrualFormData.month) });
      toast.success('Dönem oluşturuldu');
      setAccrualDialogOpen(false);
      fetchAccrualPeriods(1, accrualPagination.per_page);
    } catch (error) {
      console.error('Error creating period:', error);
      toast.error(error.response?.data?.detail || 'Dönem oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAccrualPeriod = async (period) => {
    if (!window.confirm(`"${period.name}" dönemini kapatmak istediğinize emin misiniz? Kapalı döneme tahakkuk/ödeme yapılamaz.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/accrual-periods/${period.id}/close`, {});
      toast.success('Dönem kapatıldı');
      fetchAccrualPeriods(accrualPagination.page, accrualPagination.per_page);
    } catch (error) {
      console.error('Error closing period:', error);
      toast.error(error.response?.data?.detail || 'Dönem kapatılamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleReopenAccrualPeriod = async (period) => {
    if (!window.confirm(`"${period.name}" dönemini tekrar açmak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/api/accrual-periods/${period.id}/reopen`, {});
      toast.success('Dönem açıldı');
      fetchAccrualPeriods(accrualPagination.page, accrualPagination.per_page);
    } catch (error) {
      console.error('Error reopening period:', error);
      toast.error(error.response?.data?.detail || 'Dönem açılamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccrualPeriod = async (period) => {
    if (!window.confirm(`"${period.name}" dönemini silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/api/accrual-periods/${period.id}`);
      toast.success('Dönem silindi');
      fetchAccrualPeriods(accrualPagination.page, accrualPagination.per_page);
    } catch (error) {
      console.error('Error deleting period:', error);
      toast.error(error.response?.data?.detail || 'Dönem silinemedi');
    } finally {
      setLoading(false);
    }
  };

  const renderCellValue = (item, column) => {
    const value = item[column.key];
    
    if (column.type === 'boolean') {
      return value ? (
        <span className="text-green-500 font-medium">Evet</span>
      ) : (
        <span className="text-red-500 font-medium">Hayır</span>
      );
    }
    
    if (column.type === 'decimal' && value !== null && value !== undefined) {
      return column.key === 'commission_rate' 
        ? `%${(parseFloat(value) * 100).toFixed(2)}`
        : parseFloat(value).toFixed(column.key === 'fineness' ? 3 : 2);
    }
    
    return value ?? '-';
  };

  const renderFormField = (column) => {
    if (!column.editable) return null;

    const value = formData[column.key] ?? '';

    if (column.type === 'boolean') {
      return (
        <div key={column.key} className="space-y-2">
          <Label>{column.label}</Label>
          <Select
            value={value ? 'true' : 'false'}
            onValueChange={(val) => handleChange(column.key, val === 'true')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Evet</SelectItem>
              <SelectItem value="false">Hayır</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (column.type === 'select') {
      return (
        <div key={column.key} className="space-y-2">
          <Label>{column.label}</Label>
          <Select
            value={value || ''}
            onValueChange={(val) => handleChange(column.key, val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {column.options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={column.key} className="space-y-2">
        <Label>
          {column.label}
          {column.hint && <span className="text-xs text-muted-foreground ml-2">({column.hint})</span>}
        </Label>
        <Input
          type={column.type === 'number' || column.type === 'decimal' ? 'number' : 'text'}
          step={column.type === 'decimal' ? '0.001' : column.type === 'number' ? '1' : undefined}
          value={value}
          onChange={(e) => handleChange(
            column.key,
            column.type === 'number' ? parseInt(e.target.value) || '' :
            column.type === 'decimal' ? parseFloat(e.target.value) || '' :
            e.target.value
          )}
          placeholder={column.label}
        />
      </div>
    );
  };

  // Calculate preview for new period
  const getMonthName = (month) => {
    const m = TURKISH_MONTHS.find(tm => tm.value === parseInt(month));
    return m ? m.label : '';
  };

  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const previewPeriod = {
    code: `${accrualFormData.year}-${String(accrualFormData.month).padStart(2, '0')}`,
    name: `${getMonthName(accrualFormData.month)} ${accrualFormData.year}`,
    start_date: `01.${String(accrualFormData.month).padStart(2, '0')}.${accrualFormData.year}`,
    end_date: `${getLastDayOfMonth(accrualFormData.year, accrualFormData.month)}.${String(accrualFormData.month).padStart(2, '0')}.${accrualFormData.year}`
  };

  // Check if user is admin (allow ADMIN and SUPER_ADMIN)
  const userRole = user?.role?.toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  
  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Yetkisiz Erişim</h2>
            <p className="text-muted-foreground">Bu sayfayı görüntülemek için admin yetkisi gereklidir.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentItems = items[activeTab] || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Ayarlar</h1>
            <p className="text-muted-foreground mt-1">Sistem lookup tablolarını yönetin</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 lg:grid-cols-10 w-full">
          {LOOKUP_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1 text-xs">
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{tab.name.split(' ')[0]}</span>
              </TabsTrigger>
            );
          })}
          {/* Tahakkuk Dönemleri Tab */}
          <TabsTrigger value="accrual-periods" className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3" />
            <span className="hidden sm:inline">Dönemler</span>
          </TabsTrigger>
          {/* Dükkan Ayarları Tab */}
          <TabsTrigger value="shop-settings" className="flex items-center gap-1 text-xs">
            <Store className="w-3 h-3" />
            <span className="hidden sm:inline">Dükkan</span>
          </TabsTrigger>
          {/* Tema Ayarları Tab */}
          <TabsTrigger value="theme-settings" className="flex items-center gap-1 text-xs">
            <Palette className="w-3 h-3" />
            <span className="hidden sm:inline">Tema</span>
          </TabsTrigger>
        </TabsList>

        {/* Regular Lookup Tabs */}
        {LOOKUP_TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {React.createElement(tab.icon, { className: "w-5 h-5" })}
                  {tab.name} ({currentItems.length})
                </CardTitle>
                <Button onClick={() => handleOpenDialog()} disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Ekle
                </Button>
              </CardHeader>
              <CardContent>
                {loading && currentItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                ) : currentItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Henüz kayıt bulunmuyor</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          {tab.columns.map(col => (
                            <th
                              key={col.key}
                              className="text-left py-3 px-4 font-semibold"
                              style={{ width: col.width }}
                            >
                              {col.label}
                            </th>
                          ))}
                          <th className="text-right py-3 px-4 font-semibold">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((item) => (
                          <tr key={item.id} className="border-b hover:bg-muted/50">
                            {tab.columns.map(col => (
                              <td key={col.key} className="py-3 px-4">
                                {renderCellValue(item, col)}
                              </td>
                            ))}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenDialog(item)}
                                  disabled={loading}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(item)}
                                  disabled={loading}
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Tahakkuk Dönemleri Tab Content */}
        <TabsContent value="accrual-periods">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Tahakkuk Dönemleri ({accrualPagination.total})
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sayfa başı:</span>
                  <Select 
                    value={accrualPagination.per_page.toString()} 
                    onValueChange={(v) => fetchAccrualPeriods(1, parseInt(v))}
                  >
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
                <Button onClick={() => {
                  setAccrualFormData({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
                  setAccrualDialogOpen(true);
                }} disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Dönem
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading && accrualPeriods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
              ) : accrualPeriods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Henüz dönem bulunmuyor</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Kod</th>
                          <th className="text-left py-3 px-4 font-semibold">Dönem Adı</th>
                          <th className="text-left py-3 px-4 font-semibold">Başlangıç</th>
                          <th className="text-left py-3 px-4 font-semibold">Bitiş</th>
                          <th className="text-center py-3 px-4 font-semibold">Durum</th>
                          <th className="text-right py-3 px-4 font-semibold">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accrualPeriods.map((period) => (
                          <tr key={period.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-mono">{period.code}</td>
                            <td className="py-3 px-4 font-medium">{period.name}</td>
                            <td className="py-3 px-4">{period.start_date?.split('-').reverse().join('.')}</td>
                            <td className="py-3 px-4">{period.end_date?.split('-').reverse().join('.')}</td>
                            <td className="py-3 px-4 text-center">
                              {period.is_closed ? (
                                <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  Kapalı
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Aktif
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {period.is_closed ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReopenAccrualPeriod(period)}
                                    disabled={loading}
                                    title="Dönemi Aç"
                                  >
                                    <LockOpen className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCloseAccrualPeriod(period)}
                                    disabled={loading}
                                    title="Dönemi Kapat"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteAccrualPeriod(period)}
                                  disabled={loading}
                                  title="Sil"
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
                      Toplam {accrualPagination.total} kayıt • Sayfa {accrualPagination.page} / {accrualPagination.total_pages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchAccrualPeriods(accrualPagination.page - 1, accrualPagination.per_page)}
                        disabled={accrualPagination.page === 1 || loading}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Önceki
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchAccrualPeriods(accrualPagination.page + 1, accrualPagination.per_page)}
                        disabled={accrualPagination.page === accrualPagination.total_pages || loading}
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
        </TabsContent>

        {/* Dükkan Ayarları Tab Content */}
        <TabsContent value="shop-settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Dükkan Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shop-name">Dükkan Adı</Label>
                  <p className="text-xs text-muted-foreground">
                    Bu isim ürün etiketlerinin ön yüzünde görünecektir
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="shop-name"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Kuyumcu adınızı girin"
                      maxLength={50}
                    />
                    <Button 
                      onClick={handleSaveShopName} 
                      disabled={shopNameLoading || !shopName.trim()}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {shopNameLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Etiket Önizleme:</p>
                  <div className="border rounded bg-white p-3 text-center">
                    <div className="text-sm font-bold">{shopName || 'Kuyumcu'}</div>
                    <div className="text-xs text-muted-foreground mt-1">|||||||||||||||</div>
                    <div className="text-xs font-mono">PRD-001</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tema Ayarları Tab Content */}
        <TabsContent value="theme-settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Tema Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>Görünüm Modu</Label>
                  <p className="text-xs text-muted-foreground">
                    Tercih ettiğiniz temayı seçin. Seçiminiz tarayıcınızda kaydedilir.
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setTheme('light')}
                    className={`
                      flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-lg border-2 transition-all
                      ${theme === 'light' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border hover:border-primary/50 text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Sun size={24} className={theme === 'light' ? 'text-yellow-500' : ''} />
                    <div className="text-left">
                      <div className="font-medium">Açık Tema</div>
                      <div className="text-xs text-muted-foreground">Light mode</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setTheme('dark')}
                    className={`
                      flex-1 flex items-center justify-center gap-3 px-4 py-4 rounded-lg border-2 transition-all
                      ${theme === 'dark' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border hover:border-primary/50 text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Moon size={24} className={theme === 'dark' ? 'text-blue-400' : ''} />
                    <div className="text-left">
                      <div className="font-medium">Koyu Tema</div>
                      <div className="text-xs text-muted-foreground">Dark mode</div>
                    </div>
                  </button>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg mt-6">
                  <p className="text-sm font-medium mb-3">Önizleme</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="text-sm font-medium text-foreground">Kart Örneği</div>
                        <div className="text-xs text-muted-foreground mt-1">Açıklama metni</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                        <div className="text-sm font-medium">Primary Buton</div>
                        <div className="text-xs opacity-80 mt-1">Accent rengi</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-4">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  Tema tercihiniz otomatik olarak kaydedildi
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog for Lookup Tables */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `${activeConfig?.name} Düzenle` : `Yeni ${activeConfig?.name} Ekle`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeConfig?.columns
              .filter(col => col.editable)
              .map(col => renderFormField(col))}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={loading}>
                İptal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Kaydediliyor...' : editingItem ? 'Güncelle' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Accrual Period Create Dialog */}
      <Dialog open={accrualDialogOpen} onOpenChange={setAccrualDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Tahakkuk Dönemi</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Yıl *</Label>
              <Select
                value={accrualFormData.year.toString()}
                onValueChange={(v) => setAccrualFormData(prev => ({ ...prev, year: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ay *</Label>
              <Select
                value={accrualFormData.month.toString()}
                onValueChange={(v) => setAccrualFormData(prev => ({ ...prev, month: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TURKISH_MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Otomatik hesaplanan değerler:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Dönem Adı:</span>
                  <span className="ml-2 font-medium">{previewPeriod.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kod:</span>
                  <span className="ml-2 font-mono">{previewPeriod.code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Başlangıç:</span>
                  <span className="ml-2">{previewPeriod.start_date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bitiş:</span>
                  <span className="ml-2">{previewPeriod.end_date}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccrualDialogOpen(false)} disabled={loading}>
                İptal
              </Button>
              <Button onClick={handleCreateAccrualPeriod} disabled={loading}>
                {loading ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
