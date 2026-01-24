"""Inventory management routes - Stock Lots (FIFO) and Stock Pools"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from database import get_db
from auth import get_current_user
from models.user import User

router = APIRouter(tags=["Inventory"])
logger = logging.getLogger(__name__)


# ==================== STOCK LOTS (FIFO_LOT) ====================

@router.get("/stock-lots")
async def get_stock_lots(
    product_type_id: Optional[int] = None,
    karat_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get stock lots with filters"""
    db = get_db()
    
    query = {}
    if product_type_id:
        query["product_type_id"] = product_type_id
    if karat_id:
        query["karat_id"] = karat_id
    if status:
        query["status"] = status
    else:
        query["status"] = "ACTIVE"  # Default: only active lots
    
    lots = await db.stock_lots.find(query, {"_id": 0}).sort("purchase_date", 1).to_list(500)
    
    # Get party names for each lot
    party_ids = list(set(lot.get("supplier_party_id") for lot in lots if lot.get("supplier_party_id")))
    parties = {}
    if party_ids:
        party_docs = await db.parties.find({"id": {"$in": party_ids}}, {"id": 1, "name": 1}).to_list(100)
        parties = {p["id"]: p.get("name", "Bilinmiyor") for p in party_docs}
    
    # Add supplier name to each lot
    for lot in lots:
        lot["supplier_name"] = parties.get(lot.get("supplier_party_id"), "Bilinmiyor")
    
    return lots


@router.get("/stock-lots/summary/{product_type_id}")
async def get_stock_lot_summary_endpoint(
    product_type_id: int,
    karat_id: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Get stock lot summary for a product type"""
    db = get_db()
    from financial_v2_transactions import get_stock_lot_summary
    
    summary = await get_stock_lot_summary(db, product_type_id, karat_id)
    
    # Get party names for lots
    party_ids = list(set(lot.get("supplier_party_id") for lot in summary.get("lots", []) if lot.get("supplier_party_id")))
    parties = {}
    if party_ids:
        party_docs = await db.parties.find({"id": {"$in": party_ids}}, {"id": 1, "name": 1}).to_list(100)
        parties = {p["id"]: p.get("name", "Bilinmiyor") for p in party_docs}
    
    # Add supplier name to each lot
    for lot in summary.get("lots", []):
        lot["supplier_name"] = parties.get(lot.get("supplier_party_id"), "Bilinmiyor")
    
    # Get product type info
    product_type = await db.product_types.find_one({"id": product_type_id}, {"_id": 0})
    if product_type:
        summary["product_type_name"] = product_type.get("name")
        summary["track_type"] = product_type.get("track_type")
        summary["unit"] = product_type.get("unit")
    
    return summary


# ==================== STOCK POOLS (Bilezik vb.) ====================

@router.get("/stock-pools")
async def get_stock_pools(
    product_type_id: Optional[int] = None,
    karat_id: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all stock pools with filters"""
    db = get_db()
    
    query = {}
    if product_type_id:
        query["product_type_id"] = product_type_id
    if karat_id:
        query["karat_id"] = karat_id
    
    pools = await db.stock_pools.find(query, {"_id": 0}).to_list(100)
    
    # Get product type names
    pt_ids = list(set(p.get("product_type_id") for p in pools if p.get("product_type_id")))
    product_types = {}
    if pt_ids:
        pts = await db.product_types.find({"id": {"$in": pt_ids}}, {"id": 1, "name": 1}).to_list(50)
        product_types = {pt["id"]: pt.get("name", "Bilinmiyor") for pt in pts}
    
    # Get karat names
    karat_ids = list(set(p.get("karat_id") for p in pools if p.get("karat_id")))
    karats = {}
    if karat_ids:
        ks = await db.karats.find({"id": {"$in": karat_ids}}).to_list(50)
        karats = {k["id"]: f"{k.get('name', '')} ({k.get('fineness', '')})" for k in ks}
    
    for pool in pools:
        pool["product_type_name"] = product_types.get(pool.get("product_type_id"), "Bilinmiyor")
        pool["karat_name"] = karats.get(pool.get("karat_id"), "Bilinmiyor")
    
    return pools


@router.get("/stock-pools/{product_type_id}/{karat_id}")
async def get_stock_pool_info(
    product_type_id: int,
    karat_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get specific stock pool info"""
    db = get_db()
    from financial_v2_transactions import get_stock_pool_info as get_pool_info
    
    pool = await get_pool_info(db, product_type_id, karat_id)
    
    # Get product type name
    product_type = await db.product_types.find_one({"id": product_type_id})
    if product_type:
        pool["product_type_name"] = product_type.get("name")
    
    # Get karat name
    karat = await db.karats.find_one({"id": karat_id})
    if karat:
        pool["karat_name"] = f"{karat.get('name', '')} ({karat.get('fineness', '')})"
        pool["fineness"] = karat.get("fineness", 0.916)
    
    return pool
