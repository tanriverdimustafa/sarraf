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
  Wallet, 
  Building2, 
  Plus, 
  ArrowLeftRight, 
  History,
  DollarSign,
  Euro,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const CashDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [registers, setRegisters] = useState([]);
  
  // Dialogs
  const [openingDialog, setOpeningDialog] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);
  
  // Opening balance form
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [openingBalances, setOpeningBalances] = useState({});
  
  // Transfer form
  const [transferData, setTransferData] = useState({
    from_cash_register_id: '',
    to_cash_register_id: '',
    amount: '',
    description: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/cash-registers/summary');
      const data = response.data;
      
      setSummary(data.summary);
      setRegisters(data.registers);
      
      // Initialize opening balances
      const balances = {};
      data.registers.forEach(r => {
        balances[r.id] = '';
      });
      setOpeningBalances(balances);
    } catch (error) {
      console.error('Error fetching cash data:', error);
      toast.error('Kasa verileri alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount, currency) => {
    const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€';
    return `${parseFloat(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  };

  const handleOpeningSubmit = async () => {
    try {
      const balances = Object.entries(openingBalances)
        .filter(([_, amount]) => amount && parseFloat(amount) > 0)
        .map(([cash_register_id, amount]) => ({
          cash_register_id,
          amount: parseFloat(amount)
        }));
      
      if (balances.length === 0) {
        toast.error('En az bir kasa için bakiye giriniz');
        return;
      }
      
      const response = await api.post('/api/cash-movements/opening', {
        date: openingDate,
        balances
      });
      
      const data = response.data;
      toast.success(`${data.success_count} kasa için açılış bakiyesi girildi`);
      if (data.error_count > 0) {
        toast.warning(`${data.error_count} kasa için hata oluştu`);
      }
      setOpeningDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Açılış bakiyesi kaydedilemedi');
    }
  };

  const handleTransferSubmit = async () => {
    try {
      if (!transferData.from_cash_register_id || !transferData.to_cash_register_id || !transferData.amount) {
        toast.error('Tüm alanları doldurunuz');
        return;
      }
      
      const response = await api.post('/api/cash-movements/transfer', {
        ...transferData,
        amount: parseFloat(transferData.amount)
      });
      
      const data = response.data;
      toast.success(`Transfer başarılı: ${formatCurrency(data.amount, data.currency)}`);
      setTransferDialog(false);
      setTransferData({ from_cash_register_id: '', to_cash_register_id: '', amount: '', description: '' });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Transfer başarısız');
    }
  };

  // Filter same currency registers for transfer
  const getTransferTargets = () => {
    if (!transferData.from_cash_register_id) return [];
    const sourceRegister = registers.find(r => r.id === transferData.from_cash_register_id);
    if (!sourceRegister) return [];
    return registers.filter(r => r.id !== sourceRegister.id && r.currency === sourceRegister.currency);
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
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Kasa Durumu</h1>
          <p className="text-muted-foreground mt-1">Nakit ve banka hesaplarınızın özeti</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpeningDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Açılış Bakiyesi
          </Button>
          <Button variant="outline" onClick={() => setTransferDialog(true)}>
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Transfer
          </Button>
          <Button asChild>
            <Link to="/cash/registers">
              <Building2 className="w-4 h-4 mr-2" />
              Kasa Tanımları
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TL Summary */}
        <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <span className="text-amber-600">₺</span>
              TL Toplam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {formatCurrency(summary?.TRY?.total, 'TRY')}
            </div>
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Nakit:</span>
                <span>{formatCurrency(summary?.TRY?.cash, 'TRY')}</span>
              </div>
              <div className="flex justify-between">
                <span>Banka:</span>
                <span>{formatCurrency(summary?.TRY?.bank, 'TRY')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* USD Summary */}
        <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              USD Toplam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(summary?.USD?.total, 'USD')}
            </div>
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Nakit:</span>
                <span>{formatCurrency(summary?.USD?.cash, 'USD')}</span>
              </div>
              <div className="flex justify-between">
                <span>Banka:</span>
                <span>{formatCurrency(summary?.USD?.bank, 'USD')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EUR Summary */}
        <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Euro className="w-5 h-5 text-blue-600" />
              EUR Toplam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(summary?.EUR?.total, 'EUR')}
            </div>
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Nakit:</span>
                <span>{formatCurrency(summary?.EUR?.cash, 'EUR')}</span>
              </div>
              <div className="flex justify-between">
                <span>Banka:</span>
                <span>{formatCurrency(summary?.EUR?.bank, 'EUR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Kasalar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
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
                    <td className="py-3 px-4 font-medium">{register.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{register.code}</td>
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
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/cash/movements?register=${register.id}`}>
                          <History className="w-4 h-4 mr-1" />
                          Hareketler
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Opening Balance Dialog */}
      <Dialog open={openingDialog} onOpenChange={setOpeningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Açılış Bakiyesi Girişi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tarih</Label>
              <Input 
                type="date" 
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-3">
              {registers.map((register) => (
                <div key={register.id} className="flex items-center gap-3">
                  <Label className="w-24 text-sm">{register.name}:</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={openingBalances[register.id] || ''}
                    onChange={(e) => setOpeningBalances({
                      ...openingBalances,
                      [register.id]: e.target.value
                    })}
                    className="flex-1"
                  />
                  <span className="w-6 text-muted-foreground">
                    {register.currency === 'TRY' ? '₺' : register.currency === 'USD' ? '$' : '€'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpeningDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleOpeningSubmit}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kasalar Arası Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Çıkış Kasası</Label>
              <Select
                value={transferData.from_cash_register_id}
                onValueChange={(value) => setTransferData({
                  ...transferData,
                  from_cash_register_id: value,
                  to_cash_register_id: '' // Reset target when source changes
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kasa seçin" />
                </SelectTrigger>
                <SelectContent>
                  {registers.filter(r => r.is_active).map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      {register.name} ({formatCurrency(register.current_balance, register.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Giriş Kasası</Label>
              <Select
                value={transferData.to_cash_register_id}
                onValueChange={(value) => setTransferData({
                  ...transferData,
                  to_cash_register_id: value
                })}
                disabled={!transferData.from_cash_register_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kasa seçin" />
                </SelectTrigger>
                <SelectContent>
                  {getTransferTargets().filter(r => r.is_active).map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      {register.name} ({formatCurrency(register.current_balance, register.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tutar</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={transferData.amount}
                onChange={(e) => setTransferData({
                  ...transferData,
                  amount: e.target.value
                })}
              />
            </div>
            
            <div>
              <Label>Açıklama (opsiyonel)</Label>
              <Input
                placeholder="Transfer açıklaması"
                value={transferData.description}
                onChange={(e) => setTransferData({
                  ...transferData,
                  description: e.target.value
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleTransferSubmit}>
              Transfer Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashDashboardPage;
