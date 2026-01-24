"""
Unified Ledger - Merkezi Muhasebe Defteri
Tüm finansal hareketlerin tek noktada toplandığı tablo

HAS İşaret Kuralları:
- has_in: HAS girişi (pozitif) - Alış, hurda alım
- has_out: HAS çıkışı (pozitif) - Satış
- has_net = has_in - has_out

Para İşaret Kuralları:
- amount_in: Para girişi (pozitif) - Satış, tahsilat
- amount_out: Para çıkışı (pozitif) - Alış, ödeme, gider
- amount_net = amount_in - amount_out
"""

from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger("unified_ledger")

# Database reference
db = None

def set_database(database):
    """Set the database reference for unified ledger"""
    global db
    db = database
    logger.info("Unified ledger database reference set")

# Ledger entry tipleri
LEDGER_TYPES = [
    # Financial Transactions
    "SALE",              # Satış
    "PURCHASE",          # Alış
    "PAYMENT",           # Tedarikçiye ödeme
    "RECEIPT",           # Müşteriden tahsilat
    "EXCHANGE",          # Döviz değişim
    
    # Expenses
    "EXPENSE",           # Gider
    
    # Employee
    "SALARY_ACCRUAL",    # Maaş tahakkuku
    "SALARY_PAYMENT",    # Maaş ödemesi
    "EMPLOYEE_DEBT",     # Personele borç verme (avans)
    "EMPLOYEE_DEBT_PAYMENT",  # Personelden tahsilat
    
    # Partner/Capital
    "CAPITAL_IN",        # Sermaye girişi
    "CAPITAL_OUT",       # Sermaye çıkışı
    
    # Cash
    "CASH_TRANSFER",     # Kasalar arası transfer
    "OPENING_BALANCE",   # Açılış bakiyesi
    "MANUAL_CASH",       # Manuel kasa hareketi
    
    # Alış Kar/Zarar
    "PURCHASE_PROFIT",   # Alıştan kar (eksik ödeme, bakiye sıfırlandı)
    "PURCHASE_LOSS",     # Alıştan zarar (fazla ödeme, bakiye sıfırlandı)
    "PURCHASE_PROFIT_LOSS",  # Eski tip (geriye dönük uyumluluk)
    
    # Satış Kar/Zarar
    "SALE_PROFIT",       # Satıştan kar
    "SALE_LOSS",         # Satıştan zarar
    
    # Düzeltme ve İptal
    "ADJUSTMENT",        # Düzeltme kaydı (edit farkı)
    "VOID",              # İptal kaydı (silme tersi)
]

def generate_ledger_id():
    """Generate unique ledger entry ID"""
    date_str = datetime.now().strftime("%Y%m%d")
    unique = uuid.uuid4().hex[:6].upper()
    return f"LED-{date_str}-{unique}"

async def create_ledger_entry(
    entry_type: str,
    transaction_date: datetime,
    
    # HAS değerleri
    has_in: float = 0.0,
    has_out: float = 0.0,
    
    # Para birimi değerleri
    currency: str = "TRY",
    amount_in: float = 0.0,
    amount_out: float = 0.0,
    exchange_rate: float = None,
    
    # Kar/Zarar (SALE ve EXCHANGE için)
    cost_has: float = None,
    cost_tl: float = None,       # Maliyet TL
    profit_has: float = None,
    profit_tl: float = None,     # Kar/Zarar TL
    discount_has: float = None,
    commission_has: float = None,
    
    # İlişkili taraflar
    party_id: str = None,
    party_name: str = None,
    party_type: str = None,  # CUSTOMER, SUPPLIER, EMPLOYEE, PARTNER
    
    # Kasa bilgisi
    cash_register_id: str = None,
    cash_register_name: str = None,
    
    # Ürün bilgisi (varsa)
    product_id: str = None,
    product_name: str = None,
    product_type_id: int = None,
    weight_gram: float = None,
    
    # Kategori (giderler için)
    category_id: str = None,
    category_name: str = None,
    
    # Referans (orijinal kayda bağlantı)
    reference_type: str = None,  # financial_transactions, expenses, salary_movements, etc.
    reference_id: str = None,
    
    # Açıklama
    description: str = None,
    notes: str = None,
    
    # Kullanıcı
    created_by: str = None
) -> dict:
    """
    Unified Ledger'a yeni kayıt ekle
    """
    
    if db is None:
        logger.error("Database not set for unified_ledger")
        return None
    
    now = datetime.now(timezone.utc)
    
    # Transaction date'i ISO format string'e çevir
    tx_date_str = None
    if transaction_date:
        if isinstance(transaction_date, datetime):
            tx_date_str = transaction_date.isoformat()
        elif isinstance(transaction_date, str):
            tx_date_str = transaction_date
    
    ledger_entry = {
        "id": generate_ledger_id(),
        "type": entry_type,
        "transaction_date": tx_date_str,
        "created_at": now.isoformat(),
        "created_by": created_by,
        
        # HAS değerleri
        "has_in": round(has_in or 0, 6),
        "has_out": round(has_out or 0, 6),
        "has_net": round((has_in or 0) - (has_out or 0), 6),
        
        # Para birimi
        "currency": currency,
        "amount_in": round(amount_in or 0, 2),
        "amount_out": round(amount_out or 0, 2),
        "amount_net": round((amount_in or 0) - (amount_out or 0), 2),
        "exchange_rate": exchange_rate,
        
        # Kar/Zarar
        "cost_has": round(cost_has, 6) if cost_has is not None else None,
        "cost_tl": round(cost_tl, 2) if cost_tl is not None else None,
        "profit_has": round(profit_has, 6) if profit_has is not None else None,
        "profit_tl": round(profit_tl, 2) if profit_tl is not None else None,
        "discount_has": round(discount_has, 6) if discount_has is not None else None,
        "commission_has": round(commission_has, 6) if commission_has is not None else None,
        
        # Taraflar
        "party_id": party_id,
        "party_name": party_name,
        "party_type": party_type,
        
        # Kasa
        "cash_register_id": cash_register_id,
        "cash_register_name": cash_register_name,
        
        # Ürün
        "product_id": product_id,
        "product_name": product_name,
        "product_type_id": product_type_id,
        "weight_gram": round(weight_gram, 4) if weight_gram else None,
        
        # Kategori
        "category_id": category_id,
        "category_name": category_name,
        
        # Referans
        "reference_type": reference_type,
        "reference_id": reference_id,
        
        # Açıklama
        "description": description,
        "notes": notes
    }
    
    await db.unified_ledger.insert_one(ledger_entry)
    logger.info(f"Ledger entry created: {ledger_entry['id']} - {entry_type} - party: {party_name}")
    
    # Return without _id
    ledger_entry.pop("_id", None)
    return ledger_entry

async def init_unified_ledger_indexes():
    """Create indexes for unified_ledger collection"""
    if db is None:
        logger.warning("Database not set, skipping index creation")
        return
    
    try:
        # Ana indexler
        await db.unified_ledger.create_index("id", unique=True)
        await db.unified_ledger.create_index("type")
        await db.unified_ledger.create_index("transaction_date")
        await db.unified_ledger.create_index("party_id")
        await db.unified_ledger.create_index("party_type")
        await db.unified_ledger.create_index("cash_register_id")
        await db.unified_ledger.create_index("category_id")
        await db.unified_ledger.create_index("reference_id")
        await db.unified_ledger.create_index("created_at")
        
        # Composite indexler (sık kullanılan sorgular için)
        await db.unified_ledger.create_index([("transaction_date", -1), ("type", 1)])
        await db.unified_ledger.create_index([("party_id", 1), ("transaction_date", -1)])
        await db.unified_ledger.create_index([("type", 1), ("transaction_date", -1)])
        
        logger.info("✅ Unified ledger indexes created")
    except Exception as e:
        logger.error(f"Failed to create unified ledger indexes: {e}")



# ==================== ADJUSTMENT & VOID HELPER FUNCTIONS ====================

async def find_ledger_entry_by_reference(reference_type: str, reference_id: str, exclude_adjustments: bool = True):
    """Referans bilgisine göre orijinal ledger kaydını bul"""
    if db is None:
        return None
    query = {"reference_type": reference_type, "reference_id": reference_id}
    if exclude_adjustments:
        query["is_adjustment"] = {"$ne": True}
    return await db.unified_ledger.find_one(query, {"_id": 0})


async def create_adjustment_entry(
    original_reference_type: str,
    original_reference_id: str,
    adjustment_reason: str,
    has_in_diff: float = 0.0,
    has_out_diff: float = 0.0,
    amount_in_diff: float = 0.0,
    amount_out_diff: float = 0.0,
    currency: str = "TRY",
    created_by: str = None
) -> dict:
    """ADJUSTMENT kaydı oluştur - Edit işlemlerinde FARKI yazar"""
    if db is None:
        return None
    
    original = await find_ledger_entry_by_reference(original_reference_type, original_reference_id)
    now = datetime.now(timezone.utc)
    
    entry = {
        "id": generate_ledger_id(),
        "type": "ADJUSTMENT",
        "transaction_date": now.isoformat(),
        "created_at": now.isoformat(),
        "created_by": created_by,
        "has_in": round(has_in_diff, 6),
        "has_out": round(has_out_diff, 6),
        "has_net": round(has_in_diff - has_out_diff, 6),
        "currency": currency,
        "amount_in": round(amount_in_diff, 2),
        "amount_out": round(amount_out_diff, 2),
        "amount_net": round(amount_in_diff - amount_out_diff, 2),
        "party_id": original.get("party_id") if original else None,
        "party_name": original.get("party_name") if original else None,
        "party_type": original.get("party_type") if original else None,
        "product_id": original.get("product_id") if original else None,
        "product_name": original.get("product_name") if original else None,
        "category_id": original.get("category_id") if original else None,
        "reference_type": original_reference_type,
        "reference_id": original_reference_id,
        "is_adjustment": True,
        "adjusts_entry_id": original.get("id") if original else None,
        "adjustment_reason": adjustment_reason,
        "description": f"DÜZELTME: {adjustment_reason}"
    }
    
    await db.unified_ledger.insert_one(entry)
    logger.info(f"ADJUSTMENT created: {entry['id']}")
    entry.pop("_id", None)
    return entry


async def create_void_entry(
    original_reference_type: str,
    original_reference_id: str,
    void_reason: str,
    created_by: str = None,
    # Orijinal ledger kaydı bulunamazsa bu değerler kullanılır
    fallback_has_in: float = 0.0,
    fallback_has_out: float = 0.0,
    fallback_amount_in: float = 0.0,
    fallback_amount_out: float = 0.0,
    fallback_currency: str = "TRY",
    fallback_party_id: str = None,
    fallback_party_name: str = None,
    fallback_party_type: str = None,
    fallback_product_id: str = None,
    fallback_product_name: str = None,
    fallback_category_id: str = None,
    fallback_cash_register_id: str = None
) -> dict:
    """VOID kaydı oluştur - Delete işlemlerinde orijinalin TERSİNİ yazar"""
    if db is None:
        return None
    
    original = await find_ledger_entry_by_reference(original_reference_type, original_reference_id)
    
    # Orijinal kayıt bulunamazsa fallback değerleri kullan
    if original:
        has_in_val = original.get("has_out", 0)
        has_out_val = original.get("has_in", 0)
        amount_in_val = original.get("amount_out", 0)
        amount_out_val = original.get("amount_in", 0)
        currency_val = original.get("currency", "TRY")
        party_id_val = original.get("party_id")
        party_name_val = original.get("party_name")
        party_type_val = original.get("party_type")
        product_id_val = original.get("product_id")
        product_name_val = original.get("product_name")
        category_id_val = original.get("category_id")
        cash_register_id_val = original.get("cash_register_id")
        profit_has_val = -original.get("profit_has", 0) if original.get("profit_has") else None
        adjusts_entry_id = original.get("id")
    else:
        # Fallback: orijinal kaydı tersine çevir (has_in <-> has_out)
        has_in_val = fallback_has_out  # Çıkış -> Giriş olarak ters yaz
        has_out_val = fallback_has_in  # Giriş -> Çıkış olarak ters yaz
        amount_in_val = fallback_amount_out
        amount_out_val = fallback_amount_in
        currency_val = fallback_currency
        party_id_val = fallback_party_id
        party_name_val = fallback_party_name
        party_type_val = fallback_party_type
        product_id_val = fallback_product_id
        product_name_val = fallback_product_name
        category_id_val = fallback_category_id
        cash_register_id_val = fallback_cash_register_id
        profit_has_val = None
        adjusts_entry_id = None
        logger.info(f"Original not found for VOID, using fallback values: {original_reference_id}")
    
    now = datetime.now(timezone.utc)
    
    entry = {
        "id": generate_ledger_id(),
        "type": "VOID",
        "transaction_date": now.isoformat(),
        "created_at": now.isoformat(),
        "created_by": created_by,
        "has_in": round(has_in_val, 6),
        "has_out": round(has_out_val, 6),
        "has_net": round(has_in_val - has_out_val, 6),
        "currency": currency_val,
        "amount_in": round(amount_in_val, 2),
        "amount_out": round(amount_out_val, 2),
        "amount_net": round(amount_in_val - amount_out_val, 2),
        "profit_has": profit_has_val,
        "party_id": party_id_val,
        "party_name": party_name_val,
        "party_type": party_type_val,
        "product_id": product_id_val,
        "product_name": product_name_val,
        "category_id": category_id_val,
        "cash_register_id": cash_register_id_val,
        "reference_type": original_reference_type,
        "reference_id": original_reference_id,
        "is_adjustment": True,
        "adjusts_entry_id": adjusts_entry_id,
        "adjustment_reason": void_reason,
        "description": f"İPTAL: {void_reason}"
    }
    
    await db.unified_ledger.insert_one(entry)
    logger.info(f"VOID created: {entry['id']}")
    entry.pop("_id", None)
    return entry
