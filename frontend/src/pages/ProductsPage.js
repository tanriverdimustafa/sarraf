import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService, lookupService } from '../services';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Package, Plus, Search, Eye, Image as ImageIcon, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductFormDialog from '../components/ProductFormDialog';
import LabelPrintModal from '../components/LabelPrintModal';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper: Convert image path to full URL
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith('http') || img.startsWith('data:')) {
    return img;
  }
  return `${BACKEND_URL}${img}`;
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [stockStatuses, setStockStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTypeId, setFilterTypeId] = useState(null);
  const [filterStatusId, setFilterStatusId] = useState(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Toplu seçim ve etiket basım
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  
  // Sayfalama state'leri
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    if (productTypes.length > 0) {
      fetchProducts();
    }
  }, [filterTypeId, filterStatusId, productTypes.length, page, perPage]);

  const fetchLookups = async () => {
    try {
      const [typesData, statusesData] = await Promise.all([
        lookupService.getProductTypes(),
        lookupService.getStockStatuses()
      ]);
      setProductTypes(typesData);
      setStockStatuses(statusesData);
    } catch (error) {
      console.error('Error fetching lookups:', error);
      toast.error('Lookup verileri yüklenemedi');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        per_page: perPage.toString()
      };
      if (filterTypeId) params.product_type_id = filterTypeId;
      if (filterStatusId) params.stock_status_id = filterStatusId;
      if (search) params.search = search;

      const data = await productService.getAll(params);
      
      // Yeni sayfalama formatı
      setProducts(data.products || []);
      setTotalPages(data.pagination?.total_pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1); // Arama yapınca ilk sayfaya dön
    fetchProducts();
  };
  
  const handlePerPageChange = (value) => {
    setPerPage(Number(value));
    setPage(1); // Sayfa başı değişince ilk sayfaya dön
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setShowFormDialog(true);
  };

  const handleFormSuccess = () => {
    setShowFormDialog(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const formatHas = (value) => {
    if (!value) return '0.00';
    return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const getProductTypeName = (typeId) => {
    const type = productTypes.find(t => t.id === typeId);
    return type ? type.name : '';
  };

  const getStockStatusName = (statusId) => {
    const status = stockStatuses.find(s => s.id === statusId);
    return status ? status.name : '';
  };

  const getStockStatusVariant = (statusId) => {
    if (statusId === 1) return 'default';  // IN_STOCK
    if (statusId === 2) return 'destructive';  // SOLD
    return 'secondary';  // RESERVED
  };
  
  // Toplu seçim fonksiyonları
  const handleSelectProduct = (product, checked) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, product]);
    } else {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    }
  };
  
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedProducts(products);
    } else {
      setSelectedProducts([]);
    }
  };
  
  const isProductSelected = (productId) => {
    return selectedProducts.some(p => p.id === productId);
  };

  return (
    <div className="space-y-6" data-testid="products-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-medium text-foreground">Ürünler</h1>
          <p className="text-muted-foreground mt-1">Ürün yönetimi - Tüm hesaplar HAS altın cinsinden</p>
        </div>
        <div className="flex gap-2">
          {selectedProducts.length > 0 && (
            <Button 
              variant="outline"
              onClick={() => setLabelModalOpen(true)}
            >
              <Tag className="w-4 h-4 mr-2" />
              Seçilenleri Bas ({selectedProducts.length})
            </Button>
          )}
          <Button 
            onClick={handleCreateProduct}
            className="gold-glow-hover"
            data-testid="create-product-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Ürün
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ürün adı veya barkod ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
                data-testid="search-input"
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground self-center">Tür:</span>
              <Button
                variant={filterTypeId === null ? 'default' : 'outline'}
                onClick={() => setFilterTypeId(null)}
                size="sm"
              >
                Tümü
              </Button>
              {productTypes.map(type => (
                <Button
                  key={type.id}
                  variant={filterTypeId === type.id ? 'default' : 'outline'}
                  onClick={() => setFilterTypeId(type.id)}
                  size="sm"
                >
                  {type.name}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground self-center">Durum:</span>
              <Button
                variant={filterStatusId === null ? 'default' : 'outline'}
                onClick={() => setFilterStatusId(null)}
                size="sm"
              >
                Tümü
              </Button>
              {stockStatuses.map(status => (
                <Button
                  key={status.id}
                  variant={filterStatusId === status.id ? 'default' : 'outline'}
                  onClick={() => setFilterStatusId(status.id)}
                  size="sm"
                >
                  {status.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="font-sans">Ürün Listesi</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sayfa başı:</span>
              <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedProducts.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedProducts.length} ürün seçili
            </span>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Henüz ürün bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="products-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center p-3 w-10">
                      <Checkbox
                        checked={selectedProducts.length === products.length && products.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="text-center p-3 text-sm font-semibold text-muted-foreground w-16">Foto</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Barkod</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Ürün Adı</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Tür</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Maliyet HAS</th>
                    <th className="text-right p-3 text-sm font-semibold text-muted-foreground">Satış HAS</th>
                    <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Durum</th>
                    <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className={`border-b border-border hover:bg-muted/50 transition-colors ${isProductSelected(product.id) ? 'bg-primary/5' : ''}`}>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={isProductSelected(product.id)}
                          onCheckedChange={(checked) => handleSelectProduct(product, checked)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        {product.images && product.images.length > 0 ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-border mx-auto">
                            <img
                              src={getImageUrl(product.images[0])}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-12 h-12 flex items-center justify-center"><svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg></div>';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-sm">{product.barcode}</td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{product.name}</div>
                        {product.notes && (
                          <div className="text-xs text-muted-foreground">{product.notes}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm">{getProductTypeName(product.product_type_id)}</td>
                      <td className="p-3 text-right font-mono text-primary">
                        {formatHas(product.total_cost_has)} gr
                      </td>
                      <td className="p-3 text-right font-mono text-chart-1 font-semibold">
                        {formatHas(product.sale_has_value)} gr
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={getStockStatusVariant(product.stock_status_id)}>
                          {getStockStatusName(product.stock_status_id)}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/products/${product.id}`)}
                          data-testid={`view-product-${product.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Sayfalama Kontrolleri */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Toplam {total} kayıt, Sayfa {page}/{totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Önceki
                  </Button>
                  <span className="text-sm px-2">{page} / {totalPages}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={showFormDialog}
        onClose={() => {
          setShowFormDialog(false);
          setEditingProduct(null);
        }}
        onSuccess={handleFormSuccess}
        product={editingProduct}
      />
      
      {/* Label Print Modal */}
      <LabelPrintModal
        open={labelModalOpen}
        onClose={() => {
          setLabelModalOpen(false);
          setSelectedProducts([]);
        }}
        products={selectedProducts}
      />
    </div>
  );
};

export default ProductsPage;