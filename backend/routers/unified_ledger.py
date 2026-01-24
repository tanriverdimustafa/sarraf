"""Unified Ledger routes - Account statements and ledger operations"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from database import get_db
from auth import get_current_user
from models.user import User

router = APIRouter(prefix="/unified-ledger", tags=["Unified Ledger"])
logger = logging.getLogger(__name__)


@router.get("/party/{party_id}/statement")
async def get_party_statement(
    party_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get party account statement (ekstre)"""
    db = get_db()
    
    query = {"party_id": party_id}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    
    entries = await db.unified_ledger.find(query, {"_id": 0}).sort("transaction_date", 1).to_list(1000)
    
    # Calculate running balance
    running_has_balance = 0
    running_amount_balance = 0
    
    for entry in entries:
        running_has_balance += entry.get("has_net", 0)
        running_amount_balance += entry.get("amount_net", 0)
        entry["running_has_balance"] = round(running_has_balance, 6)
        entry["running_amount_balance"] = round(running_amount_balance, 2)
    
    # Get party info
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        # Check employees
        party = await db.employees.find_one({"id": party_id}, {"_id": 0})
    if not party:
        # Check partners
        party = await db.partners.find_one({"id": party_id}, {"_id": 0})
    
    return {
        "party": party,
        "entries": entries,
        "final_has_balance": round(running_has_balance, 6),
        "final_amount_balance": round(running_amount_balance, 2)
    }


@router.get("/entries")
async def get_ledger_entries(
    party_id: Optional[str] = None,
    entry_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get unified ledger entries with filters"""
    db = get_db()
    
    query = {}
    if party_id:
        query["party_id"] = party_id
    if entry_type:
        query["entry_type"] = entry_type
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    
    # Calculate pagination
    skip = (page - 1) * per_page
    
    # Get total count
    total = await db.unified_ledger.count_documents(query)
    
    # Get entries
    entries = await db.unified_ledger.find(query, {"_id": 0}).sort("transaction_date", -1).skip(skip).limit(per_page).to_list(per_page)
    
    return {
        "entries": entries,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    }
