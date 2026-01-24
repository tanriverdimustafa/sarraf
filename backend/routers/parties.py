"""Party (Cari) routes - Customer/Supplier management"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from database import get_db
from models.user import User
from models.party import PartyCreate, PartyUpdate, Party, PartyBalance, generate_party_code
from auth import get_current_user

router = APIRouter(prefix="/parties", tags=["Parties"])
financial_v2_router = APIRouter(prefix="/financial-v2", tags=["Financial V2"])
logger = logging.getLogger(__name__)


async def calculate_party_balance(party_id: str) -> PartyBalance:
    """
    Calculate balance for a party.
    
    HAS balance artık parties.has_balance alanından okunur (tek kaynak!).
    USD/EUR balance hala transaction'lardan hesaplanır.
    """
    db = get_db()
    
    # HAS balance'ı doğrudan party'den al (tek doğru kaynak)
    party = await db.parties.find_one({"id": party_id})
    total_has_balance = party.get("has_balance", 0) if party else 0
    
    # USD/EUR balance için transaction'lardan hesapla
    total_usd_balance = 0.0
    total_eur_balance = 0.0
    
    financial_txns = await db.financial_transactions.find({
        "party_id": party_id,
        "status": {"$ne": "CANCELLED"}
    }).to_list(10000)
    
    for txn in financial_txns:
        type_code = txn.get("type_code", "")
        currency = txn.get("currency", "TRY")
        amount_currency = abs(txn.get("total_amount_currency", 0) or 0)
        
        if currency == "USD" and amount_currency > 0:
            if type_code == "RECEIPT":
                total_usd_balance += amount_currency
            elif type_code == "PAYMENT":
                total_usd_balance -= amount_currency
        
        if currency == "EUR" and amount_currency > 0:
            if type_code == "RECEIPT":
                total_eur_balance += amount_currency
            elif type_code == "PAYMENT":
                total_eur_balance -= amount_currency
    
    return PartyBalance(
        party_id=party_id, 
        has_gold_balance=round(total_has_balance, 6),
        try_balance=0.0,
        usd_balance=round(total_usd_balance, 2),
        eur_balance=round(total_eur_balance, 2)
    )


@router.post("", response_model=Party, status_code=201)
async def create_party(party_data: PartyCreate, current_user: User = Depends(get_current_user)):
    """Create a new party (Cari)"""
    db = get_db()
    
    # Verify party_type_id exists
    party_type = await db.party_types.find_one({"id": party_data.party_type_id})
    if not party_type:
        raise HTTPException(status_code=400, detail="Invalid party_type_id")
    
    # Validate required fields based on type
    if party_data.party_type_id == 1:  # CUSTOMER
        if not party_data.first_name or not party_data.last_name:
            raise HTTPException(status_code=400, detail="Müşteri için Ad ve Soyad zorunludur")
        name = f"{party_data.first_name} {party_data.last_name}"
    elif party_data.party_type_id == 2:  # SUPPLIER
        if not party_data.company_name:
            raise HTTPException(status_code=400, detail="Tedarikçi için Firma Adı zorunludur")
        name = party_data.company_name
    else:
        name = party_data.first_name or party_data.company_name or "İsimsiz Cari"
    
    # Generate code automatically
    code = generate_party_code(party_data.party_type_id)
    
    now = datetime.now(timezone.utc).isoformat()
    party_dict = {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": name,
        **party_data.model_dump(),
        "is_active": True,
        "has_balance": 0.0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.parties.insert_one(party_dict)
    party_dict.pop("_id", None)
    return Party(**party_dict)


@router.get("")
async def get_parties(
    party_type_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    current_user: User = Depends(get_current_user)
):
    """Get all parties with optional filters, pagination, and calculated balances"""
    db = get_db()
    query = {}
    
    if role == "supplier":
        query["party_type_id"] = {"$in": [2, 3]}
    elif role == "customer":
        query["party_type_id"] = {"$in": [1, 3]}
    elif party_type_id:
        query["party_type_id"] = party_type_id
        
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}}
        ]
    
    total_items = await db.parties.count_documents(query)
    total_pages = (total_items + page_size - 1) // page_size
    
    sort_dir = -1 if sort_order == "desc" else 1
    skip = (page - 1) * page_size
    parties = await db.parties.find(query, {"_id": 0}).sort(sort_by, sort_dir).skip(skip).limit(page_size).to_list(page_size)
    
    result = []
    for party in parties:
        balance = await calculate_party_balance(party["id"])
        if hasattr(balance, 'model_dump'):
            party["balance"] = balance.model_dump()
        else:
            party["balance"] = balance
        result.append(party)
    
    return {
        "data": result,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages
        }
    }


@router.get("/{party_id}")
async def get_party(party_id: str, current_user: User = Depends(get_current_user)):
    """Get a single party by ID with calculated balance"""
    db = get_db()
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    balance = await calculate_party_balance(party_id)
    if hasattr(balance, 'model_dump'):
        party["balance"] = balance.model_dump()
    else:
        party["balance"] = balance
    
    return party


@router.put("/{party_id}", response_model=Party)
async def update_party(
    party_id: str,
    party_data: PartyUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a party (Cari)"""
    db = get_db()
    party = await db.parties.find_one({"id": party_id})
    
    if not party:
        raise HTTPException(status_code=404, detail="Cari bulunamadı")
    
    if party_data.party_type_id:
        party_type = await db.party_types.find_one({"id": party_data.party_type_id})
        if not party_type:
            raise HTTPException(status_code=400, detail="Geçersiz cari tipi")
    
    update_data = {k: v for k, v in party_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    party_type_id = party_data.party_type_id or party.get("party_type_id")
    if party_type_id == 1:
        first_name = party_data.first_name or party.get("first_name", "")
        last_name = party_data.last_name or party.get("last_name", "")
        if first_name and last_name:
            update_data["name"] = f"{first_name} {last_name}"
    elif party_type_id == 2:
        company_name = party_data.company_name or party.get("company_name", "")
        if company_name:
            update_data["name"] = company_name
    
    await db.parties.update_one({"id": party_id}, {"$set": update_data})
    updated_party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    return Party(**updated_party)


@router.delete("/{party_id}")
async def delete_party(party_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a party (set is_active to false)"""
    db = get_db()
    party = await db.parties.find_one({"id": party_id})
    
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    await db.parties.update_one(
        {"id": party_id},
        {"$set": {
            "is_active": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Party deleted successfully"}


@router.get("/{party_id}/balance")
async def get_party_balance_endpoint(party_id: str, current_user: User = Depends(get_current_user)):
    """Get calculated balance for a party"""
    db = get_db()
    party = await db.parties.find_one({"id": party_id})
    
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    balance = await calculate_party_balance(party_id)
    
    if isinstance(balance, dict):
        return {
            "party_id": party_id,
            "has_gold_balance": balance.get("has_gold_balance", 0),
            "try_balance": balance.get("try_balance", 0),
            "usd_balance": balance.get("usd_balance", 0),
            "eur_balance": balance.get("eur_balance", 0)
        }
    else:
        return {
            "party_id": party_id,
            "has_gold_balance": balance.has_gold_balance,
            "try_balance": balance.try_balance,
            "usd_balance": balance.usd_balance,
            "eur_balance": balance.eur_balance
        }


@router.get("/{party_id}/transactions")
async def get_party_transactions_endpoint(
    party_id: str, 
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get all financial transactions for a party with pagination"""
    db = get_db()
    party = await db.parties.find_one({"id": party_id})
    
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    skip = (page - 1) * limit
    total_count = await db.financial_transactions.count_documents({"party_id": party_id})
    
    transactions = await db.financial_transactions.find(
        {"party_id": party_id}
    ).sort("transaction_date", -1).skip(skip).limit(limit).to_list(limit)
    
    for tx in transactions:
        if "_id" in tx:
            tx["_id"] = str(tx["_id"])
        if "price_snapshot_id" in tx and tx["price_snapshot_id"]:
            tx["price_snapshot_id"] = str(tx["price_snapshot_id"])
        if "transaction_date" in tx and isinstance(tx["transaction_date"], datetime):
            tx["transaction_date"] = tx["transaction_date"].isoformat()
        if "created_at" in tx and isinstance(tx["created_at"], datetime):
            tx["created_at"] = tx["created_at"].isoformat()
        if "updated_at" in tx and isinstance(tx["updated_at"], datetime):
            tx["updated_at"] = tx["updated_at"].isoformat()
    
    return {
        "transactions": transactions,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "total_pages": (total_count + limit - 1) // limit
        }
    }


# ==================== FINANCIAL V2 COMPATIBILITY ====================

@financial_v2_router.get("/parties/{party_id}/balance", response_model=PartyBalance)
async def get_party_balance_v2(
    party_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get party balance - V2 compatible endpoint"""
    db = get_db()
    
    party = await db.parties.find_one({"id": party_id})
    if not party:
        raise HTTPException(status_code=404, detail="Party bulunamadı")
    
    return await calculate_party_balance(party_id)

