# ==================== ACCRUAL PERIODS MANAGEMENT MODULE ====================
# Tahakkuk Dönemleri Yönetimi

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from math import ceil
import uuid
import calendar
import logging

logger = logging.getLogger(__name__)

# Router
accrual_period_router = APIRouter(prefix="/api", tags=["Accrual Periods"])

# Database reference (set by main app)
db = None

def set_database(database):
    global db
    db = database

# ==================== MODELS ====================

class AccrualPeriodCreate(BaseModel):
    year: int = Field(..., ge=2020, le=2050)
    month: int = Field(..., ge=1, le=12)

class AccrualPeriodUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

# ==================== HELPER FUNCTIONS ====================

def generate_period_id():
    return f"PERIOD-{str(uuid.uuid4())[:8].upper()}"

def get_month_name(month: int) -> str:
    """Get Turkish month name"""
    months = {
        1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan",
        5: "Mayıs", 6: "Haziran", 7: "Temmuz", 8: "Ağustos",
        9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"
    }
    return months.get(month, "")

def generate_period_data(year: int, month: int) -> dict:
    """Generate period data from year and month"""
    month_name = get_month_name(month)
    _, last_day = calendar.monthrange(year, month)
    
    return {
        "code": f"{year}-{month:02d}",
        "name": f"{month_name} {year}",
        "year": year,
        "month": month,
        "start_date": f"{year}-{month:02d}-01",
        "end_date": f"{year}-{month:02d}-{last_day:02d}",
    }

async def init_accrual_periods():
    """Initialize default accrual periods for 2025"""
    count = await db.accrual_periods.count_documents({})
    if count > 0:
        logger.info(f"Accrual periods already exist: {count}")
        return
    
    logger.info("Initializing default accrual periods for 2025...")
    
    periods = []
    for month in range(1, 13):
        period_data = generate_period_data(2025, month)
        period = {
            "id": generate_period_id(),
            **period_data,
            "is_active": True,
            "is_closed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        periods.append(period)
    
    await db.accrual_periods.insert_many(periods)
    logger.info(f"Created {len(periods)} default accrual periods")

# ==================== API ENDPOINTS ====================

@accrual_period_router.get("/accrual-periods")
async def get_accrual_periods(
    page: int = 1,
    per_page: int = 20,
    is_active: Optional[bool] = None,
    is_closed: Optional[bool] = None
):
    """Get all accrual periods with pagination"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    if is_closed is not None:
        query["is_closed"] = is_closed
    
    # Count total
    total = await db.accrual_periods.count_documents(query)
    
    # Get periods sorted by year DESC, month DESC (en yeni en üstte)
    periods = await db.accrual_periods.find(query, {"_id": 0}).sort([
        ("year", -1),
        ("month", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "periods": periods,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": ceil(total / per_page) if total > 0 else 1
        }
    }

@accrual_period_router.get("/accrual-periods/active")
async def get_active_periods():
    """Get all active and non-closed periods for dropdowns"""
    periods = await db.accrual_periods.find(
        {"is_active": True, "is_closed": False}, 
        {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(100)
    return periods

@accrual_period_router.get("/accrual-periods/{period_id}")
async def get_accrual_period(period_id: str):
    """Get single accrual period"""
    period = await db.accrual_periods.find_one({"id": period_id}, {"_id": 0})
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    return period

@accrual_period_router.post("/accrual-periods")
async def create_accrual_period(data: AccrualPeriodCreate):
    """Create new accrual period"""
    
    # Check if period already exists
    code = f"{data.year}-{data.month:02d}"
    existing = await db.accrual_periods.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail=f"Bu dönem zaten mevcut: {code}")
    
    period_data = generate_period_data(data.year, data.month)
    
    period = {
        "id": generate_period_id(),
        **period_data,
        "is_active": True,
        "is_closed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.accrual_periods.insert_one(period)
    logger.info(f"Created accrual period: {period['code']} - {period['name']}")
    
    period.pop("_id", None)
    return period

@accrual_period_router.put("/accrual-periods/{period_id}")
async def update_accrual_period(period_id: str, data: AccrualPeriodUpdate):
    """Update accrual period"""
    period = await db.accrual_periods.find_one({"id": period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.accrual_periods.update_one({"id": period_id}, {"$set": update_data})
    
    updated = await db.accrual_periods.find_one({"id": period_id}, {"_id": 0})
    return updated

@accrual_period_router.delete("/accrual-periods/{period_id}")
async def delete_accrual_period(period_id: str):
    """Delete accrual period"""
    period = await db.accrual_periods.find_one({"id": period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Check if period has salary movements
    movements_count = await db.salary_movements.count_documents({"period": period["code"]})
    if movements_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Bu döneme ait {movements_count} maaş hareketi var, silinemez"
        )
    
    await db.accrual_periods.delete_one({"id": period_id})
    return {"message": "Period deleted"}

@accrual_period_router.post("/accrual-periods/{period_id}/close")
async def close_accrual_period(period_id: str):
    """Close accrual period - no more transactions allowed"""
    period = await db.accrual_periods.find_one({"id": period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    if period.get("is_closed"):
        raise HTTPException(status_code=400, detail="Bu dönem zaten kapalı")
    
    await db.accrual_periods.update_one(
        {"id": period_id}, 
        {"$set": {
            "is_closed": True, 
            "closed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Closed accrual period: {period['code']}")
    
    updated = await db.accrual_periods.find_one({"id": period_id}, {"_id": 0})
    return updated

@accrual_period_router.post("/accrual-periods/{period_id}/reopen")
async def reopen_accrual_period(period_id: str):
    """Reopen a closed accrual period"""
    period = await db.accrual_periods.find_one({"id": period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    if not period.get("is_closed"):
        raise HTTPException(status_code=400, detail="Bu dönem zaten açık")
    
    await db.accrual_periods.update_one(
        {"id": period_id}, 
        {"$set": {"is_closed": False}, "$unset": {"closed_at": ""}}
    )
    
    logger.info(f"Reopened accrual period: {period['code']}")
    
    updated = await db.accrual_periods.find_one({"id": period_id}, {"_id": 0})
    return updated
