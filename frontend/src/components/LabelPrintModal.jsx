import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Tag, Download, Printer, Barcode } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LabelPrintModal = ({ open, onClose, products = [], singleProduct = null }) => {
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [shopName, setShopName] = useState('TKGold');
  const [qzReady, setQzReady] = useState(false);
  const [printerName, setPrinterName] = useState('');

  const token = localStorage.getItem('token');
  const productList = singleProduct ? [singleProduct] : products;

  useEffect(() => {
    const initQZ = async () => {
      if (window.qz) {
        try {
          // Sertifika ayarla
          window.qz.security.setCertificatePromise(function(resolve, reject) {
            fetch('/qz-cert.pem')
              .then(response => response.text())
              .then(cert => resolve(cert))
              .catch(err => reject(err));
          });

          // Imza fonksiyonu (demo mod icin bos)
          window.qz.security.setSignaturePromise(function(toSign) {
            return function(resolve, reject) {
              resolve();
            };
          });

          if (!window.qz.websocket.isActive()) {
            await window.qz.websocket.connect();
          }
          setQzReady(true);
          
          const printers = await window.qz.printers.find();
          const zebraPrinter = printers.find(p => 
            p.toLowerCase().includes('zebra') || 
            p.toLowerCase().includes('zd220') ||
            p.toLowerCase().includes('zdesigner')
          );
          if (zebraPrinter) {
            setPrinterName(zebraPrinter);
          } else if (printers.length > 0) {
            setPrinterName(printers[0]);
          }
        } catch (err) {
          console.log('QZ Tray baglantisi kurulamadi:', err);
          setQzReady(false);
        }
      }
    };
    
    if (open) {
      initQZ();
    }
  }, [open]);

  useEffect(() => {
    if (open && productList.length > 0) {
      fetchPreviews();
      fetchShopName();
    }
  }, [open, productList]);

  const fetchShopName = async () => {
    try {
      const response = await axios.get(`${API}/labels/settings/shop-name`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShopName(response.data.shop_name || 'TKGold');
    } catch (error) {
      console.error('Error fetching shop name:', error);
    }
  };

  const fetchPreviews = async () => {
    try {
      setLoading(true);
      const previewPromises = productList.map(p =>
        axios.get(`${API}/labels/preview/${p.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      const responses = await Promise.all(previewPromises);
      setPreviews(responses.map(r => r.data));
    } catch (error) {
      console.error('Error fetching previews:', error);
      toast.error('Etiket onizlemesi yuklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZPL = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/labels/generate`, {
        product_ids: productList.map(p => p.id),
        quantity_each: quantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { zpl, total_labels } = response.data;
      const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiketler_${new Date().toISOString().slice(0,10)}.zpl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${total_labels} etiket ZPL dosyasi indirildi`);
      onClose();
    } catch (error) {
      console.error('Error generating labels:', error);
      toast.error(error.response?.data?.detail || 'Etiket olusturulamadi');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/labels/generate`, {
        product_ids: productList.map(p => p.id),
        quantity_each: quantity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { zpl, total_labels } = response.data;

      if (qzReady && window.qz && printerName) {
        try {
          const config = window.qz.configs.create(printerName, { encoding: 'UTF-8' });
          await window.qz.print(config, [zpl]);
          toast.success(`${total_labels} etiket yazdirildi`);
          onClose();
          return;
        } catch (qzError) {
          console.error('QZ Tray yazdirma hatasi:', qzError);
          toast.error('QZ Tray yazdirma hatasi: ' + qzError.message);
        }
      }

      toast.info('Yazici bulunamadi. ZPL dosyasi indiriliyor...');
      handleDownloadZPL();

    } catch (error) {
      console.error('Error printing labels:', error);
      toast.error(error.response?.data?.detail || 'Yazdirma basarisiz');
    } finally {
      setLoading(false);
    }
  };

  const formatHas = (value) => {
    if (!value && value !== 0) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Etiket Bas ({productList.length} urun)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Etiket Onizleme</Label>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Yukleniyor...</div>
            ) : (
              <div className="space-y-3">
                {previews.map((preview, index) => (
                  <div key={preview.product_id} className="border rounded-lg overflow-hidden bg-white">
                    <div className="flex" style={{ height: '80px' }}>
                      <div className="flex-1 p-2 border-r bg-gray-50 flex flex-col justify-between">
                        <div className="text-xs font-bold text-gray-800">{shopName}</div>
                        <div className="flex items-center justify-center py-1">
                          <Barcode className="w-full h-6 text-gray-800" />
                        </div>
                        <div className="text-[10px] font-mono text-gray-600 truncate">
                          {preview.product_code}
                        </div>
                      </div>
                      <div className="w-12 bg-gray-100 border-r flex items-center justify-center">
                        <div className="text-[8px] text-gray-400 rotate-90">FOLD</div>
                      </div>
                      <div className="flex-1 p-2 bg-gray-50 flex flex-col justify-between text-right">
                        <div className="text-xs font-bold text-gray-800">
                          {preview.weight_gram?.toFixed(2)}gr {preview.karat}
                        </div>
                        <div className="text-[10px] text-gray-600">M: {formatHas(preview.cost_has)}</div>
                        <div className="text-[10px] text-gray-600">S: {formatHas(preview.sale_has)}</div>
                        <div className="text-[10px] text-gray-600">I: {formatHas(preview.labor_has)}</div>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-muted text-xs text-muted-foreground border-t">
                      {preview.product_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Her urunden kac adet etiket?</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Toplam: {productList.length * quantity} etiket basilacak
            </p>
          </div>

          <div className={`p-3 border rounded-lg ${qzReady ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-sm ${qzReady ? 'text-green-800' : 'text-amber-800'}`}>
              <Printer className="w-4 h-4 inline mr-1" />
              {qzReady ? (
                <><strong>QZ Tray bagli!</strong> Yazici: {printerName || 'Seciliyor...'}</>
              ) : (
                <><strong>QZ Tray bulunamadi.</strong> ZPL dosyasini indirip manuel yazdirabilirsiniz.</>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Iptal</Button>
          <Button variant="outline" onClick={handleDownloadZPL} disabled={loading || productList.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            ZPL Indir
          </Button>
          <Button onClick={handlePrint} disabled={loading || productList.length === 0} className="gold-glow-hover">
            <Printer className="w-4 h-4 mr-2" />
            {loading ? 'Isleniyor...' : 'Yazdir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LabelPrintModal;