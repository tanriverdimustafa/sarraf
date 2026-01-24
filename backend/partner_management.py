# ==================== PARTNER / CAPITAL MANAGEMENT MODULE ====================
# Ortak ve Sermaye Yönetimi

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from math import ceil
import uuid
import logging

# Import unified ledger for dual-write
from init_unified_ledger import create_ledger_entry, create_void_entry

logger = logging.getLogger(__name__)

# Router
partner_router = APIRouter(prefix="/api", tags=["Partner Management"])

# Cash movement function reference (set by main app)
create_cash_movement_func = None

def set_cash_movement_func(func):
    global create_cash_movement_func
    create_cash_movement_func = func

# Database reference (set by main app)
db = None

def set_database(database):
    global db
    db = database

# ==================== MODELS ====================

class PartnerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class CapitalMovementCreate(BaseModel):
    partner_id: str
    type: str = Field(..., pattern="^(IN|OUT)$")  # IN = Sermaye Girişi, OUT = Sermaye Çıkışı
    amount: float = Field(..., gt=0)
    currency: str = Field(..., pattern="^(TRY|USD|EUR)$")
    cash_register_id: str
    exchange_rate: Optional[float] = None  # Döviz için kur
    description: Optional[str] = None
    movement_date: str  # YYYY-MM-DD format

# ==================== HELPER FUNCTIONS ====================

def generate_partner_id():
    return f"PARTNER-{str(uuid.uuid4())[:8].upper()}"

def generate_capital_movement_id():
    return f"CAP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

# ==================== PARTNERS API ====================

@partner_router.get("/partners")
async def get_partners(
    page: int = 1,
    per_page: int = 20,
    is_active: Optional[bool] = None
):
    """Get all partners with pagination"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    # Count total
    total = await db.partners.count_documents(query)
    
    # Get partners sorted by created_at DESC (en son eklenen en üstte)
    partners = await db.partners.find(query, {"_id": 0}).sort([
        ("created_at", -1),
        ("id", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "partners": partners,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": ceil(total / per_page) if total > 0 else 1
        }
    }

@partner_router.get("/partners/all")
async def get_all_partners():
    """Get all active partners for dropdown"""
    partners = await db.partners.find({"is_active": True}, {"_id": 0}).sort("name", 1).to_list(1000)
    return partners

@partner_router.get("/partners/{partner_id}")
async def get_partner(partner_id: str):
    """Get single partner"""
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner

@partner_router.post("/partners")
async def create_partner(data: PartnerCreate):
    """Create new partner"""
    partner = {
        "id": generate_partner_id(),
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "notes": data.notes,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.partners.insert_one(partner)
    logger.info(f"Created partner: {partner['id']} - {partner['name']}")
    
    # Return without _id
    partner.pop("_id", None)
    return partner

@partner_router.put("/partners/{partner_id}")
async def update_partner(partner_id: str, data: PartnerUpdate):
    """Update partner"""
    partner = await db.partners.find_one({"id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.email is not None:
        update_data["email"] = data.email
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.partners.update_one({"id": partner_id}, {"$set": update_data})
    
    updated = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return updated

@partner_router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str):
    """Delete partner (soft delete)"""
    partner = await db.partners.find_one({"id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Check if partner has capital movements
    movements_count = await db.capital_movements.count_documents({"partner_id": partner_id})
    if movements_count > 0:
        # Soft delete
        await db.partners.update_one(
            {"id": partner_id}, 
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Partner deactivated (has capital movements)"}
    else:
        # Hard delete
        await db.partners.delete_one({"id": partner_id})
        return {"message": "Partner deleted"}

# ==================== CAPITAL MOVEMENTS API ====================

@partner_router.get("/capital-movements")
async def get_capital_movements(
    page: int = 1,
    per_page: int = 20,
    partner_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None
):
    """Get capital movements with pagination and filters"""
    query = {}
    
    if partner_id:
        query["partner_id"] = partner_id
    
    if type:
        query["type"] = type
    
    if start_date:
        query["movement_date"] = {"$gte": start_date}
    if end_date:
        if "movement_date" in query:
            query["movement_date"]["$lte"] = end_date
        else:
            query["movement_date"] = {"$lte": end_date}
    
    # Count total
    total = await db.capital_movements.count_documents(query)
    
    # Get movements sorted by movement_date DESC, created_at DESC (en son hareket en üstte)
    movements = await db.capital_movements.find(query, {"_id": 0}).sort([
        ("movement_date", -1),
        ("created_at", -1),
        ("id", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "movements": movements,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": ceil(total / per_page) if total > 0 else 1
        }
    }

@partner_router.get("/capital-movements/{movement_id}")
async def get_capital_movement(movement_id: str):
    """Get single capital movement"""
    movement = await db.capital_movements.find_one({"id": movement_id}, {"_id": 0})
    if not movement:
        raise HTTPException(status_code=404, detail="Capital movement not found")
    return movement

@partner_router.post("/capital-movements")
async def create_capital_movement_endpoint(data: CapitalMovementCreate):
    """Create capital movement and update cash register"""
    global create_cash_movement_func
    
    # Validate partner
    partner = await db.partners.find_one({"id": data.partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Validate cash register
    cash_register = await db.cash_registers.find_one({"id": data.cash_register_id})
    if not cash_register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    
    # Calculate TL equivalent for foreign currency
    tl_equivalent = None
    if data.currency in ["USD", "EUR"] and data.exchange_rate:
        tl_equivalent = round(data.amount * data.exchange_rate, 2)
    
    # Create capital movement
    movement = {
        "id": generate_capital_movement_id(),
        "partner_id": data.partner_id,
        "partner_name": partner["name"],
        "type": data.type,
        "amount": data.amount,
        "currency": data.currency,
        "cash_register_id": data.cash_register_id,
        "cash_register_name": cash_register["name"],
        "exchange_rate": data.exchange_rate,
        "tl_equivalent": tl_equivalent,
        "description": data.description,
        "movement_date": data.movement_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.capital_movements.insert_one(movement)
    logger.info(f"Created capital movement: {movement['id']} - {data.type} - {data.amount} {data.currency}")
    
    # Create cash movement
    if create_cash_movement_func:
        try:
            description = f"Sermaye {'girişi' if data.type == 'IN' else 'çıkışı'} - {partner['name']}"
            if data.description:
                description += f" - {data.description}"
            
            await create_cash_movement_func(
                cash_register_id=data.cash_register_id,
                movement_type=data.type,  # IN = kasaya giriş, OUT = kasadan çıkış
                amount=data.amount,
                currency=data.currency,
                reference_type="CAPITAL",
                reference_id=movement["id"],
                description=description
            )
            logger.info(f"Cash movement created for capital movement: {movement['id']}")
        except Exception as e:
            # Rollback capital movement
            await db.capital_movements.delete_one({"id": movement["id"]})
            logger.error(f"Failed to create cash movement: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create cash movement: {str(e)}")
    
    # ==================== UNIFIED LEDGER KAYDI (CAPITAL) ====================
    try:
        entry_type = "CAPITAL_IN" if data.type == "IN" else "CAPITAL_OUT"
        
        await create_ledger_entry(
            entry_type=entry_type,
            transaction_date=datetime.strptime(data.movement_date, '%Y-%m-%d').replace(tzinfo=timezone.utc),
            
            has_in=0.0,
            has_out=0.0,
            
            currency=data.currency,
            amount_in=data.amount if data.type == "IN" else 0.0,
            amount_out=data.amount if data.type == "OUT" else 0.0,
            exchange_rate=data.exchange_rate,
            
            party_id=data.partner_id,
            party_name=partner.get("name"),
            party_type="PARTNER",
            
            cash_register_id=data.cash_register_id,
            cash_register_name=cash_register.get("name") if cash_register else None,
            
            reference_type="capital_movements",
            reference_id=movement["id"],
            
            description=data.description or f"Sermaye {'girişi' if data.type == 'IN' else 'çıkışı'}: {partner.get('name')}",
            created_by=None
        )
        logger.info(f"✅ Unified ledger entry created for {entry_type}: {movement['id']}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for CAPITAL: {e}")
    
    # Return without _id
    movement.pop("_id", None)
    return movement

@partner_router.get("/partners/{partner_id}/summary")
async def get_partner_summary(partner_id: str):
    """Get partner capital summary"""
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    # Aggregate capital movements
    pipeline = [
        {"$match": {"partner_id": partner_id}},
        {"$group": {
            "_id": {"currency": "$currency", "type": "$type"},
            "total": {"$sum": "$amount"}
        }}
    ]
    
    results = await db.capital_movements.aggregate(pipeline).to_list(100)
    
    # Calculate net amounts per currency
    summary = {
        "TRY": {"in": 0, "out": 0, "net": 0},
        "USD": {"in": 0, "out": 0, "net": 0},
        "EUR": {"in": 0, "out": 0, "net": 0}
    }
    
    for r in results:
        currency = r["_id"]["currency"]
        move_type = r["_id"]["type"]
        if currency in summary:
            if move_type == "IN":
                summary[currency]["in"] = r["total"]
            else:
                summary[currency]["out"] = r["total"]
            summary[currency]["net"] = summary[currency]["in"] - summary[currency]["out"]
    
    return {
        "partner": partner,
        "summary": summary
    }


# ==================== SERMAYE HAREKETİ SİLME ====================

@partner_router.delete("/capital-movements/{movement_id}")
async def delete_capital_movement(movement_id: str):
    """Sermaye hareketi sil"""
    
    # Hareketi bul
    movement = await db.capital_movements.find_one({"id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Sermaye hareketi bulunamadı")
    
    # Partner bilgisini al
    partner = await db.partners.find_one({"id": movement.get("partner_id")})
    partner_name = partner.get("name") if partner else "Bilinmiyor"
    
    # ==================== UNIFIED LEDGER VOID ====================
    try:
        movement_type = movement.get("type", "IN")
        amount = movement.get("amount", 0)
        has_amount = movement.get("has_amount", 0)
        currency = movement.get("currency", "TRY")
        
        await create_void_entry(
            original_reference_type="capital_movements",
            original_reference_id=movement_id,
            void_reason=f"Sermaye hareketi silindi: {partner_name} - {movement.get('description', '')}",
            created_by=None,
            # Tersine çevir: IN->OUT, OUT->IN
            fallback_has_in=has_amount if movement_type == "OUT" else 0,
            fallback_has_out=has_amount if movement_type == "IN" else 0,
            fallback_amount_in=amount if movement_type == "OUT" else 0,
            fallback_amount_out=amount if movement_type == "IN" else 0,
            fallback_currency=currency,
            fallback_party_id=movement.get("partner_id"),
            fallback_party_name=partner_name,
            fallback_party_type="PARTNER"
        )
        logger.info(f"Capital movement VOID created: {movement_id}")
    except Exception as e:
        logger.error(f"Capital VOID failed: {e}")
    
    # Hareketi sil
    await db.capital_movements.delete_one({"id": movement_id})
    
    return {"success": True, "message": "Sermaye hareketi silindi"}

