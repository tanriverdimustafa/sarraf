import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productService, lookupService, partyService } from '../services';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { ArrowLeft, Edit, Save, Trash2, Lock, Zap, Image as ImageIcon, X, ChevronLeft, ChevronRight, Camera, Upload, Tag } from 'lucide-react';
import { toast } from 'sonner';
import LabelPrintModal from '../components/LabelPrintModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper: Convert image path to full URL
const getImageUrl = (img) => {
  if (!img) return null;
  // If already a full URL or base64, return as-is
  if (img.startsWith('http') || img.startsWith('data:')) {
    return img;
  }
  // If relative path, prepend backend URL
  return `${BACKEND_URL}${img}`;
};

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Product data
  const [product, setProduct] = useState(null);
  const [originalProduct, setOriginalProduct] = useState(null);
  
  // Lookups
  const [productTypes, setProductTypes] = useState([]);
  const [karats, setKarats] = useState([]);
  const [laborTypes, setLaborTypes] = useState([]);
  const [stockStatuses, setStockStatuses] = useState([]);
  const [supplierName, setSupplierName] = useState(null);
  
  // Form state (used in edit mode)
  const [formData, setFormData] = useState({
    name: '',
    notes: '',
    karat_id: null,
    weight_gram: '',
    labor_has_value: '',
    alis_has_degeri: '',
    profit_rate_percent: '',
    stock_status_id: null,
  });
  
  // UI states
  const [hasLabor, setHasLabor] = useState(false);
  const [selectedLaborTypeId, setSelectedLaborTypeId] = useState(null);
  
  // Calculated values
  const [fineness, setFineness] = useState(null);
  const [materialHas, setMaterialHas] = useState(0);
  const [laborHas, setLaborHas] = useState(0);
  const [totalCostHas, setTotalCostHas] = useState(0);
  const [saleHasValue, setSaleHasValue] = useState(0);
  
  // Image lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  // Label print modal
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  useEffect(() => {
    fetchProduct();
    fetchLookups();
  }, [id]);

  useEffect(() => {
    if (product && editMode) {
      calculateCosts();
    }
  }, [
    formData.karat_id,
    formData.weight_gram,
    selectedLaborTypeId,
    formData.labor_has_value,
    formData.alis_has_degeri,
    formData.profit_rate_percent,
    fineness,
    hasLabor,
    product,
    editMode
  ]);

  // Image upload functions
  const resizeImage = (file, maxWidth = 1024) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (product.images && product.images.length >= 5) {
      toast.error('Maksimum 5 fotoğraf yükleyebilirsiniz');
      return;
    }
    
    const file = files[0];
    
    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Sadece JPG, PNG, WEBP formatları kabul edilir');
      return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu 5MB\'dan büyük olamaz');
      return;
    }
    
    try {
      setUploadingImage(true);
      const resizedImage = await resizeImage(file);
      
      // Upload to server using api instance
      await api.post(`/api/products/${id}/images`, { image: resizedImage });
      
      // Update local state
      setProduct(prev => ({
        ...prev,
        images: [...(prev.images || []), resizedImage]
      }));
      
      toast.success('Fotoğraf yüklendi');
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(error.response?.data?.detail || 'Fotoğraf yüklenemedi');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = async (index) => {
    try {
      await api.delete(`/api/products/${id}/images/${index}`);
      
      // Update local state
      setProduct(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
      
      toast.success('Fotoğraf silindi');
    } catch (error) {
      console.error('Image delete error:', error);
      toast.error(error.response?.data?.detail || 'Fotoğraf silinemedi');
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const data = await productService.getById(id);
      setProduct(data);
      setOriginalProduct(data);
      
      // Tedarikçi bilgisi varsa adını al
      if (data.supplier_party_id) {
        try {
          const supplierData = await partyService.getById(data.supplier_party_id);
          setSupplierName(supplierData.name);
        } catch (err) {
          console.error('Error fetching supplier:', err);
        }
      }
      
      // Initialize form data
      setFormData({
        name: data.name || '',
        notes: data.notes || '',
        karat_id: data.karat_id,
        weight_gram: data.weight_gram || '',
        labor_has_value: data.labor_has_value || '',
        alis_has_degeri: data.alis_has_degeri || '',
        profit_rate_percent: data.profit_rate_percent || '',
        stock_status_id: data.stock_status_id,
      });
      
      setHasLabor(data.labor_type_id !== null);
      setSelectedLaborTypeId(data.labor_type_id);
      setFineness(data.fineness);
      
      // Set calculated values from product
      setMaterialHas(data.material_has_cost);
      setLaborHas(data.labor_has_cost);
      setTotalCostHas(data.total_cost_has);
      setSaleHasValue(data.sale_has_value);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Ürün yüklenemedi');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [typesData, karatsData, laborData, statusesData] = await Promise.all([
        lookupService.getProductTypes(),
        lookupService.getKarats(),
        lookupService.getLaborTypes(),
        lookupService.getStockStatuses()
      ]);
      setProductTypes(typesData);
      setKarats(karatsData);
      setLaborTypes(laborData);
      setStockStatuses(statusesData);
    } catch (error) {
      console.error('Error fetching lookups:', error);
      toast.error('Lookup verileri yüklenemedi');
    }
  };

  const calculateCosts = () => {
    if (!product) return;
    
    let material = 0;
    let labor = 0;

    if (product.is_gold_based) {
      // Altın ürün
      const weight = parseFloat(formData.weight_gram) || 0;
      const fine = fineness || 0;
      material = weight * fine;
    } else {
      // Altın olmayan
      material = parseFloat(formData.alis_has_degeri) || 0;
    }

    // İşçilik hesabı
    if (hasLabor && selectedLaborTypeId) {
      const laborValue = parseFloat(formData.labor_has_value) || 0;
      
      if (selectedLaborTypeId === 1) {
        // PER_GRAM
        const weight = parseFloat(formData.weight_gram) || 0;
        labor = weight * laborValue;
      } else if (selectedLaborTypeId === 2) {
        // PER_PIECE
        labor = laborValue;
      }
    }

    const totalCost = material + labor;
    const profitRate = parseFloat(formData.profit_rate_percent) || 0;
    const saleValue = totalCost * (1 + profitRate / 100);

    setMaterialHas(material);
    setLaborHas(labor);
    setTotalCostHas(totalCost);
    setSaleHasValue(saleValue);
  };

  const handleKaratChange = (value) => {
    const karatId = parseInt(value);
    setFormData({ ...formData, karat_id: karatId });
    
    const selectedKarat = karats.find(k => k.id === karatId);
    if (selectedKarat) {
      setFineness(selectedKarat.fineness);
    }
  };

  const handleLaborTypeChange = (value) => {
    const laborTypeId = parseInt(value);
    setSelectedLaborTypeId(laborTypeId);
  };

  const getFilteredLaborTypes = () => {
    if (!product || !product.is_gold_based) {
      // Altın olmayan: sadece PER_PIECE
      return laborTypes.filter(lt => lt.code === 'PER_PIECE');
    }
    return laborTypes;
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    // Reset to original
    setFormData({
      name: originalProduct.name || '',
      notes: originalProduct.notes || '',
      karat_id: originalProduct.karat_id,
      weight_gram: originalProduct.weight_gram || '',
      labor_has_value: originalProduct.labor_has_value || '',
      alis_has_degeri: originalProduct.alis_has_degeri || '',
      profit_rate_percent: originalProduct.profit_rate_percent || '',
      stock_status_id: originalProduct.stock_status_id,
    });
    setHasLabor(originalProduct.labor_type_id !== null);
    setSelectedLaborTypeId(originalProduct.labor_type_id);
    setFineness(originalProduct.fineness);
    setMaterialHas(originalProduct.material_has_cost);
    setLaborHas(originalProduct.labor_has_cost);
    setTotalCostHas(originalProduct.total_cost_has);
    setSaleHasValue(originalProduct.sale_has_value);
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Ürün adı zorunludur');
      return;
    }

    if (product.is_gold_based) {
      if (!formData.karat_id) {
        toast.error('Ayar seçilmelidir');
        return;
      }
      if (!formData.weight_gram) {
        toast.error('Gram ağırlık girilmelidir');
        return;
      }
    } else {
      if (!formData.alis_has_degeri) {
        toast.error('Alış HAS değeri girilmelidir');
        return;
      }
    }

    if (hasLabor && !formData.labor_has_value) {
      toast.error('İşçilik değeri girilmelidir');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: formData.name,
        notes: formData.notes || null,
        profit_rate_percent: parseFloat(formData.profit_rate_percent),
      };

      // Only include editable fields based on stock status
      const isSold = product.stock_status_id === 2;

      if (!isSold) {
        // IN_STOCK or RESERVED - can update cost-related fields
        if (product.is_gold_based) {
          payload.karat_id = formData.karat_id;
          payload.weight_gram = parseFloat(formData.weight_gram);
        } else {
          payload.alis_has_degeri = parseFloat(formData.alis_has_degeri);
        }

        if (hasLabor && selectedLaborTypeId) {
          payload.labor_type_id = selectedLaborTypeId;
          payload.labor_has_value = parseFloat(formData.labor_has_value);
        } else {
          payload.labor_type_id = null;
          payload.labor_has_value = null;
        }

        payload.stock_status_id = formData.stock_status_id;
      }

      await productService.update(id, payload);

      toast.success('Ürün güncellendi');
      setEditMode(false);
      fetchProduct(); // Refresh
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(error.response?.data?.detail || 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await productService.delete(id);
      toast.success('Ürün silindi');
      navigate('/products');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error.response?.data?.detail || 'Silme başarısız');
    }
  };

  const formatHas = (value) => {
    if (!value && value !== 0) return '0.00';
    return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const getProductTypeName = (typeId) => {
    const type = productTypes.find(t => t.id === typeId);
    return type ? type.name : '';
  };

  const getKaratDisplay = (karatId) => {
    const karat = karats.find(k => k.id === karatId);
    return karat ? `${karat.karat} Ayar` : '';
  };

  const getLaborTypeName = (laborTypeId) => {
    const laborType = laborTypes.find(lt => lt.id === laborTypeId);
    return laborType ? laborType.name : '';
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

  // Check if field is editable
  const isFieldEditable = (fieldName) => {
    if (!product) return false;
    
    const isSold = product.stock_status_id === 2;
    
    // Fields always readonly
    if (['product_type_id', 'barcode', 'material_has_cost', 'labor_has_cost', 'total_cost_has', 'sale_has_value'].includes(fieldName)) {
      return false;
    }
    
    // SOLD: only notes and images editable
    if (isSold) {
      return ['name', 'notes', 'images'].includes(fieldName);
    }
    
    // IN_STOCK or RESERVED
    return !['product_type_id', 'barcode'].includes(fieldName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const isSold = product.stock_status_id === 2;
  
  // Lightbox navigation
  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  
  const closeLightbox = () => {
    setLightboxOpen(false);
  };
  
  const prevImage = () => {
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : product.images.length - 1));
  };
  
  const nextImage = () => {
    setLightboxIndex((prev) => (prev < product.images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/products')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <div>
            <h1 className="text-4xl font-serif font-medium text-foreground">{product.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted-foreground font-mono">{product.barcode}</p>
              <Badge variant={getStockStatusVariant(product.stock_status_id)}>
                {getStockStatusName(product.stock_status_id)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <Button variant="outline" onClick={() => setLabelModalOpen(true)}>
                <Tag className="w-4 h-4 mr-2" />
                Etiket Bas
              </Button>
              <Button onClick={handleEdit} className="gold-glow-hover">
                <Edit className="w-4 h-4 mr-2" />
                Düzenle
              </Button>
              {!isSold && (
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                İptal
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gold-glow-hover">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fotoğraf Galerisi */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-sans flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Ürün Fotoğrafları ({product.images?.length || 0}/5)
              </CardTitle>
              {/* Fotoğraf ekleme butonları - her zaman göster */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={(product.images?.length || 0) >= 5 || uploadingImage}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Fotoğraf Çek
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={(product.images?.length || 0) >= 5 || uploadingImage}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Dosya Seç
                </Button>
                {uploadingImage && (
                  <span className="text-sm text-muted-foreground animate-pulse self-center">Yükleniyor...</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {product.images && product.images.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {product.images.map((img, index) => (
                  <div 
                    key={index}
                    className="relative group w-32 h-32 rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  >
                    <img
                      src={getImageUrl(img)}
                      alt={`${product.name} - ${index + 1}`}
                      className="w-full h-full object-cover"
                      onClick={() => openLightbox(index)}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';
                      }}
                    />
                    {/* Silme butonu */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                      className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-2 opacity-30" />
                <p>Henüz fotoğraf eklenmemiş</p>
                <p className="text-sm">Yukarıdaki butonları kullanarak fotoğraf ekleyebilirsiniz</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temel Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans">Temel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ürün Tipi (Always Readonly) */}
            <div>
              <Label className="flex items-center gap-2">
                <Lock className="w-3 h-3 text-muted-foreground" />
                Ürün Tipi
              </Label>
              <Input
                value={getProductTypeName(product.product_type_id)}
                disabled
                className="bg-muted border-dashed cursor-not-allowed"
              />
            </div>

            {/* Barkod (Always Readonly) */}
            <div>
              <Label className="flex items-center gap-2">
                <Lock className="w-3 h-3 text-muted-foreground" />
                Barkod
              </Label>
              <Input
                value={product.barcode}
                disabled
                className="bg-muted border-dashed cursor-not-allowed font-mono"
              />
            </div>

            {/* Ürün Adı */}
            <div>
              <Label>
                Ürün Adı <span className="text-red-500">*</span>
              </Label>
              {editMode && isFieldEditable('name') ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              ) : (
                <Input value={product.name} disabled className="bg-muted" />
              )}
            </div>

            {/* Notlar */}
            <div>
              <Label>Notlar</Label>
              {editMode && isFieldEditable('notes') ? (
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              ) : (
                <Textarea value={product.notes || ''} disabled className="bg-muted" rows={3} />
              )}
            </div>

            {/* Tedarikçi Bilgisi (Readonly) */}
            {(product.supplier_party_id || product.purchase_date) && (
              <div className="pt-4 border-t">
                <Label className="text-primary font-semibold mb-3 block">Tedarikçi Bilgisi</Label>
                <div className="grid grid-cols-2 gap-4">
                  {supplierName && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Tedarikçi</Label>
                      <p className="font-medium">{supplierName}</p>
                    </div>
                  )}
                  {product.purchase_date && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Alış Tarihi</Label>
                      <p className="font-medium">
                        {new Date(product.purchase_date).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Altın Bilgisi (if gold-based) */}
        {product.is_gold_based && (
          <Card>
            <CardHeader>
              <CardTitle className="font-sans">Altın Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ayar */}
              <div>
                <Label>
                  Ayar <span className="text-red-500">*</span>
                </Label>
                {editMode && isFieldEditable('karat_id') ? (
                  <Select value={formData.karat_id?.toString()} onValueChange={handleKaratChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {karats.map(k => (
                        <SelectItem key={k.id} value={k.id.toString()}>
                          {k.karat} Ayar ({k.fineness})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={getKaratDisplay(product.karat_id)} disabled className="bg-muted" />
                )}
              </div>

              {/* Milyem (Always readonly, auto-calculated) */}
              <div>
                <Label className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-green-600" />
                  Milyem
                </Label>
                <Input
                  value={editMode ? (fineness || '').toString() : (product.fineness || '').toString()}
                  disabled
                  className="bg-accent/10 border-green-500 cursor-default"
                />
              </div>

              {/* Gram Ağırlık */}
              <div>
                <Label>
                  Gram Ağırlık <span className="text-red-500">*</span>
                </Label>
                {editMode && isFieldEditable('weight_gram') ? (
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.weight_gram}
                    onChange={(e) => setFormData({ ...formData, weight_gram: e.target.value })}
                  />
                ) : (
                  <Input value={product.weight_gram || ''} disabled className="bg-muted" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alış HAS (if non-gold) */}
        {!product.is_gold_based && (
          <Card>
            <CardHeader>
              <CardTitle className="font-sans">Alış Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>
                  Alış HAS Değeri <span className="text-red-500">*</span>
                </Label>
                {editMode && isFieldEditable('alis_has_degeri') ? (
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.alis_has_degeri}
                    onChange={(e) => setFormData({ ...formData, alis_has_degeri: e.target.value })}
                  />
                ) : (
                  <Input value={formatHas(product.alis_has_degeri)} disabled className="bg-muted font-mono" />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* İşçilik */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans">İşçilik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* İşçilik Var mı */}
            {editMode && !isSold ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasLabor}
                  onCheckedChange={setHasLabor}
                />
                <Label>İşçilik Var</Label>
              </div>
            ) : (
              <div>
                <Label>İşçilik Durumu</Label>
                <Input value={product.labor_type_id ? 'Var' : 'Yok'} disabled className="bg-muted" />
              </div>
            )}

            {/* İşçilik Tipi */}
            {(hasLabor || product.labor_type_id) && (
              <>
                <div>
                  <Label>İşçilik Tipi</Label>
                  {editMode && isFieldEditable('labor_type_id') ? (
                    <Select
                      value={selectedLaborTypeId?.toString()}
                      onValueChange={handleLaborTypeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredLaborTypes().map(lt => (
                          <SelectItem key={lt.id} value={lt.id.toString()}>
                            {lt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={getLaborTypeName(product.labor_type_id)} disabled className="bg-muted" />
                  )}
                </div>

                {/* İşçilik Değeri */}
                <div>
                  <Label>
                    İşçilik Değeri <span className="text-red-500">*</span>
                  </Label>
                  {editMode && isFieldEditable('labor_has_value') ? (
                    <Input
                      type="number"
                      step="0.000001"
                      value={formData.labor_has_value}
                      onChange={(e) => setFormData({ ...formData, labor_has_value: e.target.value })}
                    />
                  ) : (
                    <Input value={formatHas(product.labor_has_value)} disabled className="bg-muted font-mono" />
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Maliyet (Auto-calculated) */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              Maliyet Hesaplaması
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Materyal HAS */}
            <div>
              <Label className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-green-600" />
                Materyal HAS
              </Label>
              <Input
                value={formatHas(editMode ? materialHas : product.material_has_cost)}
                disabled
                className="bg-accent/10 border-green-500 cursor-default font-mono"
              />
            </div>

            {/* İşçilik HAS */}
            <div>
              <Label className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-green-600" />
                İşçilik HAS
              </Label>
              <Input
                value={formatHas(editMode ? laborHas : product.labor_has_cost)}
                disabled
                className="bg-accent/10 border-green-500 cursor-default font-mono"
              />
            </div>

            {/* Toplam Maliyet */}
            <div>
              <Label className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-green-600" />
                Toplam Maliyet HAS
              </Label>
              <Input
                value={formatHas(editMode ? totalCostHas : product.total_cost_has)}
                disabled
                className="bg-accent/10 border-green-500 cursor-default font-mono font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Satış */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans">Satış</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Kar Marjı */}
            <div>
              <Label>
                Kar Marjı % <span className="text-red-500">*</span>
              </Label>
              {editMode && isFieldEditable('profit_rate_percent') ? (
                <Input
                  type="number"
                  step="0.01"
                  value={formData.profit_rate_percent}
                  onChange={(e) => setFormData({ ...formData, profit_rate_percent: e.target.value })}
                />
              ) : (
                <Input value={product.profit_rate_percent} disabled className="bg-muted" />
              )}
            </div>

            {/* Satış HAS (Auto-calculated) */}
            <div>
              <Label className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-green-600" />
                Satış HAS Değeri
              </Label>
              <Input
                value={formatHas(editMode ? saleHasValue : product.sale_has_value)}
                disabled
                className="bg-accent/10 border-green-500 cursor-default font-mono font-bold text-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stok Durumu */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sans">Stok Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Stok Durumu</Label>
              {editMode && isFieldEditable('stock_status_id') ? (
                <Select
                  value={formData.stock_status_id?.toString()}
                  onValueChange={(value) => setFormData({ ...formData, stock_status_id: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stockStatuses
                      .filter(s => {
                        // Cannot go back from SOLD
                        if (product.stock_status_id === 2) {
                          return s.id === 2;
                        }
                        return true;
                      })
                      .map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant={getStockStatusVariant(product.stock_status_id)} className="text-base px-4 py-2">
                    {getStockStatusName(product.stock_status_id)}
                  </Badge>
                  {isSold && (
                    <span className="text-xs text-muted-foreground">
                      (Satılan ürün durumu değiştirilemez)
                    </span>
                  )}
                </div>
              )}
            </div>

            {isSold && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Bu ürün satılmıştır. Sadece ürün adı, notlar ve fotoğraflar düzenlenebilir.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Image Lightbox Modal */}
      {lightboxOpen && product.images && product.images.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          {/* Navigation buttons */}
          {product.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 w-12 h-12 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 w-12 h-12 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            </>
          )}
          
          {/* Main image */}
          <div className="max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={getImageUrl(product.images[lightboxIndex])}
              alt={`${product.name} - ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-center text-white mt-2">
              {lightboxIndex + 1} / {product.images.length}
            </p>
          </div>
        </div>
      )}
      
      {/* Label Print Modal */}
      <LabelPrintModal
        open={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
        singleProduct={product}
      />
    </div>
  );
};

export default ProductDetailPage;
