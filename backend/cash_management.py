# ==================== CASH MANAGEMENT MODULE ====================
# Kasa Yönetimi - Nakit, Banka ve Döviz Kasaları

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

# Unified Ledger imports
from init_unified_ledger import create_ledger_entry, create_void_entry

logger = logging.getLogger(__name__)

# Router
cash_router = APIRouter(prefix="/api", tags=["Cash Management"])

# ==================== MODELS ====================

class CashRegisterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    type: str = Field(..., pattern="^(CASH|BANK)$")  # CASH veya BANK
    currency: str = Field(..., pattern="^(TRY|USD|EUR)$")  # TRY, USD, EUR
    is_active: bool = True

class CashRegisterUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class CashMovementCreate(BaseModel):
    cash_register_id: str
    type: str = Field(..., pattern="^(IN|OUT)$")  # IN (giriş) veya OUT (çıkış)
    amount: float = Field(..., gt=0)
    description: Optional[str] = None
    reference_type: str = Field(default="MANUAL")  # SALE, PURCHASE, RECEIPT, PAYMENT, TRANSFER, OPENING, MANUAL, EXPENSE
    reference_id: Optional[str] = None
    transaction_date: Optional[str] = None  # YYYY-MM-DD format, default today

class OpeningBalanceItem(BaseModel):
    cash_register_id: str
    amount: float = Field(..., ge=0)

class OpeningBalanceCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    balances: List[OpeningBalanceItem]

class TransferCreate(BaseModel):
    from_cash_register_id: str
    to_cash_register_id: str
    amount: float = Field(..., gt=0)
    description: Optional[str] = None

# ==================== DATABASE REFERENCE ====================
# Will be set from server.py
db = None

def set_database(database):
    global db
    db = database

# ==================== HELPER FUNCTIONS ====================

async def get_current_user_from_request(request):
    """Get current user from request state (set by dependency)"""
    return getattr(request.state, 'user', None)

async def update_cash_register_balance(cash_register_id: str, amount_change: float):
    """Update cash register balance after a movement"""
    result = await db.cash_registers.update_one(
        {"id": cash_register_id},
        {"$inc": {"current_balance": amount_change}}
    )
    return result.modified_count > 0

async def get_cash_register_balance(cash_register_id: str) -> float:
    """Get current balance of a cash register"""
    register = await db.cash_registers.find_one({"id": cash_register_id}, {"current_balance": 1})
    return register.get("current_balance", 0) if register else 0

async def create_cash_movement_internal(
    cash_register_id: str,
    movement_type: str,  # IN or OUT
    amount: float,
    currency: str,
    reference_type: str,
    reference_id: Optional[str] = None,
    description: Optional[str] = None,
    created_by: Optional[str] = None,
    transaction_date: Optional[datetime] = None
) -> dict:
    """Internal function to create cash movement - can be called from other modules"""
    
    # Calculate amount change (positive for IN, negative for OUT)
    amount_change = amount if movement_type == "IN" else -amount
    
    # Update balance first
    await update_cash_register_balance(cash_register_id, amount_change)
    
    # Get new balance
    new_balance = await get_cash_register_balance(cash_register_id)
    
    # Use provided transaction_date or current time
    tx_date = transaction_date or datetime.now(timezone.utc)
    
    # Create movement record
    movement_id = f"CM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    
    movement = {
        "id": movement_id,
        "cash_register_id": cash_register_id,
        "type": movement_type,
        "amount": amount,
        "currency": currency,
        "description": description,
        "reference_type": reference_type,
        "reference_id": reference_id,
        "balance_after": new_balance,
        "transaction_date": tx_date,
        "created_at": datetime.now(timezone.utc),
        "created_by": created_by
    }
    
    await db.cash_movements.insert_one(movement)
    
    return movement

# ==================== SEED DATA ====================

DEFAULT_CASH_REGISTERS = [
    {"code": "TL_CASH", "name": "TL Kasa", "type": "CASH", "currency": "TRY"},
    {"code": "TL_BANK", "name": "TL Banka", "type": "BANK", "currency": "TRY"},
    {"code": "USD_CASH", "name": "USD Kasa", "type": "CASH", "currency": "USD"},
    {"code": "USD_BANK", "name": "USD Banka", "type": "BANK", "currency": "USD"},
    {"code": "EUR_CASH", "name": "EUR Kasa", "type": "CASH", "currency": "EUR"},
    {"code": "EUR_BANK", "name": "EUR Banka", "type": "BANK", "currency": "EUR"},
]

async def init_cash_registers():
    """Initialize default cash registers if they don't exist"""
    existing_count = await db.cash_registers.count_documents({})
    
    if existing_count == 0:
        logger.info("Initializing default cash registers...")
        
        for idx, register_data in enumerate(DEFAULT_CASH_REGISTERS, 1):
            register = {
                "id": f"CASH-{str(idx).zfill(3)}",
                "code": register_data["code"],
                "name": register_data["name"],
                "type": register_data["type"],
                "currency": register_data["currency"],
                "current_balance": 0,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            await db.cash_registers.insert_one(register)
        
        logger.info(f"Created {len(DEFAULT_CASH_REGISTERS)} default cash registers")
    else:
        logger.info(f"Cash registers already exist ({existing_count} found)")

# ==================== CASH REGISTER ENDPOINTS ====================

@cash_router.get("/cash-registers")
async def get_cash_registers(
    type: Optional[str] = None,
    currency: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all cash registers with optional filters"""
    query = {}
    
    if type:
        query["type"] = type
    if currency:
        query["currency"] = currency
    if is_active is not None:
        query["is_active"] = is_active
    
    registers = await db.cash_registers.find(query, {"_id": 0}).sort("code", 1).to_list(100)
    
    # Map current_balance to balance for API consistency
    for register in registers:
        register["balance"] = register.get("current_balance", 0)
    
    return registers

@cash_router.get("/cash-registers/summary")
async def get_cash_registers_summary():
    """Get summary of all cash registers grouped by currency"""
    registers = await db.cash_registers.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    summary = {
        "TRY": {"total": 0, "cash": 0, "bank": 0},
        "USD": {"total": 0, "cash": 0, "bank": 0},
        "EUR": {"total": 0, "cash": 0, "bank": 0}
    }
    
    for register in registers:
        currency = register.get("currency", "TRY")
        balance = register.get("current_balance", 0)
        reg_type = register.get("type", "CASH")
        
        if currency in summary:
            summary[currency]["total"] += balance
            if reg_type == "CASH":
                summary[currency]["cash"] += balance
            else:
                summary[currency]["bank"] += balance
    
    return {
        "summary": summary,
        "registers": registers
    }

@cash_router.get("/cash-registers/{register_id}")
async def get_cash_register(register_id: str):
    """Get a single cash register by ID"""
    register = await db.cash_registers.find_one({"id": register_id}, {"_id": 0})
    
    if not register:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    
    return register

@cash_router.post("/cash-registers", status_code=201)
async def create_cash_register(data: CashRegisterCreate):
    """Create a new cash register"""
    # Check if code already exists
    existing = await db.cash_registers.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Bu kasa kodu zaten mevcut")
    
    # Generate ID
    count = await db.cash_registers.count_documents({})
    register_id = f"CASH-{str(count + 1).zfill(3)}"
    
    register = {
        "id": register_id,
        "code": data.code,
        "name": data.name,
        "type": data.type,
        "currency": data.currency,
        "current_balance": 0,
        "is_active": data.is_active,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.cash_registers.insert_one(register)
    
    # Return without _id
    register.pop("_id", None)
    return register

@cash_router.put("/cash-registers/{register_id}")
async def update_cash_register(register_id: str, data: CashRegisterUpdate):
    """Update a cash register"""
    register = await db.cash_registers.find_one({"id": register_id})
    
    if not register:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    await db.cash_registers.update_one(
        {"id": register_id},
        {"$set": update_data}
    )
    
    updated = await db.cash_registers.find_one({"id": register_id}, {"_id": 0})
    return updated

@cash_router.delete("/cash-registers/{register_id}")
async def delete_cash_register(register_id: str):
    """Delete a cash register (soft delete - set inactive)"""
    register = await db.cash_registers.find_one({"id": register_id})
    
    if not register:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    
    # Check if there are movements
    movement_count = await db.cash_movements.count_documents({"cash_register_id": register_id})
    if movement_count > 0:
        # Soft delete - just set inactive
        await db.cash_registers.update_one(
            {"id": register_id},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
        )
        return {"message": "Kasa pasif yapıldı (hareketi olduğu için silinemez)"}
    else:
        # Hard delete
        await db.cash_registers.delete_one({"id": register_id})
        return {"message": "Kasa silindi"}

# ==================== CASH MOVEMENT ENDPOINTS ====================

@cash_router.get("/cash-movements")
async def get_cash_movements(
    cash_register_id: Optional[str] = None,
    type: Optional[str] = None,
    reference_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    per_page: int = 20
):
    """Get cash movements with filters and pagination"""
    query = {}
    
    if cash_register_id:
        query["cash_register_id"] = cash_register_id
    if type:
        query["type"] = type
    if reference_type:
        query["reference_type"] = reference_type
    
    # Date filters
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query["created_at"] = {"$gte": start_dt}
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            if "created_at" in query:
                query["created_at"]["$lte"] = end_dt
            else:
                query["created_at"] = {"$lte": end_dt}
        except ValueError:
            pass
    
    # Get total count
    total_count = await db.cash_movements.count_documents(query)
    total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 1
    
    # Get movements with pagination - EN SON YAPILAN EN ÜSTTE
    # transaction_date DESC + created_at DESC + id DESC
    skip = (page - 1) * per_page
    movements = await db.cash_movements.find(query, {"_id": 0}).sort([
        ("transaction_date", -1),
        ("created_at", -1),
        ("id", -1)
    ]).skip(skip).limit(per_page).to_list(per_page)
    
    # Enrich with cash register info
    for movement in movements:
        register = await db.cash_registers.find_one(
            {"id": movement.get("cash_register_id")}, 
            {"_id": 0, "name": 1, "code": 1, "currency": 1}
        )
        movement["cash_register"] = register
    
    return {
        "movements": movements,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "total_records": total_count
        }
    }

@cash_router.post("/cash-movements", status_code=201)
async def create_cash_movement(data: CashMovementCreate):
    """Create a manual cash movement"""
    # Verify cash register exists and is active
    register = await db.cash_registers.find_one({"id": data.cash_register_id, "is_active": True})
    
    if not register:
        raise HTTPException(status_code=404, detail="Aktif kasa bulunamadı")
    
    # Parse transaction_date if provided
    tx_date = None
    if data.transaction_date:
        try:
            tx_date = datetime.strptime(data.transaction_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Geçersiz tarih formatı. YYYY-MM-DD kullanın.")
    
    # Create movement
    movement = await create_cash_movement_internal(
        cash_register_id=data.cash_register_id,
        movement_type=data.type,
        amount=data.amount,
        currency=register.get("currency", "TRY"),
        reference_type=data.reference_type,
        reference_id=data.reference_id,
        description=data.description,
        transaction_date=tx_date
    )
    
    # ==================== UNIFIED LEDGER KAYDI (MANUAL_CASH) ====================
    # Sadece MANUAL tipi hareketler için ledger kaydı oluştur
    if data.reference_type == "MANUAL":
        try:
            currency = register.get("currency", "TRY")
            await create_ledger_entry(
                entry_type="MANUAL_CASH",
                transaction_date=tx_date or datetime.now(timezone.utc),
                
                has_in=0,
                has_out=0,
                
                currency=currency,
                amount_in=data.amount if data.type == "IN" else 0,
                amount_out=data.amount if data.type == "OUT" else 0,
                
                cash_register_id=data.cash_register_id,
                cash_register_name=register.get("name"),
                
                reference_type="cash_movements",
                reference_id=movement.get("id"),
                
                description=f"Manuel kasa: {data.description or ''} ({data.amount:.2f} {currency} {'GİRİŞ' if data.type == 'IN' else 'ÇIKIŞ'})",
                created_by=None
            )
            logger.info(f"Manual cash ledger entry created: {movement.get('id')}")
        except Exception as e:
            logger.error(f"Failed to create manual cash ledger entry: {e}")
    
    # Remove _id if present
    movement.pop("_id", None)
    
    return movement

@cash_router.post("/cash-movements/opening", status_code=201)
async def create_opening_balance(data: OpeningBalanceCreate):
    """Create opening balance entries for multiple cash registers"""
    results = []
    
    for balance_item in data.balances:
        if balance_item.amount <= 0:
            continue
        
        # Verify cash register exists
        register = await db.cash_registers.find_one({"id": balance_item.cash_register_id})
        
        if not register:
            results.append({
                "cash_register_id": balance_item.cash_register_id,
                "success": False,
                "error": "Kasa bulunamadı"
            })
            continue
        
        # Check if opening balance already exists for this register
        existing_opening = await db.cash_movements.find_one({
            "cash_register_id": balance_item.cash_register_id,
            "reference_type": "OPENING"
        })
        
        if existing_opening:
            results.append({
                "cash_register_id": balance_item.cash_register_id,
                "cash_register_name": register.get("name"),
                "success": False,
                "error": "Bu kasa için açılış bakiyesi zaten girilmiş"
            })
            continue
        
        # Create opening balance movement
        movement = await create_cash_movement_internal(
            cash_register_id=balance_item.cash_register_id,
            movement_type="IN",
            amount=balance_item.amount,
            currency=register.get("currency", "TRY"),
            reference_type="OPENING",
            description=f"Açılış bakiyesi - {data.date}"
        )
        
        # ==================== UNIFIED LEDGER KAYDI (OPENING_BALANCE) ====================
        try:
            await create_ledger_entry(
                entry_type="OPENING_BALANCE",
                transaction_date=datetime.now(timezone.utc),
                
                has_in=0,
                has_out=0,
                
                currency=register.get("currency", "TRY"),
                amount_in=balance_item.amount,
                amount_out=0,
                
                cash_register_id=balance_item.cash_register_id,
                cash_register_name=register.get("name"),
                
                reference_type="cash_movements",
                reference_id=movement.get("id"),
                
                description=f"Açılış bakiyesi: {register.get('name')} ({balance_item.amount:.2f} {register.get('currency', 'TRY')})",
                created_by=None
            )
            logger.info(f"Opening balance ledger entry created: {movement.get('id')}")
        except Exception as e:
            logger.error(f"Failed to create opening balance ledger entry: {e}")
        
        results.append({
            "cash_register_id": balance_item.cash_register_id,
            "cash_register_name": register.get("name"),
            "success": True,
            "amount": balance_item.amount,
            "movement_id": movement.get("id")
        })
    
    return {
        "date": data.date,
        "results": results,
        "success_count": sum(1 for r in results if r.get("success")),
        "error_count": sum(1 for r in results if not r.get("success"))
    }

@cash_router.post("/cash-movements/transfer", status_code=201)
async def create_transfer(data: TransferCreate):
    """Transfer money between cash registers"""
    # Verify both cash registers exist and are active
    from_register = await db.cash_registers.find_one({"id": data.from_cash_register_id, "is_active": True})
    to_register = await db.cash_registers.find_one({"id": data.to_cash_register_id, "is_active": True})
    
    if not from_register:
        raise HTTPException(status_code=404, detail="Çıkış kasası bulunamadı")
    if not to_register:
        raise HTTPException(status_code=404, detail="Giriş kasası bulunamadı")
    
    # Check same currency
    if from_register.get("currency") != to_register.get("currency"):
        raise HTTPException(status_code=400, detail="Farklı para birimli kasalar arasında transfer yapılamaz")
    
    # Check sufficient balance
    if from_register.get("current_balance", 0) < data.amount:
        raise HTTPException(status_code=400, detail="Çıkış kasasında yeterli bakiye yok")
    
    # Check not same register
    if data.from_cash_register_id == data.to_cash_register_id:
        raise HTTPException(status_code=400, detail="Aynı kasaya transfer yapılamaz")
    
    currency = from_register.get("currency", "TRY")
    transfer_id = f"TRF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    
    description = data.description or f"Transfer: {from_register.get('name')} → {to_register.get('name')}"
    
    # Create OUT movement from source
    out_movement = await create_cash_movement_internal(
        cash_register_id=data.from_cash_register_id,
        movement_type="OUT",
        amount=data.amount,
        currency=currency,
        reference_type="TRANSFER",
        reference_id=transfer_id,
        description=description
    )
    
    # Create IN movement to destination
    in_movement = await create_cash_movement_internal(
        cash_register_id=data.to_cash_register_id,
        movement_type="IN",
        amount=data.amount,
        currency=currency,
        reference_type="TRANSFER",
        reference_id=transfer_id,
        description=description
    )
    
    # ==================== UNIFIED LEDGER KAYDI (CASH_TRANSFER) ====================
    try:
        await create_ledger_entry(
            entry_type="CASH_TRANSFER",
            transaction_date=datetime.now(timezone.utc),
            
            has_in=0,
            has_out=0,
            
            currency=currency,
            amount_in=data.amount,  # Hedef kasaya giriş
            amount_out=data.amount,  # Kaynak kasadan çıkış
            
            cash_register_id=data.from_cash_register_id,
            cash_register_name=f"{from_register.get('name')} → {to_register.get('name')}",
            
            reference_type="cash_transfers",
            reference_id=transfer_id,
            
            description=f"Kasa transferi: {from_register.get('name')} → {to_register.get('name')} ({data.amount:.2f} {currency})",
            created_by=None
        )
        logger.info(f"Cash transfer ledger entry created: {transfer_id}")
    except Exception as e:
        logger.error(f"Failed to create cash transfer ledger entry: {e}")
    
    return {
        "transfer_id": transfer_id,
        "from_register": {
            "id": from_register.get("id"),
            "name": from_register.get("name"),
            "new_balance": out_movement.get("balance_after")
        },
        "to_register": {
            "id": to_register.get("id"),
            "name": to_register.get("name"),
            "new_balance": in_movement.get("balance_after")
        },
        "amount": data.amount,
        "currency": currency,
        "description": description
    }

# ==================== KASA DETAY HAREKETLERI ====================

@cash_router.get("/cash-registers/{register_id}/movements")
async def get_register_movements(
    register_id: str,
    page: int = 1,
    per_page: int = 20
):
    """Get movements for a specific cash register"""
    register = await db.cash_registers.find_one({"id": register_id}, {"_id": 0})
    
    if not register:
        raise HTTPException(status_code=404, detail="Kasa bulunamadı")
    
    # Get movements
    query = {"cash_register_id": register_id}
    total_count = await db.cash_movements.count_documents(query)
    total_pages = (total_count + per_page - 1) // per_page
    
    skip = (page - 1) * per_page
    movements = await db.cash_movements.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    
    return {
        "register": register,
        "movements": movements,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "total_records": total_count
        }
    }

# ==================== KASA HAREKETİ SİLME ====================

@cash_router.delete("/cash-movements/{movement_id}")
async def delete_cash_movement(movement_id: str):
    """Kasa hareketi sil (sadece manuel hareketler silinebilir)"""
    
    movement = await db.cash_movements.find_one({"id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Kasa hareketi bulunamadı")
    
    # Otomatik oluşturulan hareketler silinemez
    protected_types = ["SALE", "PURCHASE", "PAYMENT", "RECEIPT", "EXCHANGE"]
    if movement.get("reference_type") in protected_types:
        raise HTTPException(status_code=400, detail="İşleme bağlı kasa hareketleri silinemez. Önce ilgili işlemi iptal edin.")
    
    # ==================== UNIFIED LEDGER VOID ====================
    try:
        movement_type = movement.get("type", "IN")
        amount = movement.get("amount", 0)
        currency = movement.get("currency", "TRY")
        
        await create_void_entry(
            original_reference_type="cash_movements",
            original_reference_id=movement_id,
            void_reason=f"Kasa hareketi silindi: {movement.get('description', '')}",
            created_by=None,
            # Tersine çevir
            fallback_amount_in=amount if movement_type == "OUT" else 0,
            fallback_amount_out=amount if movement_type == "IN" else 0,
            fallback_currency=currency,
            fallback_cash_register_id=movement.get("cash_register_id")
        )
        logger.info(f"Cash movement VOID created: {movement_id}")
    except Exception as e:
        logger.error(f"Cash movement VOID failed: {e}")
    
    # Kasa bakiyesini güncelle (hareketi geri al)
    amount_change = -movement.get("amount", 0) if movement.get("type") == "IN" else movement.get("amount", 0)
    await update_cash_register_balance(movement.get("cash_register_id"), amount_change)
    
    # Hareketi sil
    await db.cash_movements.delete_one({"id": movement_id})
    
    return {"success": True, "message": "Kasa hareketi silindi"}
