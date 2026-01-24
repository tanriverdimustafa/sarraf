import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import SearchableSelect from './SearchableSelect';
import { Camera, Upload, X, Image as ImageIcon, ZoomIn } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProductFormDialog = ({ open, onClose, onSuccess, product }) => {
  const [loading, setLoading] = useState(false);
  
  // Lookups
  const [productTypes, setProductTypes] = useState([]);
  const [karats, setKarats] = useState([]);
  const [laborTypes, setLaborTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    product_type_id: 1,
    name: '',
    notes: '',
    karat_id: null,
    weight_gram: '',
    quantity: 1,
    labor_has_value: '',
    alis_has_degeri: '',
    profit_rate_percent: 20,
    supplier_party_id: null,
    purchase_date: '',
  });
  
  // UI states
  const [isGoldBased, setIsGoldBased] = useState(false);
  const [hasLabor, setHasLabor] = useState(false);
  const [selectedLaborTypeId, setSelectedLaborTypeId] = useState(null);
  const [selectedProductType, setSelectedProductType] = useState(null);
  
  // Calculated values (readonly)
  const [fineness, setFineness] = useState(null);
  const [materialHas, setMaterialHas] = useState(0);
  const [laborHas, setLaborHas] = useState(0);
  const [totalCostHas, setTotalCostHas] = useState(0);
  const [saleHasValue, setSaleHasValue] = useState(0);

  // Image upload states
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (open) {
      fetchLookups();
    }
  }, [open]);

  useEffect(() => {
    if (product) {
      // Edit mode
      setFormData({
        product_type_id: product.product_type_id,
        name: product.name || '',
        notes: product.notes || '',
        karat_id: product.karat_id,
        weight_gram: product.weight_gram || '',
        labor_has_value: product.labor_has_value || '',
        alis_has_degeri: product.alis_has_degeri || '',
        profit_rate_percent: product.profit_rate_percent || 20,
        supplier_party_id: product.supplier_party_id || null,
        purchase_date: product.purchase_date ? product.purchase_date.split('T')[0] : '',
      });
      setHasLabor(product.labor_type_id !== null);
      setSelectedLaborTypeId(product.labor_type_id);
      setIsGoldBased(product.is_gold_based);
      setFineness(product.fineness);
      setImages(product.images || []);
    } else {
      // Create mode - reset
      resetForm();
    }
  }, [product, open]);

  // Recalculate when inputs change
  useEffect(() => {
    calculateCosts();
  }, [
    isGoldBased,
    formData.weight_gram,
    formData.quantity,
    selectedProductType,
    fineness,
    hasLabor,
    selectedLaborTypeId,
    formData.labor_has_value,
    formData.alis_has_degeri,
    formData.profit_rate_percent
  ]);

  const resetForm = () => {
    setFormData({
      product_type_id: 1,
      name: '',
      notes: '',
      karat_id: null,
      weight_gram: '',
      quantity: 1,
      labor_has_value: '',
      alis_has_degeri: '',
      profit_rate_percent: 20,
      supplier_party_id: null,
      purchase_date: '',
    });
    setHasLabor(false);
    setSelectedLaborTypeId(null);
    setIsGoldBased(false);
    setSelectedProductType(null);
    setFineness(null);
    setMaterialHas(0);
    setLaborHas(0);
    setTotalCostHas(0);
    setSaleHasValue(0);
    setImages([]);
    setPreviewImage(null);
  };

  const fetchLookups = async () => {
    try {
      const [typesRes, karatsRes, laborRes, suppliersRes] = await Promise.all([
        axios.get(`${API}/lookups/product-types`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/lookups/karats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/lookups/labor-types`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/parties?role=supplier&is_active=true`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setProductTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
      setKarats(Array.isArray(karatsRes.data) ? karatsRes.data : []);
      setLaborTypes(Array.isArray(laborRes.data) ? laborRes.data : []);
      // suppliersRes.data could be paginated response {data: [...], pagination: {...}}
      const suppliersData = suppliersRes.data?.data || suppliersRes.data;
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      
      // Set initial isGoldBased state based on default product type (id=1)
      if (!product && typesRes.data.length > 0) {
        const defaultType = typesRes.data.find(t => t.id === 1);
        if (defaultType) {
          console.log('Setting initial isGoldBased:', defaultType.is_gold_based);
          setIsGoldBased(defaultType.is_gold_based);
        }
      }
    } catch (error) {
      console.error('Error fetching lookups:', error);
      toast.error('Lookup verileri yüklenemedi');
    }
  };

  const handleProductTypeChange = (value) => {
    const typeId = parseInt(value);
    const selectedType = productTypes.find(t => t.id === typeId);
    
    console.log('Product type changed:', typeId, selectedType);
    
    // Update form data with quantity = 1 and auto-fill weight for PIECE types
    let newFormData = { 
      ...formData, 
      product_type_id: typeId,
      quantity: 1
    };
    
    // PIECE tipi için birim ağırlığı otomatik set et
    if (selectedType?.unit === 'PIECE' && selectedType?.fixed_weight) {
      newFormData.weight_gram = selectedType.fixed_weight;
    }
    
    setFormData(newFormData);
    setSelectedProductType(selectedType);
    
    if (selectedType) {
      console.log('Setting isGoldBased to:', selectedType.is_gold_based);
      setIsGoldBased(selectedType.is_gold_based);
    }
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
    if (!isGoldBased) {
      // Altın olmayan: sadece PER_PIECE
      return laborTypes.filter(lt => lt.code === 'PER_PIECE');
    }
    return laborTypes;
  };

  const calculateCosts = () => {
    let material = 0;
    let labor = 0;

    if (isGoldBased) {
      // Altın ürün
      let weight = parseFloat(formData.weight_gram) || 0;
      
      // PIECE tipi için: toplam ağırlık = adet × birim ağırlık
      if (selectedProductType?.unit === 'PIECE' && selectedProductType?.fixed_weight) {
        const quantity = parseInt(formData.quantity) || 1;
        weight = quantity * selectedProductType.fixed_weight;
      }
      
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

  const formatHas = (value) => {
    return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

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
    
    if (images.length >= 5) {
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
      
      // For new products, just add to local state
      if (!product) {
        setImages(prev => [...prev, resizedImage]);
        toast.success('Fotoğraf eklendi');
      } else {
        // For existing products, upload to server
        await axios.post(`${API}/products/${product.id}/images`, 
          { image: resizedImage },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setImages(prev => [...prev, resizedImage]);
        toast.success('Fotoğraf yüklendi');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(error.response?.data?.detail || 'Fotoğraf yüklenemedi');
    } finally {
      setUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveImage = async (index) => {
    try {
      if (product) {
        // For existing products, delete from server
        await axios.delete(`${API}/products/${product.id}/images/${index}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setImages(prev => prev.filter((_, i) => i !== index));
      toast.success('Fotoğraf silindi');
    } catch (error) {
      console.error('Image delete error:', error);
      toast.error(error.response?.data?.detail || 'Fotoğraf silinemedi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Ürün adı zorunludur');
      return;
    }

    if (isGoldBased) {
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
      setLoading(true);

      const payload = {
        product_type_id: formData.product_type_id,
        name: formData.name,
        notes: formData.notes || null,
        profit_rate_percent: parseFloat(formData.profit_rate_percent),
        quantity: parseInt(formData.quantity) || 1,
      };

      if (isGoldBased) {
        payload.karat_id = formData.karat_id;
        // PIECE için: toplam ağırlık = adet × birim ağırlık
        if (selectedProductType?.unit === 'PIECE' && selectedProductType?.fixed_weight) {
          payload.weight_gram = parseInt(formData.quantity) * selectedProductType.fixed_weight;
        } else {
          payload.weight_gram = parseFloat(formData.weight_gram);
        }
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

      // Tedarikçi bilgisi (opsiyonel)
      if (formData.supplier_party_id) {
        payload.supplier_party_id = formData.supplier_party_id;
      }
      if (formData.purchase_date) {
        payload.purchase_date = formData.purchase_date;
      }

      if (product) {
        // Update - hesaplanan değerleri de ekle
        payload.material_has = materialHas;
        payload.labor_has = laborHas;
        payload.cost_has = totalCostHas;
        payload.sale_has = saleHasValue;
        
        await axios.put(`${API}/products/${product.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Ürün güncellendi');
      } else {
        // Create new product - hesaplanan değerleri de ekle
        payload.material_has = materialHas;
        payload.labor_has = laborHas;
        payload.cost_has = totalCostHas;
        payload.sale_has = saleHasValue;
        
        const response = await axios.post(`${API}/products`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Upload images for new product
        if (images.length > 0 && response.data.id) {
          for (const image of images) {
            try {
              await axios.post(`${API}/products/${response.data.id}/images`, 
                { image },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            } catch (imgError) {
              console.error('Image upload error:', imgError);
            }
          }
        }
        toast.success('Ürün oluşturuldu');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="product-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {product ? 'Ürün Düzenle' : 'Yeni Ürün Oluştur'}
          </DialogTitle>
          <DialogDescription>
            Tüm hesaplamalar HAS altın cinsinden yapılır. Auto-calculated alanlar readonly'dir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. TEMEL BİLGİLER */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">1. Temel Bilgiler</h3>
            
            <div className="space-y-2">
              <Label htmlFor="product_type_id">Ürün Tipi *</Label>
              <Select
                value={String(formData.product_type_id)}
                onValueChange={handleProductTypeChange}
                disabled={!!product}
              >
                <SelectTrigger data-testid="product-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* SARRAFIYE */}
                  <SelectGroup>
                    <SelectLabel className="text-yellow-600 font-semibold">--- SARRAFİYE ---</SelectLabel>
                    {productTypes.filter(t => t.group === 'SARRAFIYE').map(type => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name} {type.fixed_weight ? `(${type.fixed_weight}g)` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  
                  {/* GRAM ALTIN */}
                  <SelectGroup>
                    <SelectLabel className="text-yellow-600 font-semibold">--- GRAM ALTIN ---</SelectLabel>
                    {productTypes.filter(t => t.group === 'GRAM_GOLD').map(type => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  
                  {/* BİLEZİK */}
                  <SelectGroup>
                    <SelectLabel className="text-amber-600 font-semibold">--- BİLEZİK ---</SelectLabel>
                    {productTypes.filter(t => t.group === 'BILEZIK').map(type => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name} (Havuz)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  
                  {/* HURDA */}
                  <SelectGroup>
                    <SelectLabel className="text-orange-600 font-semibold">--- HURDA ---</SelectLabel>
                    {productTypes.filter(t => t.group === 'HURDA').map(type => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  
                  {/* TAKI */}
                  <SelectGroup>
                    <SelectLabel className="text-blue-600 font-semibold">--- TAKI ---</SelectLabel>
                    {productTypes.filter(t => t.group === 'TAKI').map(type => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Ürün Adı *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn: Kafes İşi Bilezik"
                required
                data-testid="product-name-input"
              />
            </div>

            {product && (
              <div className="space-y-2">
                <Label>Barkod (Readonly)</Label>
                <Input
                  value={product.barcode}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ek notlar..."
                rows={2}
                data-testid="product-notes-input"
              />
            </div>

            {/* Tedarikçi Bilgisi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_party_id">Tedarikçi</Label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Seçilmedi' },
                    ...suppliers.filter(s => s.id).map(s => ({
                      value: s.id,
                      label: s.name || s.company_name || `${s.first_name || ''} ${s.last_name || ''}`.trim()
                    }))
                  ]}
                  value={formData.supplier_party_id || ''}
                  onChange={(value) => setFormData({ ...formData, supplier_party_id: value || null })}
                  placeholder="Tedarikçi ara..."
                  isClearable={true}
                  data-testid="supplier-select"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Alış Tarihi</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  data-testid="purchase-date-input"
                />
              </div>
            </div>

            {/* Ürün Fotoğrafları */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Ürün Fotoğrafları ({images.length}/5)
              </Label>
              
              {/* Upload buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={images.length >= 5 || uploadingImage}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Fotoğraf Çek
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= 5 || uploadingImage}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Dosya Seç
                </Button>
                {uploadingImage && (
                  <span className="text-sm text-muted-foreground animate-pulse">Yükleniyor...</span>
                )}
              </div>
              
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
              
              {/* Image thumbnails */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((img, index) => (
                    <div 
                      key={index} 
                      className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border"
                    >
                      <img
                        src={img}
                        alt={`Ürün ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div 
                        className="absolute bottom-0 right-0 p-1 bg-black/50 rounded-tl cursor-pointer"
                        onClick={() => setPreviewImage(img)}
                      >
                        <ZoomIn className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {images.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Henüz fotoğraf eklenmedi. Maksimum 5 fotoğraf yükleyebilirsiniz.
                </div>
              )}
            </div>
          </div>

          {/* 2. ALTIN BİLGİSİ */}
          {isGoldBased && (
            <div className="space-y-4 border-b pb-4" data-testid="gold-info-section">
              <h3 className="text-lg font-semibold">2. Altın Bilgisi</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="karat_id">Ayar *</Label>
                  <SearchableSelect
                    options={karats.map(k => ({
                      value: k.id,
                      label: `${k.karat} Ayar (${(k.fineness * 1000).toFixed(0)} milyem)`
                    }))}
                    value={formData.karat_id}
                    onChange={(value) => handleKaratChange(value ? String(value) : '')}
                    placeholder="Ayar ara..."
                    data-testid="karat-select"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Milyem (Auto) ⚡</Label>
                  <Input
                    value={fineness !== null ? fineness.toFixed(3) : ''}
                    disabled
                    className="bg-accent/10 border-green-500"
                    placeholder="Ayar seçince otomatik"
                    data-testid="fineness-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {/* PIECE tipi için Adet inputu */}
                {selectedProductType?.unit === 'PIECE' ? (
                  <>
                    <Label htmlFor="quantity">Adet *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="1"
                      min="1"
                      max="10000"
                      value={formData.quantity}
                      onChange={(e) => {
                        const adet = parseInt(e.target.value) || 1;
                        const birimAgirlik = selectedProductType?.fixed_weight || 1;
                        setFormData({ 
                          ...formData, 
                          quantity: adet,
                          weight_gram: adet * birimAgirlik
                        });
                      }}
                      placeholder="Kaç adet?"
                      required={isGoldBased}
                      data-testid="quantity-input"
                    />
                    <p className="text-sm text-muted-foreground">
                      Birim ağırlık: {selectedProductType?.fixed_weight || '-'} gr | 
                      Toplam: {((parseInt(formData.quantity) || 0) * (selectedProductType?.fixed_weight || 0)).toFixed(2)} gr
                    </p>
                  </>
                ) : (
                  <>
                    {/* GRAM tipi için Ağırlık inputu */}
                    <Label htmlFor="weight_gram">Ağırlık (gram) *</Label>
                    <Input
                      id="weight_gram"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="10000"
                      value={formData.weight_gram}
                      onChange={(e) => {
                        const gram = parseFloat(e.target.value) || 0;
                        setFormData({ 
                          ...formData, 
                          weight_gram: gram,
                          quantity: gram  // GRAM için quantity = weight
                        });
                      }}
                      placeholder="Örn: 15.50"
                      required={isGoldBased}
                      data-testid="weight-gram-input"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3. İŞÇİLİK */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">3. İşçilik</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has_labor"
                checked={hasLabor}
                onCheckedChange={setHasLabor}
                data-testid="labor-checkbox"
              />
              <Label htmlFor="has_labor" className="cursor-pointer">İşçilik Var mı? (UI toggle)</Label>
            </div>

            {hasLabor && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="labor_type_id">İşçilik Tipi *</Label>
                  <Select
                    value={selectedLaborTypeId ? String(selectedLaborTypeId) : ''}
                    onValueChange={handleLaborTypeChange}
                  >
                    <SelectTrigger data-testid="labor-type-select">
                      <SelectValue placeholder="Tip seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredLaborTypes().map(lt => (
                        <SelectItem key={lt.id} value={String(lt.id)}>
                          {lt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isGoldBased && (
                    <p className="text-xs text-muted-foreground">⚠️ Altın olmayan: sadece Adet Başı</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="labor_has_value">İşçilik Değeri (HAS) *</Label>
                  <Input
                    id="labor_has_value"
                    type="number"
                    step="0.000001"
                    min="0.001"
                    max="10000"
                    value={formData.labor_has_value}
                    onChange={(e) => setFormData({ ...formData, labor_has_value: e.target.value })}
                    placeholder="Örn: 0.5"
                    required={hasLabor}
                    data-testid="labor-value-input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. MALİYET */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">4. Maliyet</h3>

            {!isGoldBased && (
              <div className="space-y-2" data-testid="alis-has-section">
                <Label htmlFor="alis_has_degeri">Alış HAS Değeri *</Label>
                <Input
                  id="alis_has_degeri"
                  type="number"
                  step="0.000001"
                  min="0.001"
                  max="100000"
                  value={formData.alis_has_degeri}
                  onChange={(e) => setFormData({ ...formData, alis_has_degeri: e.target.value })}
                  placeholder="Örn: 2.5"
                  required={!isGoldBased}
                  data-testid="alis-has-input"
                />
                <p className="text-xs text-muted-foreground">
                  Ödediğiniz TL/USD tutarının o anki has altın fiyatı ile karşılığı
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Materyal HAS (Auto) ⚡</Label>
                <Input
                  value={formatHas(materialHas)}
                  disabled
                  className="bg-accent/10 border-green-500 text-right"
                  data-testid="material-has-display"
                />
              </div>

              <div className="space-y-2">
                <Label>İşçilik HAS (Auto) ⚡</Label>
                <Input
                  value={formatHas(laborHas)}
                  disabled
                  className="bg-accent/10 border-green-500 text-right"
                  data-testid="labor-has-display"
                />
              </div>

              <div className="space-y-2">
                <Label>Toplam Maliyet (Auto) ⚡</Label>
                <Input
                  value={formatHas(totalCostHas)}
                  disabled
                  className="bg-accent/10 border-green-500 text-right font-semibold"
                  data-testid="total-cost-display"
                />
              </div>
            </div>
          </div>

          {/* 5. SATIŞ */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">5. Satış</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profit_rate_percent">Kar Marjı % *</Label>
                <Input
                  id="profit_rate_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="500"
                  value={formData.profit_rate_percent}
                  onChange={(e) => setFormData({ ...formData, profit_rate_percent: e.target.value })}
                  placeholder="Örn: 20"
                  required
                  data-testid="profit-rate-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Satış HAS Değeri (Auto) ⚡</Label>
                <Input
                  value={formatHas(saleHasValue)}
                  disabled
                  className="bg-accent/10 border-green-500 text-right font-semibold text-lg"
                  data-testid="sale-has-display"
                />
              </div>
            </div>
          </div>

          {/* Image Preview Modal */}
          {previewImage && (
            <div 
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh]">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-2 right-2 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              İptal
            </Button>
            <Button type="submit" disabled={loading} data-testid="product-submit-btn">
              {loading ? 'Kaydediliyor...' : product ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormDialog;