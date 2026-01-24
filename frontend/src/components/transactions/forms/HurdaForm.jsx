import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Plus, Trash2, Save, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { createFinancialTransaction, getParties, getKarats, getLatestPriceSnapshot } from '../../../services/financialV2Service';

const HurdaForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState([]);
  const [karats, setKarats] = useState([]);
  const [priceSnapshot, setPriceSnapshot] = useState(null);
  const [hasPrice, setHasPrice] = useState('');
  
  const [formData, setFormData] = useState({
    type_code: 'HURDA',
    party_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
    lines: [
      {
        karat_id: '',
        weight_gram: '',
        scrap_type: 'broken_jewelry',
        note: '',
      },
    ],
  });

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    console.log('🔍 HurdaForm: Loading lookups...');
    
    try {
      const [partiesData, karatsData, snapshotData] = await Promise.all([
        getParties(),
        getKarats(),
        getLatestPriceSnapshot(),
      ]);
      
      console.log('📊 Parties data:', partiesData);
      console.log('📊 Karats data:', karatsData);
      console.log('📊 Snapshot data:', snapshotData);
      
      setParties(partiesData || []);
      setKarats(karatsData || []);
      setPriceSnapshot(snapshotData);
      
      console.log('✅ State updated - Parties:', partiesData?.length, 'Karats:', karatsData?.length);
      
      // Set default HAS price (sell price for hurda - buying from customer)
      if (snapshotData?.has_buy_tl) {
        setHasPrice(snapshotData.has_buy_tl.toString());
      }
    } catch (error) {
      console.error('❌ Lookup load error:', error);
      toast.error('Veriler yüklenemedi: ' + error.message);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index, field, value) => {
    setFormData((prev) => {
      const newLines = [...prev.lines];
      newLines[index] = { ...newLines[index], [field]: value };
      return { ...prev, lines: newLines };
    });
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          karat_id: '',
          weight_gram: '',
          scrap_type: 'broken_jewelry',
          note: '',
        },
      ],
    }));
  };

  const removeLine = (index) => {
    if (formData.lines.length === 1) {
      toast.error('En az bir satır gereklidir');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.party_id) {
      toast.error('Party ID gereklidir');
      return;
    }

    if (!formData.lines || formData.lines.length === 0) {
      toast.error('En az bir hurda altın kalemi gereklidir');
      return;
    }

    // Check all lines have required fields
    const invalidLine = formData.lines.find(
      (line) => !line.karat_id || !line.weight_gram || parseFloat(line.weight_gram) <= 0
    );
    if (invalidLine) {
      toast.error('Tüm satırlar için karat ve ağırlık gereklidir');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type_code: 'HURDA',
        party_id: formData.party_id,
        transaction_date: formData.transaction_date,
        notes: formData.notes,
        lines: formData.lines.map((line) => ({
          karat_id: line.karat_id,
          weight_gram: parseFloat(line.weight_gram),
          scrap_type: line.scrap_type,
          note: line.note,
        })),
        idempotency_key: `hurda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      const result = await createFinancialTransaction(payload);
      toast.success('Hurda altın işlemi başarıyla oluşturuldu!');
      if (onSuccess) onSuccess(result);
    } catch (error) {
      toast.error('İşlem oluşturulamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* HAS Price Display */}
      {priceSnapshot && (
        <Card className="border-amber-500/20 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-amber-800">Has Altın Alış Fiyatı (TL/gr)</Label>
                <p className="text-xs text-muted-foreground">Hurda alım işleminde kullanılacak</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={hasPrice}
                  onChange={(e) => setHasPrice(e.target.value)}
                  className="w-32 text-right font-mono text-lg font-semibold"
                />
                <span className="text-amber-800 font-semibold">₺</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-600" />
            <div>
              <CardTitle>Hurda Altın İşlemi (HURDA)</CardTitle>
              <CardDescription>Hurda altın ile ödeme (HAS OUT)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Party *</Label>
              <Select value={formData.party_id} onValueChange={(value) => handleChange('party_id', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Hurda kabul edilecek party" />
                </SelectTrigger>
                <SelectContent>
                  {parties.map((party) => (
                    <SelectItem key={party.id} value={party.id.toString()}>
                      {party.name} ({party.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>İşlem Tarihi *</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => handleChange('transaction_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notlar</Label>
            <Textarea
              placeholder="Hurda altın işlemi açıklaması..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scrap Gold Items */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hurda Altın Kalemleri</CardTitle>
              <CardDescription>{formData.lines.length} kalem</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-2" />
              Kalem Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.lines.map((line, index) => (
            <div key={index} className="p-4 border border-primary/20 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Hurda #{index + 1}</span>
                {formData.lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Karat *</Label>
                  <Select
                    value={line.karat_id}
                    onValueChange={(value) => handleLineChange(index, 'karat_id', value)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hurda ayar se\u00e7iniz" />
                    </SelectTrigger>
                    <SelectContent>
                      {karats.map((karat) => (
                        <SelectItem key={karat.id} value={karat.id.toString()}>
                          {karat.karat} ({karat.fineness})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">HAS = weight \u00d7 fineness</p>
                </div>

                <div className="space-y-2">
                  <Label>Ağırlık (gram) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="10.50"
                    value={line.weight_gram}
                    onChange={(e) => handleLineChange(index, 'weight_gram', e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">HAS = weight × fineness</p>
                </div>

                <div className="space-y-2">
                  <Label>Hurda Tipi</Label>
                  <Input
                    placeholder="Kırık takı, eski takı, vb."
                    value={line.scrap_type}
                    onChange={(e) => handleLineChange(index, 'scrap_type', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Not</Label>
                  <Input
                    placeholder="Kalem notu..."
                    value={line.note}
                    onChange={(e) => handleLineChange(index, 'note', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="text-sm text-amber-800">
          <strong>Not:</strong> Hurda altın kabulü, weight_gram × fineness üzerinden HAS hesaplar.
          TL karşılığı meta alanında referans olarak saklanır.
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            İptal
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Kaydediliyor...' : 'Hurda İşlemini Kaydet'}
        </Button>
      </div>
    </form>
  );
};

export default HurdaForm;
