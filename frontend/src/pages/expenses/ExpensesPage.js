import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Receipt, Filter, Calendar, Banknote, TrendingDown, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { expenseService } from '../../services';

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Sayfalama state'leri
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Summary
  const [summary, setSummary] = useState({ grand_total: 0, by_category: [] });

  useEffect(() => {
    loadCategories();
  }, []);

  // Sayfa veya perPage değiştiğinde yeniden yükle
  useEffect(() => {
    loadExpenses();
  }, [page, perPage]);

  useEffect(() => {
    loadSummary();
  }, [startDate, endDate]);

  const loadCategories = async () => {
    try {
      const data = await expenseService.getCategories();
      // Filter only active categories
      setCategories(data.filter(c => c.is_active !== false));
    } catch (error) {
      console.error('Categories load error:', error);
    }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (categoryFilter && categoryFilter !== 'all') params.category_id = categoryFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const data = await expenseService.getAll(params);
      setExpenses(data.expenses || []);
      
      // Pagination bilgilerini güncelle
      if (data.pagination) {
        setTotalCount(data.pagination.total_records || 0);
        setTotalPages(data.pagination.total_pages || 1);
      }
    } catch (error) {
      toast.error('Giderler yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await expenseService.getSummary(startDate, endDate);
      setSummary(data);
    } catch (error) {
      console.error('Summary load error:', error);
    }
  };

  const handleFilter = () => {
    setPage(1); // Filtre değişince sayfa 1'e dön
    loadExpenses();
    loadSummary();
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(parseInt(newPerPage));
    setPage(1); // Sayfa başına kayıt değişince sayfa 1'e dön
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const formatTL = (value) => {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-8 h-8 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold">Giderler</h1>
              <p className="text-muted-foreground">İşletme giderlerini görüntüleyin ve yönetin</p>
            </div>
          </div>
          <Link to="/expenses/new">
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Yeni Gider
            </Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400">Toplam Gider</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatTL(summary.grand_total)} ₺</p>
                </div>
                <TrendingDown className="w-10 h-10 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          
          {summary.by_category?.slice(0, 3).map((cat, idx) => (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{cat.category_name}</p>
                    <p className="text-xl font-bold">{formatTL(cat.total_amount)} ₺</p>
                    <p className="text-xs text-muted-foreground">{cat.count} işlem</p>
                  </div>
                  <Banknote className="w-8 h-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <CardTitle>Filtreler</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tüm kategoriler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              
              <div className="flex items-end">
                <Button onClick={handleFilter} className="w-full">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrele
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Gider Listesi</CardTitle>
              <div className="flex items-center gap-4">
                {/* Sayfa başına kayıt seçimi */}
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
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Banknote className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Henüz gider kaydı bulunmuyor</p>
                <Link to="/expenses/new" className="text-primary hover:underline mt-2 inline-block">
                  İlk gideri ekleyin
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Tarih</th>
                        <th className="text-left py-3 px-4 font-medium">Kategori</th>
                        <th className="text-left py-3 px-4 font-medium">Açıklama</th>
                        <th className="text-left py-3 px-4 font-medium">Kime Ödendi</th>
                        <th className="text-right py-3 px-4 font-medium">Tutar</th>
                        <th className="text-left py-3 px-4 font-medium">Kasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{formatDate(expense.expense_date)}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {expense.category_name}
                            </span>
                          </td>
                          <td className="py-3 px-4">{expense.description}</td>
                          <td className="py-3 px-4 text-muted-foreground">{expense.payee || '-'}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-red-600">
                            {expense.foreign_amount ? (
                              <span>{expense.foreign_amount.toFixed(2)} {expense.payment_currency}</span>
                            ) : (
                              <span>{formatTL(expense.amount)} ₺</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{expense.cash_register_id}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30">
                        <td colSpan={4} className="py-3 px-4 font-semibold">TOPLAM</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-600 text-lg">
                          {formatTL(expenses.reduce((sum, e) => sum + (e.amount || 0), 0))} ₺
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Sayfalama Kontrolleri */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Toplam {totalCount} kayıt • Sayfa {page} / {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handlePreviousPage}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Önceki
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleNextPage}
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
      </div>
    </Layout>
  );
};

export default ExpensesPage;
