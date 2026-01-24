import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  History, 
  Plus, 
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cashService } from '../services';

const CashMovementsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total_pages: 1, total_records: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [perPage, setPerPage] = useState(20);
  
  // Filters
  const [selectedRegister, setSelectedRegister] = useState(searchParams.get('register') || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedRefType, setSelectedRefType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // New movement form - with transaction_date default today
  const [formData, setFormData] = useState({
    cash_register_id: '',
    type: 'IN',
    amount: '',
    description: '',
    reference_type: 'MANUAL',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const fetchRegisters = async () => {
    try {
      const data = await cashService.getRegisters();
      setRegisters(data);
    } catch (error) {
      console.error('Error fetching registers:', error);
    }
  };

  const fetchMovements = async (page = 1) => {
    try {
      setLoading(true);
      
      const params = {
        page,
        per_page: perPage
      };
      
      if (selectedRegister) params.cash_register_id = selectedRegister;
      if (selectedType) params.type = selectedType;
      if (selectedRefType) params.reference_type = selectedRefType;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const data = await cashService.getMovements(params);
      setMovements(data.movements);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast.error('Hareketler alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisters();
  }, []);

  useEffect(() => {
    fetchMovements(1);
  }, [selectedRegister, selectedType, selectedRefType, startDate, endDate, perPage]);

  const handleSubmit = async () => {
    try {
      if (!formData.cash_register_id || !formData.amount) {
        toast.error('Kasa ve tutar zorunludur');
        return;
      }
      
      await cashService.createMovement({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      
      toast.success('Hareket kaydedildi');
      setDialogOpen(false);
      setFormData({ 
        cash_register_id: '', 
        type: 'IN', 
        amount: '', 
        description: '', 
        reference_type: 'MANUAL',
        transaction_date: new Date().toISOString().split('T')[0]
      });
      fetchMovements(1);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const formatCurrency = (amount, currency) => {
    const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€';
    return `${parseFloat(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('tr-TR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRefTypeLabel = (refType) => {
    const labels = {
      'OPENING': 'Açılış',
      'SALE': 'Satış',
      'RECEIPT': 'Tahsilat',
      'PURCHASE': 'Alış',
      'PAYMENT': 'Ödeme',
      'TRANSFER': 'Transfer',
      'EXPENSE': 'Gider',
      'MANUAL': 'Manuel'
    };
    return labels[refType] || refType;
  };

  const clearFilters = () => {
    setSelectedRegister('');
    setSelectedType('');
    setSelectedRefType('');
    setStartDate('');
    setEndDate('');
    setSearchParams({});
  };

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
            <h1 className="text-3xl font-serif font-bold text-foreground">Kasa Hareketleri</h1>
            <p className="text-muted-foreground mt-1">Tüm kasa giriş ve çıkışları</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Manuel Hareket
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label className="text-xs">Kasa</Label>
              <Select value={selectedRegister || "all"} onValueChange={(v) => setSelectedRegister(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {registers.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-32">
              <Label className="text-xs">Yön</Label>
              <Select value={selectedType || "all"} onValueChange={(v) => setSelectedType(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="IN">Giriş</SelectItem>
                  <SelectItem value="OUT">Çıkış</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-36">
              <Label className="text-xs">Hareket Tipi</Label>
              <Select value={selectedRefType || "all"} onValueChange={(v) => setSelectedRefType(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="OPENING">Açılış</SelectItem>
                  <SelectItem value="SALE">Satış</SelectItem>
                  <SelectItem value="RECEIPT">Tahsilat</SelectItem>
                  <SelectItem value="PURCHASE">Alış</SelectItem>
                  <SelectItem value="PAYMENT">Ödeme</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="EXPENSE">Gider</SelectItem>
                  <SelectItem value="MANUAL">Manuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-36">
              <Label className="text-xs">Başlangıç</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="w-36">
              <Label className="text-xs">Bitiş</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Temizle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Hareketler ({pagination.total_records})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hareket bulunamadı
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Tarih</th>
                      <th className="text-left py-3 px-4 font-medium">Kasa</th>
                      <th className="text-center py-3 px-4 font-medium">Yön</th>
                      <th className="text-left py-3 px-4 font-medium">Tip</th>
                      <th className="text-right py-3 px-4 font-medium">Tutar</th>
                      <th className="text-right py-3 px-4 font-medium">Bakiye</th>
                      <th className="text-left py-3 px-4 font-medium">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 text-sm">
                          {formatDate(movement.transaction_date || movement.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium">{movement.cash_register?.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({movement.cash_register?.code})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {movement.type === 'IN' ? (
                            <Badge className="bg-green-100 text-green-700">
                              <ArrowDownLeft className="w-3 h-3 mr-1" />
                              Giriş
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                              Çıkış
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {getRefTypeLabel(movement.reference_type)}
                          </Badge>
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-semibold ${
                          movement.type === 'IN' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.type === 'IN' ? '+' : '-'}
                          {formatCurrency(movement.amount, movement.currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(movement.balance_after, movement.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                          {movement.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination - Her zaman göster */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Sayfa başı:</span>
                  <Select 
                    value={perPage.toString()} 
                    onValueChange={(value) => setPerPage(parseInt(value))}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    Toplam {pagination.total_records} kayıt • Sayfa {pagination.page} / {pagination.total_pages}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchMovements(pagination.page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Önceki
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={pagination.page >= pagination.total_pages}
                    onClick={() => fetchMovements(pagination.page + 1)}
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* New Movement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manuel Kasa Hareketi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>İşlem Tarihi *</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Kasa *</Label>
              <Select
                value={formData.cash_register_id}
                onValueChange={(value) => setFormData({ ...formData, cash_register_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kasa seçin" />
                </SelectTrigger>
                <SelectContent>
                  {registers.filter(r => r.is_active).map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      {register.name} ({register.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Hareket Yönü *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      Giriş
                    </span>
                  </SelectItem>
                  <SelectItem value="OUT">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                      Çıkış
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tutar *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Hareket Tipi</Label>
              <Select
                value={formData.reference_type}
                onValueChange={(value) => setFormData({ ...formData, reference_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manuel</SelectItem>
                  <SelectItem value="EXPENSE">Gider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Açıklama</Label>
              <Input
                placeholder="Hareket açıklaması"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
  );
};

export default CashMovementsPage;
