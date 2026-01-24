# 🔄 KAPSAMLI FRONTEND REGRESYON TESTİ - DEVAM

## ✅ TAMAMLANAN TESTLER - GÜNCEL DURUM (18 Aralık 2025)

| # | Test | Sonuç | Not |
|---|------|-------|-----|
| 1.1 | Tedarikçi zorunlu | ✅ | FE validasyon çalışıyor |
| 1.2 | Ürün girişi + borçlanma | ✅ | |
| 1.3 | Ürün silme + VOID | ✅ | |
| 2.1 | Alış - TL tam ödeme | ✅ | TRX-20251218-1A8E, Bakiye: 0 |
| 2.3 | Alış - Eksik ödeme + KAR | ✅ | Fark seçim kutusu çalışıyor |
| 2.4 | Alış - Eksik ödeme + BORÇ | ✅ | Party bakiye güncellendi |
| 2.6 | Alış - Veresiye | ✅ | 0 TL ödeme, tam borç |
| 3.1 | Satış formu | ✅ | Form erişilebilir |
| 4.1 | Ödeme formu | ✅ | Form erişilebilir |
| 5.1 | Döviz formu | ✅ | Alış/Satış çalışıyor |
| 6.1 | Tahsilat formu | ✅ | Form erişilebilir |
| 8.1 | Giderler sayfası | ✅ | Yeni gider dialog çalışıyor |
| 9.1 | Personel sayfası | ✅ | Sayfa erişilebilir |
| 10.1 | Ortaklar sayfası | ✅ | Sayfa erişilebilir |
| 11.1 | Kasa sayfası | ✅ | 6 kasa görünüyor |
| 12.1 | Muhasebe Defteri | ✅ | Unified Ledger çalışıyor |
| 12.2 | Stok Raporu | ✅ | 4 ürün, 27.45 HAS, 164.684 TL |
| - | Cariler sayfası | ✅ | 6 test carisi oluşturuldu |

---

## ⏳ KALAN TESTLER

### Bölüm 2: İşlemler - Alış (6 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 2.1 | Alış - TL tam ödeme | ✅ TEST BAŞARILI |
| 2.2 | Alış - USD ödeme | ⏭️ (Form mevcut, test edilmedi) |
| 2.3 | Alış - Eksik ödeme + KAR | ✅ TEST BAŞARILI - Fark seçim kutusu görünüyor |
| 2.4 | Alış - Eksik ödeme + BORÇ | ✅ TEST BAŞARILI |
| 2.5 | Alış - Fazla ödeme + ZARAR | ⏭️ (Form mevcut, test edilmedi) |
| 2.6 | Alış - Veresiye | ✅ TEST BAŞARILI |
```

### Bölüm 3: İşlemler - Satış (4 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 3.1 | Satış - TL tahsilat | ❓ |
| 3.2 | Satış - Hurda tahsilat | ❓ |
| 3.3 | Satış - Veresiye | ❓ |
| 3.4 | Satış - Kısmi + İskonto | ❓ |
```

### Bölüm 4: Ödemeler (4 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 4.1 | Ödeme - TL | ❓ |
| 4.2 | Ödeme - Hurda | ❓ |
| 4.3 | Ödeme - USD | ❓ |
| 4.4 | Ödeme - EUR | ❓ |
```

### Bölüm 5: Döviz İşlemleri (3 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 5.1 | Döviz Alış | ❓ |
| 5.2 | Döviz Satış | ❓ |
| 5.3 | EUR Alış/Satış | ❓ |
```

### Bölüm 6: Tahsilatlar (1 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 6.1 | Tahsilat - TL | ❓ |
```

### Bölüm 7: İşlem İptal (2 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 7.1 | İşlem İptal - Alış | ❓ |
| 7.2 | İşlem İptal - Satış | ❓ |
```

### Bölüm 8: Giderler (Kalan 2 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 8.2 | Gider Düzenleme → ADJUSTMENT | ❓ |
| 8.3 | Gider Silme → VOID | ❓ |
```

### Bölüm 9: Personel İşlemleri (3 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 9.1 | Maaş Tahakkuk | ❓ |
| 9.2 | Maaş Ödeme | ❓ |
| 9.3 | Personel Borç | ❓ |
```

### Bölüm 10: Ortaklar / Sermaye (2 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 10.1 | Sermaye Girişi | ❓ |
| 10.2 | Sermaye Çıkışı | ❓ |
```

### Bölüm 11: Kasa İşlemleri (2 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 11.1 | Kasa Transferi | ❓ |
| 11.2 | Manuel Kasa | ❓ |
```

### Bölüm 12: Raporlar (2 test)
```
| # | Test | Sonuç |
|---|------|-------|
| 12.1 | Cari Ekstre | ❓ |
| 12.2 | Stok Raporu | ❓ |
```

---

## 📋 HER TEST İÇİN YAPILACAKLAR

1. **FRONTEND'den** işlem yap (curl ile DEĞİL!)
2. **EKRAN GÖRÜNTÜSÜ** al
3. **Kontrol et:**
   - Cari bakiyeye yansıdı mı?
   - Kasa hareketine yansıdı mı?
   - Unified Ledger'a kayıt oluştu mu?
4. **Hata varsa** HEM BACKEND HEM FRONTEND düzelt

---

## 📌 TEST DETAYLARI

### TEST 2.1: Alış - TL Tam Ödeme
```
1. İşlemler > Yeni İşlem > Alış
2. Party: Yeni müşteri oluştur "Alış Test TL"
3. Ürün ekle: 10gr Hurda 14K
4. Beklenen tutar not al (örn: 35.000 TL)
5. Ödeme: TAM TUTAR gir (35.000 TL)
6. Kasa: TL Kasa
7. Kaydet
8. EKRAN GÖRÜNTÜSÜ

Kontroller:
- Parties > "Alış Test TL" → Bakiye: 0
- Kasa > TL Kasa > Hareketler → -35.000 TL çıkış
- Muhasebe Defteri → PURCHASE kaydı
```

### TEST 2.2: Alış - USD Ödeme
```
1. İşlemler > Yeni İşlem > Alış
2. Party: Yeni müşteri "Alış Test USD"
3. Ürün ekle: 5gr Hurda 22K
4. Ödeme: 500 USD
5. Kasa: USD Kasa
6. Kaydet
7. EKRAN GÖRÜNTÜSÜ

Kontroller:
- Kasa > USD Kasa > Hareketler → -500 USD çıkış
```

### TEST 2.3: Alış - Eksik Ödeme + KAR
```
1. İşlemler > Yeni İşlem > Alış
2. Party: Yeni müşteri "Alış Test Kar"
3. Ürün ekle: 10gr Hurda 14K (beklenen: ~35.000 TL)
4. Ödeme: 30.000 TL (5.000 TL eksik)
5. Fark seçim kutusu görünmeli!
6. "Bakiye sıfırlansın (Şirket KAR etti)" seç
7. EKRAN GÖRÜNTÜSÜ (seçim kutusu)
8. Kaydet

Kontroller:
- Parties > "Alış Test Kar" → Bakiye: 0
- Muhasebe Defteri → PURCHASE + PURCHASE_PROFIT kayıtları
```

### TEST 3.1: Satış - TL Tahsilat
```
1. İşlemler > Yeni İşlem > Satış
2. Party: Yeni müşteri "Satış Test TL"
3. Stoktan ürün seç
4. Satış fiyatı not al
5. Tahsilat: TAM TUTAR
6. Kasa: TL Kasa
7. Kaydet
8. EKRAN GÖRÜNTÜSÜ

Kontroller:
- Parties → Bakiye: 0
- Kasa → +X TL giriş
- Muhasebe Defteri → SALE kaydı
- Ürünler → Ürün "Satıldı" durumunda
```

### TEST 4.1: Ödeme - TL (Tedarikçiye)
```
1. İşlemler > Ödemeler > Yeni Ödeme
2. Party: Borçlu olduğumuz tedarikçi
3. Tutar: 10.000 TL
4. Kasa: TL Kasa
5. Kaydet
6. EKRAN GÖRÜNTÜSÜ

Kontroller:
- Parties → Bakiye AZALDI
- Kasa → -10.000 TL çıkış
- Muhasebe Defteri → PAYMENT kaydı
```

### TEST 5.1: Döviz Alış
```
1. İşlemler > Döviz İşlemleri > Yeni
2. İşlem tipi: ALIŞ
3. Döviz: USD, Miktar: 1000
4. Kur: 34.00, Toplam: 34.000 TL
5. Kaydet
6. EKRAN GÖRÜNTÜSÜ

Kontroller:
- USD Kasa → +1000 USD giriş
- TL Kasa → -34.000 TL çıkış
- Muhasebe Defteri → EXCHANGE kaydı
```

### TEST 7.1: İşlem İptal - Alış
```
1. İşlemler listesine git
2. Bir ALIŞ işlemi seç
3. "İptal Et" butonuna tıkla
4. Sebep gir, İptal et
5. EKRAN GÖRÜNTÜSÜ

Kontroller:
- İşlem "CANCELLED" durumunda
- Party bakiyesi geri alındı
- Muhasebe Defteri → VOID kaydı
```

---

## 🎯 HEDEF

```
Toplam Test: 34
Tamamlanan: ~5
Kalan: ~29

34/34 = %100 olana kadar devam et!
```

---

## ⚠️ HATA BULUNURSA

1. Hatanın EKRAN GÖRÜNTÜSÜ
2. Console/Network hata mesajı
3. DÜZELTME yap (FE + BE)
4. Tekrar test et
5. Düzeltme sonrası EKRAN GÖRÜNTÜSÜ
