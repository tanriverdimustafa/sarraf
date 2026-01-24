# PRODUCT MODULE – FINAL IMPLEMENTATION SUMMARY

## 1. DATABASE SCHEMA

### Lookup Tables (HARDCODED YOK)

```javascript
product_types
-------------
id: int
code: string
name: string
is_gold_based: boolean

Data:
1  GOLD_JEWELRY    "Altın Takı"              true
2  GOLD_RING       "Altın Yüzük"             true
3  GOLD_BRACELET   "Altın Bilezik"           true
4  GOLD_COIN       "Altın Sikke"             true
5  GOLD_BULLION    "Külçe Altın"             true
6  GOLD_SCRAP      "Hurda Altın"             true
7  DIAMOND         "Pırlanta"                false
8  GEMSTONE        "Değerli Taş"             false
9  NON_GOLD_ITEM   "Altın Olmayan Ürün"      false
```

```javascript
karats
------
id: int
karat: int
fineness: float

Data:
1  8   0.333
2  14  0.585
3  18  0.750
4  22  0.916
5  24  1.000
```

```javascript
labor_types
-----------
id: int
code: string
name: string

Data:
1  PER_GRAM   "Gram Başı"
2  PER_PIECE  "Adet Başı"
```

```javascript
stock_statuses
--------------
id: int
code: string
name: string

Data:
1  IN_STOCK   "Stokta"
2  SOLD       "Satıldı"
3  RESERVED   "Rezerve"
```

### Products Table

```javascript
products
--------
id: uuid
barcode: string (unique, auto-generated: PRD-YYYYMMDD-XXXX)
product_type_id: int FK
name: string
notes: string (nullable)

// Altın bilgisi (only if is_gold_based)
karat_id: int FK (nullable)
fineness: float (nullable, from karat)
weight_gram: float (nullable)

// İşçilik
labor_type_id: int FK (nullable)
labor_has_value: float (nullable)

// Maliyet (CALCULATED, STORED)
material_has_cost: float
labor_has_cost: float
total_cost_has: float
alis_has_degeri: float (nullable, for non-gold)

// Satış (CALCULATED, STORED)
profit_rate_percent: float
sale_has_value: float

// Metadata
images: array[string] (nullable)
stock_status_id: int FK
is_gold_based: boolean (denormalized from product_type)
created_at: timestamp
updated_at: timestamp
```

## 2. DOMAIN RULES

### Gold Product (is_gold_based = TRUE)

**Required Fields:**
- product_type_id
- name
- karat_id
- weight_gram
- profit_rate_percent

**Calculations:**
```
fineness = karats[karat_id].fineness (AUTO)
material_has_cost = weight_gram × fineness

IF labor_type_id IS NULL:
  labor_has_cost = 0
ELSE IF labor_type_id = 1 (PER_GRAM):
  labor_has_cost = weight_gram × labor_has_value
ELSE IF labor_type_id = 2 (PER_PIECE):
  labor_has_cost = labor_has_value

total_cost_has = material_has_cost + labor_has_cost
sale_has_value = total_cost_has × (1 + profit_rate_percent / 100)
```

**Labor Rules:**
- PER_GRAM: ✅ Allowed
- PER_PIECE: ✅ Allowed

### Non-Gold Product (is_gold_based = FALSE)

**Required Fields:**
- product_type_id
- name
- alis_has_degeri
- profit_rate_percent

**Calculations:**
```
material_has_cost = alis_has_degeri

IF labor_type_id IS NULL:
  labor_has_cost = 0
ELSE IF labor_type_id = 1 (PER_GRAM):
  ERROR: "Altın olmayan ürünlerde gram başı işçilik kullanılamaz"
ELSE IF labor_type_id = 2 (PER_PIECE):
  labor_has_cost = labor_has_value

total_cost_has = material_has_cost + labor_has_cost
sale_has_value = total_cost_has × (1 + profit_rate_percent / 100)
```

**Labor Rules:**
- PER_GRAM: ❌ FORBIDDEN
- PER_PIECE: ✅ Allowed

## 3. BACKEND VALIDATION

### Create Product

```javascript
// 1. Verify product_type_id exists
product_type = db.product_types.findOne({id: product_type_id})
if (!product_type) throw 400

is_gold_based = product_type.is_gold_based

// 2. Validate based on type
if (is_gold_based) {
  if (!karat_id || !weight_gram) throw 400
  karat = db.karats.findOne({id: karat_id})
  if (!karat) throw 400
  fineness = karat.fineness
} else {
  if (!alis_has_degeri) throw 400
  fineness = null
}

// 3. Validate labor
if (labor_type_id) {
  labor_type = db.labor_types.findOne({id: labor_type_id})
  if (!labor_type) throw 400
  
  if (labor_type.code === "PER_GRAM" && !is_gold_based) {
    throw 400: "Altın olmayan ürünlerde gram başı işçilik kullanılamaz"
  }
  
  if (!labor_has_value) throw 400
}

// 4. Calculate costs
costs = calculate_product_costs(...)

// 5. Generate barcode
barcode = generate_barcode() // PRD-YYYYMMDD-XXXX

// 6. Set initial stock status
stock_status_id = 1 // IN_STOCK
```

### Update Product

```javascript
product = db.products.findOne({id: product_id})
if (!product) throw 404

current_stock_status = product.stock_status_id

// Stock status = SOLD (2)
if (current_stock_status === 2) {
  // Only allow: notes, images
  allowed_fields = ["notes", "images"]
  if (update has other fields) throw 400
}

// Stock status transition validation
if (new_stock_status) {
  if (current_stock_status === 2 && new_stock_status !== 2) {
    throw 400: "Satılan ürün stok durumu değiştirilemez"
  }
}

// Labor validation (same as create)
if (labor_type_id === 1 && !is_gold_based) {
  throw 400: "Altın olmayan ürünlerde gram başı işçilik kullanılamaz"
}

// If cost-affecting fields changed, recalculate
if (karat_id || weight_gram || labor_type_id || labor_has_value || 
    alis_has_degeri || profit_rate_percent changed) {
  costs = calculate_product_costs(...)
  update costs
}
```

## 4. FRONTEND UI RULES

### Product Create Screen

#### Temel Bilgiler
- **Ürün Tipi:** Combo (DB lookup), Editable, Required
- **Ürün Adı:** Text, Editable, Required
- **Barkod:** Text, Readonly, Auto-generated
- **Notlar:** Textarea, Editable, Optional

#### Altın Bilgisi (Visible if is_gold_based = TRUE)
- **Ayar:** Combo (DB lookup), Editable, Required
- **Milyem:** Number, Readonly, Auto (from ayar)
- **Gram Ağırlık:** Number, Editable, Required

#### İşçilik
- **İşçilik Var mı?:** Checkbox (UI only)
- **İşçilik Tipi:** Combo (DB lookup, FILTERED), Editable, Required if checked
- **İşçilik Değeri:** Number, Editable, Required if checked

**Combo Filtering:**
```javascript
if (is_gold_based) {
  options = [PER_GRAM, PER_PIECE]
} else {
  options = [PER_PIECE] // PER_GRAM hidden/disabled
}
```

#### Maliyet (Altın)
- **Materyal HAS:** Readonly, Auto-calculated
- **İşçilik HAS:** Readonly, Auto-calculated
- **Toplam Maliyet:** Readonly, Auto-calculated

#### Maliyet (Altın Olmayan)
- **Alış HAS Değeri:** Editable, Required
- **İşçilik HAS:** Readonly, Auto-calculated
- **Toplam Maliyet:** Readonly, Auto-calculated

#### Satış
- **Kar Marjı %:** Number, Editable, Required
- **Satış HAS Değeri:** Readonly, Auto-calculated

#### Stok Durumu
- **Create:** Always IN_STOCK, Readonly

### Product Edit Screen

#### Editability Matrix

| Field | IN_STOCK | SOLD |
|-------|----------|------|
| product_type_id | ❌ | ❌ |
| name | ✅ | ✅ |
| barcode | ❌ | ❌ |
| karat_id | ✅ | ❌ |
| weight_gram | ✅ | ❌ |
| labor_type_id | ✅ | ❌ |
| labor_has_value | ✅ | ❌ |
| alis_has_degeri | ✅ | ❌ |
| profit_rate_percent | ✅ | ❌ |
| notes | ✅ | ✅ |
| images | ✅ | ✅ |
| stock_status_id | ✅ | ❌ |
| material_has_cost | ❌ | ❌ |
| labor_has_cost | ❌ | ❌ |
| total_cost_has | ❌ | ❌ |
| sale_has_value | ❌ | ❌ |

#### Auto-Calc Behavior
- **Create:** Real-time calculation on every input change
- **Edit (IN_STOCK):** Real-time calculation on every input change
- **Edit (SOLD):** All cost fields frozen

## 5. AUTO-CALCULATION TRIGGERS

```javascript
// Trigger recalculation when ANY of these change:
- product_type_id (changes is_gold_based)
- karat_id (changes fineness)
- weight_gram
- labor_type_id
- labor_has_value
- alis_has_degeri
- profit_rate_percent
```

## 6. VALIDATION RULES

### Field Validation

| Field | Min | Max | Decimal | Required |
|-------|-----|-----|---------|----------|
| name | 1 char | 200 char | - | ✅ |
| weight_gram | 0.001 | 10000 | 3 | if gold |
| labor_has_value | 0.001 | 10000 | 6 | if has labor |
| alis_has_degeri | 0.001 | 100000 | 6 | if not gold |
| profit_rate_percent | 0 | 500 | 2 | ✅ |

### Business Validation

```javascript
// Gold product
if (is_gold_based && (!karat_id || !weight_gram)) {
  ERROR: "Altın ürünler için ayar ve gram ağırlık zorunludur"
}

// Non-gold product
if (!is_gold_based && !alis_has_degeri) {
  ERROR: "Altın olmayan ürünler için alış HAS değeri zorunludur"
}

// Labor
if (labor_type_id && !labor_has_value) {
  ERROR: "İşçilik değeri zorunludur"
}

// PER_GRAM restriction
if (labor_type_id === 1 && !is_gold_based) {
  ERROR: "Altın olmayan ürünlerde gram başı işçilik kullanılamaz"
}

// SOLD restriction
if (stock_status_id === 2) {
  if (editing cost/labor/profit fields) {
    ERROR: "Satılan ürünün maliyeti değiştirilemez"
  }
}

// Stock status transition
if (current_status === 2 && new_status !== 2) {
  ERROR: "Satılan ürün stok durumu değiştirilemez"
}
```

## 7. STOCK STATUS TRANSITIONS

```javascript
Allowed:
IN_STOCK (1) → RESERVED (3) ✅
IN_STOCK (1) → SOLD (2) ✅
RESERVED (3) → IN_STOCK (1) ✅
RESERVED (3) → SOLD (2) ✅

Forbidden:
SOLD (2) → * ❌ (no back from SOLD)
```

## 8. API ENDPOINTS

### Lookup APIs
```
GET /api/lookups/product-types
GET /api/lookups/karats
GET /api/lookups/labor-types
GET /api/lookups/stock-statuses
```

### Product APIs
```
POST   /api/products           (201 Created)
GET    /api/products           (filters: product_type_id, stock_status_id, search)
GET    /api/products/{id}
PUT    /api/products/{id}
DELETE /api/products/{id}      (only if not SOLD)
```

## 9. UI STYLING RULES

### Readonly Fields
```css
background: bg-muted
border: dashed
cursor: not-allowed
icon: 🔒
```

### Auto-Calculated Fields
```css
background: bg-accent/10
border: solid green
cursor: default
icon: ⚡
disabled: true
```

### Required Fields
```css
label: * (red asterisk)
border: red on error
error message below field
```

## 10. FORBIDDEN ACTIONS

❌ Transaction entegrasyon
❌ Party bağlantısı
❌ Kasa/Banka entegrasyon
❌ TL/USD/EUR gösterimi
❌ Manuel balance girişi
❌ SOLD ürün maliyet değişikliği
❌ SOLD ürün stok durumu değişikliği
❌ Ürün tipi değişikliği (edit mode)
❌ Barkod değişikliği
❌ Auto-calc alan manuel değişikliği
❌ PER_GRAM için altın olmayan ürün
❌ Hardcoded combo/dropdown
❌ Yeni alan ekleme
❌ Hesaplama mantığı değiştirme

## 11. BACKEND HELPER FUNCTION

```javascript
function calculate_product_costs(product_data, product_type, karat) {
  is_gold_based = product_type.is_gold_based
  
  // Material
  if (is_gold_based) {
    material_has_cost = product_data.weight_gram * karat.fineness
  } else {
    material_has_cost = product_data.alis_has_degeri
  }
  
  // Labor
  labor_has_cost = 0
  if (product_data.labor_type_id) {
    if (product_data.labor_type_id === 1) { // PER_GRAM
      if (!is_gold_based) throw ERROR
      labor_has_cost = product_data.weight_gram * product_data.labor_has_value
    } else if (product_data.labor_type_id === 2) { // PER_PIECE
      labor_has_cost = product_data.labor_has_value
    }
  }
  
  // Totals
  total_cost_has = material_has_cost + labor_has_cost
  sale_has_value = total_cost_has * (1 + product_data.profit_rate_percent / 100)
  
  return {
    material_has_cost: round(material_has_cost, 6),
    labor_has_cost: round(labor_has_cost, 6),
    total_cost_has: round(total_cost_has, 6),
    sale_has_value: round(sale_has_value, 6)
  }
}
```

## 12. BARCODE GENERATION

```javascript
function generate_barcode() {
  today = format(now(), "YYYYMMDD")
  random = uuid().substring(0, 4).toUpperCase()
  return `PRD-${today}-${random}`
}

Example: PRD-20251210-A3F2
```

## 13. IMPLEMENTATION STATUS

✅ Backend Models Created
✅ Lookup Tables Initialized
✅ API Routes Implemented
✅ ProductsPage Created
✅ ProductFormDialog Created
⏳ ProductDetailPage (pending)
⏳ App.js Routes (pending)
⏳ Layout.js Navigation Update (pending)
⏳ Frontend Testing (pending)
⏳ End-to-End Testing (pending)

## 14. NEXT STEPS

1. Create ProductDetailPage.js
2. Update App.js with /products/:id route
3. Update Layout.js (remove "Yakında" from Ürünler)
4. Restart frontend
5. Test create gold product
6. Test create non-gold product
7. Test PER_GRAM restriction
8. Test edit IN_STOCK
9. Test edit SOLD restrictions
10. Testing agent validation
