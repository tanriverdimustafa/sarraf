"""
Financial Transactions V2 - Helper Functions
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid
from bson import ObjectId

def round_has(value: float) -> float:
    """HAS değerlerini 6 ondalığa yuvarla"""
    return round(value, 6)

def round_currency(value: float) -> float:
    """Para değerlerini 2 ondalığa yuvarla"""
    return round(value, 2)

def generate_transaction_code(transaction_date: datetime) -> str:
    """
    Transaction code oluştur: TRX-YYYYMMDD-XXXX
    """
    date_str = transaction_date.strftime("%Y%m%d")
    random_suffix = str(uuid.uuid4())[:4].upper()
    return f"TRX-{date_str}-{random_suffix}"

async def get_or_create_price_snapshot(db, transaction_date: datetime) -> dict:
    """
    Transaction tarihine uygun price snapshot bul veya oluştur
    
    Mantık:
    1. as_of <= transaction_date olan en yakın snapshot'ı ara
    2. Bulamazsan:
       - Son snapshot'ı al
       - as_of=transaction_date ile yeni BACKFILL snapshot oluştur
    """
    
    # Snapshot ara
    snapshot = await db.price_snapshots.find_one(
        {"as_of": {"$lte": transaction_date}},
        sort=[("as_of", -1)]
    )
    
    if snapshot:
        return snapshot
    
    # Snapshot yok, son snapshot'tan backfill oluştur
    latest_snapshot = await db.price_snapshots.find_one(
        {},
        sort=[("as_of", -1)]
    )
    
    if not latest_snapshot:
        raise ValueError("No price snapshot available. Please initialize price snapshots or run Harem socket service.")
    
    # Backfill snapshot oluştur
    backfill = {
        "as_of": transaction_date,
        "source": "BACKFILL",
        "has_buy_tl": latest_snapshot["has_buy_tl"],
        "has_sell_tl": latest_snapshot["has_sell_tl"],
        "usd_buy_tl": latest_snapshot.get("usd_buy_tl"),
        "usd_sell_tl": latest_snapshot.get("usd_sell_tl"),
        "eur_buy_tl": latest_snapshot.get("eur_buy_tl"),
        "eur_sell_tl": latest_snapshot.get("eur_sell_tl"),
        "raw_payload": None,
        "created_at": datetime.now(timezone.utc),
        "created_by": "system"
    }
    
    result = await db.price_snapshots.insert_one(backfill)
    backfill["_id"] = result.inserted_id
    
    return backfill

def calculate_material_has(
    line_data: dict,
    is_gold_based: bool,
    karat: Optional[dict] = None
) -> float:
    """
    Materyal HAS hesapla
    
    Altın ürün: weight_gram * fineness
    Altın olmayan: alis_has_degeri
    """
    
    if is_gold_based:
        if not karat or not line_data.get("weight_gram"):
            raise ValueError("Gold product requires karat and weight_gram")
        
        weight = float(line_data["weight_gram"])
        fineness = float(karat["fineness"])
        return round_has(weight * fineness)
    else:
        # Altın olmayan ürün
        alis_has = line_data.get("alis_has_degeri")
        if alis_has is None:
            raise ValueError("Non-gold product requires alis_has_degeri")
        return round_has(float(alis_has))

def calculate_labor_has(
    line_data: dict,
    is_gold_based: bool
) -> float:
    """
    İşçilik HAS hesapla
    
    PER_GRAM: weight_gram * labor_has_value (sadece altın için)
    PER_PIECE: labor_has_value
    """
    
    labor_type_code = line_data.get("labor_type_code")
    labor_value = line_data.get("labor_has_value")
    
    if not labor_type_code or labor_value is None:
        return 0.0
    
    if labor_type_code == "PER_GRAM":
        # PER_GRAM sadece altın için
        if not is_gold_based:
            raise ValueError("PER_GRAM labor type can only be used for gold products")
        
        weight = line_data.get("weight_gram")
        if not weight:
            raise ValueError("PER_GRAM requires weight_gram")
        
        return round_has(float(weight) * float(labor_value))
    
    elif labor_type_code == "PER_PIECE":
        return round_has(float(labor_value))
    
    return 0.0

def convert_currency_to_has(
    amount_currency: float,
    currency: str,
    snapshot: dict,
    direction: str = "buy"
) -> float:
    """
    Para birimini HAS'a çevir
    
    direction: "buy" (biz alıyoruz) veya "sell" (biz satıyoruz)
    
    Akış:
    1. TL dışı ise önce TL'ye çevir
    2. TL'yi HAS'a çevir
    """
    
    # TL'ye çevir
    amount_tl = amount_currency
    
    if currency == "USD":
        rate_key = "usd_buy_tl" if direction == "buy" else "usd_sell_tl"
        if rate_key not in snapshot or snapshot[rate_key] is None:
            raise ValueError(f"USD rate not available in snapshot")
        amount_tl = amount_currency * snapshot[rate_key]
    
    elif currency == "EUR":
        rate_key = "eur_buy_tl" if direction == "buy" else "eur_sell_tl"
        if rate_key not in snapshot or snapshot[rate_key] is None:
            raise ValueError(f"EUR rate not available in snapshot")
        amount_tl = amount_currency * snapshot[rate_key]
    
    elif currency != "TRY":
        raise ValueError(f"Unsupported currency: {currency}")
    
    # TL'yi HAS'a çevir
    has_rate_key = "has_buy_tl" if direction == "buy" else "has_sell_tl"
    has_rate = snapshot[has_rate_key]
    
    has_amount = amount_tl / has_rate
    return round_has(has_amount)

def convert_has_to_currency(
    has_amount: float,
    currency: str,
    snapshot: dict,
    direction: str = "sell"
) -> float:
    """
    HAS'ı para birimine çevir
    
    direction: "buy" veya "sell"
    """
    
    # HAS'ı TL'ye çevir
    has_rate_key = "has_buy_tl" if direction == "buy" else "has_sell_tl"
    has_rate = snapshot[has_rate_key]
    amount_tl = has_amount * has_rate
    
    # TL'yi hedef para birimine çevir
    if currency == "TRY":
        return round_currency(amount_tl)
    
    elif currency == "USD":
        rate_key = "usd_sell_tl" if direction == "buy" else "usd_buy_tl"
        if rate_key not in snapshot or snapshot[rate_key] is None:
            raise ValueError(f"USD rate not available in snapshot")
        return round_currency(amount_tl / snapshot[rate_key])
    
    elif currency == "EUR":
        rate_key = "eur_sell_tl" if direction == "buy" else "eur_buy_tl"
        if rate_key not in snapshot or snapshot[rate_key] is None:
            raise ValueError(f"EUR rate not available in snapshot")
        return round_currency(amount_tl / snapshot[rate_key])
    
    else:
        raise ValueError(f"Unsupported currency: {currency}")

async def write_audit_log(
    db,
    entity: str,
    entity_id: Any,
    action: str,
    changed_by: str,
    diff: dict,
    request = None
):
    """Audit log yaz"""
    log_entry = {
        "entity": entity,
        "entity_id": entity_id,
        "action": action,
        "changed_by": changed_by,
        "diff": diff,
        "ip_address": request.client.host if request else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.audit_logs.insert_one(log_entry)

async def get_party_balance(db, party_id: str) -> dict:
    """
    Party bazlı HAS balance getir
    Artık direkt parties.has_balance'dan okuyor (aggregation yerine)
    
    BAKİYE İŞARET KURALLARI:
    - POZİTİF (+): Biz karşı tarafa borçluyuz (tedarikçiden mal aldık, ödeme yapmadık)
    - NEGATİF (-): Karşı taraf bize borçlu (müşteriye sattık, tahsilat almadık)
    - SIFIR (0): Bakiye dengede, borç yok
    """
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    
    if not party:
        return {
            "party_id": party_id,
            "has_balance": 0.0,
            "total_has_balance": 0.0,  # Geriye uyumluluk için
            "party_name": None,
            "party_type_id": None,
            "last_updated": None,
            "balances": []  # Geriye uyumluluk için
        }
    
    has_balance = round(party.get("has_balance", 0.0), 6)
    
    return {
        "party_id": party_id,
        "has_balance": has_balance,
        "total_has_balance": has_balance,  # Geriye uyumluluk için (eski kod bu alanı bekliyor olabilir)
        "party_name": party.get("name"),
        "party_type_id": party.get("party_type_id"),
        "last_updated": party.get("updated_at"),
        "balances": []  # Geriye uyumluluk için
    }
