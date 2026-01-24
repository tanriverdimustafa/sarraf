import React, { useState, useEffect } from 'react';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { User, Building2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PartyFormDialog = ({ open, onClose, onSuccess, party, partyTypes = [] }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    party_type_id: 1,
    // Müşteri alanları
    first_name: '',
    last_name: '',
    tc_kimlik_no: '',
    // Tedarikçi alanları
    company_name: '',
    tax_number: '',
    tax_office: '',
    contact_person: '',
    // Ortak alanlar
    phone: '',
    email: '',
    city: '',
    district: '',
    address: '',
    notes: ''
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (party) {
      setFormData({
        party_type_id: party.party_type_id || 1,
        first_name: party.first_name || '',
        last_name: party.last_name || '',
        tc_kimlik_no: party.tc_kimlik_no || '',
        company_name: party.company_name || '',
        tax_number: party.tax_number || '',
        tax_office: party.tax_office || '',
        contact_person: party.contact_person || '',
        phone: party.phone || '',
        email: party.email || '',
        city: party.city || '',
        district: party.district || '',
        address: party.address || '',
        notes: party.notes || ''
      });
    } else {
      setFormData({
        party_type_id: 1,
        first_name: '',
        last_name: '',
        tc_kimlik_no: '',
        company_name: '',
        tax_number: '',
        tax_office: '',
        contact_person: '',
        phone: '',
        email: '',
        city: '',
        district: '',
        address: '',
        notes: ''
      });
    }
  }, [party, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation based on type
    if (formData.party_type_id === 1) {
      if (!formData.first_name.trim() || !formData.last_name.trim()) {
        toast.error('Müşteri için Ad ve Soyad zorunludur');
        return;
      }
    } else if (formData.party_type_id === 2) {
      if (!formData.company_name.trim()) {
        toast.error('Tedarikçi için Firma Adı zorunludur');
        return;
      }
    }

    try {
      setLoading(true);

      if (party) {
        // Update
        await axios.put(`${API}/parties/${party.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cari güncellendi');
      } else {
        // Create
        await axios.post(`${API}/parties`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cari oluşturuldu');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving party:', error);
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  };

  const isCustomer = formData.party_type_id === 1;
  const isSupplier = formData.party_type_id === 2;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="party-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            {party ? (
              // Edit mode
              isCustomer ? (
                <><User className="w-5 h-5 text-green-500" /> Cari Düzenle - MÜŞTERİ</>
              ) : isSupplier ? (
                <><Building2 className="w-5 h-5 text-blue-500" /> Cari Düzenle - TEDARİKÇİ</>
              ) : (
                'Cari Düzenle'
              )
            ) : (
              // Create mode
              isCustomer ? (
                <><User className="w-5 h-5 text-green-500" /> Yeni Cari Oluştur - MÜŞTERİ</>
              ) : isSupplier ? (
                <><Building2 className="w-5 h-5 text-blue-500" /> Yeni Cari Oluştur - TEDARİKÇİ</>
              ) : (
                'Yeni Cari Oluştur'
              )
            )}
          </DialogTitle>
          <DialogDescription>
            {party ? 'Cari bilgilerini düzenleyin' : 'Yeni müşteri veya tedarikçi ekleyin'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cari Tipi */}
          <div className="space-y-2">
            <Label htmlFor="party_type_id">Cari Tipi *</Label>
            <Select
              value={String(formData.party_type_id)}
              onValueChange={(value) => setFormData({ ...formData, party_type_id: parseInt(value) })}
            >
              <SelectTrigger data-testid="party-type-select">
                <SelectValue placeholder="Cari tipi seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-500" />
                    Müşteri
                  </div>
                </SelectItem>
                <SelectItem value="2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    Tedarikçi
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Müşteri Alanları */}
          {isCustomer && (
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-semibold text-sm text-muted-foreground">KİŞİSEL BİLGİLER</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Ad *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Örn: Ahmet"
                    data-testid="first-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Soyad *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Örn: Yılmaz"
                    data-testid="last-name-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tc_kimlik_no">TC Kimlik No</Label>
                <Input
                  id="tc_kimlik_no"
                  value={formData.tc_kimlik_no}
                  onChange={(e) => setFormData({ ...formData, tc_kimlik_no: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  placeholder="11 haneli TC Kimlik No"
                  maxLength={11}
                />
              </div>
            </div>
          )}

          {/* Tedarikçi Alanları */}
          {isSupplier && (
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-semibold text-sm text-muted-foreground">FİRMA BİLGİLERİ</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Firma Adı *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Örn: ABC Kuyumculuk Ltd. Şti."
                  data-testid="company-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_number">Vergi No</Label>
                  <Input
                    id="tax_number"
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="10 haneli Vergi No"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_office">Vergi Dairesi</Label>
                  <Input
                    id="tax_office"
                    value={formData.tax_office}
                    onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                    placeholder="Örn: Kadıköy"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Adres Bilgileri - Ortak */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-semibold text-sm text-muted-foreground">ADRES BİLGİLERİ</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">İl</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Örn: İstanbul"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">İlçe</Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="Örn: Kadıköy"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Açık adres"
                rows={2}
              />
            </div>
          </div>

          {/* İletişim Bilgileri - Ortak */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-semibold text-sm text-muted-foreground">İLETİŞİM</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0532 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ornek@email.com"
                />
              </div>
            </div>
            {isSupplier && (
              <div className="space-y-2">
                <Label htmlFor="contact_person">Yetkili Kişi</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Örn: Mehmet Bey"
                />
              </div>
            )}
          </div>

          {/* Notlar */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ek notlar..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Kaydediliyor...' : party ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PartyFormDialog;
