"""Lookup routes - Karats, Currencies, Payment Methods, etc."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import logging

from database import get_db
from models.user import User
from auth import get_current_user

router = APIRouter(tags=["Lookups"])
logger = logging.getLogger(__name__)

# Lookup configuration - maps lookup name to collection and related collections for deletion check
LOOKUP_CONFIG = {
    "karats": {
        "collection": "karats",
        "id_field": "id",
        "relations": [("products", "karat_id")],
        "required_fields": ["name", "karat", "fineness"],
        "auto_id": True
    },
    "payment-methods": {
        "collection": "payment_methods",
        "id_field": "id",
        "relations": [("financial_transactions", "payment_method_id")],
        "required_fields": ["code", "name"],
        "auto_id": True
    },
    "currencies": {
        "collection": "currencies",
        "id_field": "id",
        "relations": [("financial_transactions", "currency_id")],
        "required_fields": ["code", "name", "symbol"],
        "auto_id": True
    },
    "product-types": {
        "collection": "product_types",
        "id_field": "id",
        "relations": [("products", "product_type_id")],
        "required_fields": ["code", "name"],
        "auto_id": True
    },
    "party-types": {
        "collection": "party_types",
        "id_field": "id",
        "relations": [("parties", "type_id")],
        "required_fields": ["code", "name"],
        "auto_id": True
    },
    "labor-types": {
        "collection": "labor_types",
        "id_field": "id",
        "relations": [("products", "labor_type_id")],
        "required_fields": ["code", "name"],
        "auto_id": True
    },
    "stock-statuses": {
        "collection": "stock_statuses",
        "id_field": "id",
        "relations": [("products", "stock_status_id")],
        "required_fields": ["code", "name"],
        "auto_id": True
    },
    "transaction-types": {
        "collection": "transaction_types",
        "id_field": "id",
        "relations": [("financial_transactions", "type_id")],
        "required_fields": ["code", "name"],
        "auto_id": True
    }
}


@router.get("/lookups/{lookup_name}")
async def get_lookup_items(lookup_name: str):
    """Get all items from a lookup table"""
    db = get_db()
    
    if lookup_name not in LOOKUP_CONFIG:
        raise HTTPException(status_code=404, detail=f"Lookup '{lookup_name}' not found")
    
    config = LOOKUP_CONFIG[lookup_name]
    items = await db[config["collection"]].find({}, {"_id": 0}).to_list(1000)
    return items


@router.post("/lookups/{lookup_name}", status_code=201)
async def create_lookup_item(lookup_name: str, item_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new lookup item (ADMIN only)"""
    db = get_db()
    
    if current_user.role != "ADMIN" and current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if lookup_name not in LOOKUP_CONFIG:
        raise HTTPException(status_code=404, detail=f"Lookup '{lookup_name}' not found")
    
    config = LOOKUP_CONFIG[lookup_name]
    collection = db[config["collection"]]
    
    # Validate required fields
    for field in config["required_fields"]:
        if field not in item_data or item_data[field] is None:
            raise HTTPException(status_code=400, detail=f"Field '{field}' is required")
    
    # Check for duplicate code if exists
    if "code" in item_data:
        existing = await collection.find_one({"code": item_data["code"]})
        if existing:
            raise HTTPException(status_code=400, detail=f"Item with code '{item_data['code']}' already exists")
    
    # Auto-generate ID
    if config.get("auto_id"):
        all_items = await collection.find({}).to_list(1000)
        max_int_id = 0
        for item in all_items:
            item_id = item.get("id")
            if isinstance(item_id, int) and item_id > max_int_id:
                max_int_id = item_id
        next_id = max_int_id + 1
        item_data["id"] = next_id
    
    # Add timestamps
    now = datetime.now(timezone.utc).isoformat()
    item_data["created_at"] = now
    item_data["updated_at"] = now
    
    await collection.insert_one(item_data)
    item_data.pop("_id", None)
    
    return item_data


@router.put("/lookups/{lookup_name}/{item_id}")
async def update_lookup_item(lookup_name: str, item_id: int, item_data: dict, current_user: User = Depends(get_current_user)):
    """Update a lookup item (ADMIN only)"""
    db = get_db()
    
    if current_user.role != "ADMIN" and current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if lookup_name not in LOOKUP_CONFIG:
        raise HTTPException(status_code=404, detail=f"Lookup '{lookup_name}' not found")
    
    config = LOOKUP_CONFIG[lookup_name]
    collection = db[config["collection"]]
    
    # Find existing item
    existing = await collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Item with ID {item_id} not found")
    
    # Check for duplicate code if code is being changed
    if "code" in item_data and item_data["code"] != existing.get("code"):
        duplicate = await collection.find_one({"code": item_data["code"], "id": {"$ne": item_id}})
        if duplicate:
            raise HTTPException(status_code=400, detail=f"Item with code '{item_data['code']}' already exists")
    
    # Prepare update
    update_data = {k: v for k, v in item_data.items() if k not in ["id", "_id", "created_at"]}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await collection.update_one({"id": item_id}, {"$set": update_data})
    
    updated = await collection.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/lookups/{lookup_name}/{item_id}")
async def delete_lookup_item(lookup_name: str, item_id: int, current_user: User = Depends(get_current_user)):
    """Delete a lookup item (ADMIN only) - checks for relations"""
    db = get_db()
    
    if current_user.role != "ADMIN" and current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if lookup_name not in LOOKUP_CONFIG:
        raise HTTPException(status_code=404, detail=f"Lookup '{lookup_name}' not found")
    
    config = LOOKUP_CONFIG[lookup_name]
    collection = db[config["collection"]]
    
    # Find existing item
    existing = await collection.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Item with ID {item_id} not found")
    
    # Check relations - prevent deletion if item is in use
    for rel_collection, rel_field in config.get("relations", []):
        count = await db[rel_collection].count_documents({rel_field: item_id})
        if count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Bu kayıt silinemez. {count} adet ilişkili kayıt bulunuyor ({rel_collection})."
            )
    
    await collection.delete_one({"id": item_id})
    return {"message": "Item deleted successfully"}


# Legacy lookup routes (for backward compatibility)
@router.get("/karats")
async def get_karats_shortcut():
    """Get all karats (shortcut for /lookups/karats)"""
    db = get_db()
    karats = await db.karats.find({}, {"_id": 0}).to_list(100)
    return karats


@router.post("/karats", status_code=201)
async def create_karat(karat_data: dict, current_user: User = Depends(get_current_user)):
    """Create a new karat"""
    db = get_db()
    
    # Get next ID
    last_karat = await db.karats.find_one(sort=[("id", -1)])
    new_id = (last_karat["id"] + 1) if last_karat else 1
    
    karat_doc = {
        "id": new_id,
        "karat": karat_data.get("karat", ""),
        "name": karat_data.get("name", karat_data.get("karat", "")),
        "fineness": float(karat_data.get("fineness", 0)),
        "description": karat_data.get("description", f"{karat_data.get('karat', '')} ({int(float(karat_data.get('fineness', 0)) * 1000)} milyem)")
    }
    
    await db.karats.insert_one(karat_doc)
    karat_doc.pop("_id", None)
    return karat_doc


@router.put("/karats/{karat_id}")
async def update_karat(karat_id: int, karat_data: dict, current_user: User = Depends(get_current_user)):
    """Update a karat"""
    db = get_db()
    
    result = await db.karats.update_one(
        {"id": karat_id},
        {"$set": {
            "karat": karat_data.get("karat"),
            "name": karat_data.get("name", karat_data.get("karat")),
            "fineness": float(karat_data.get("fineness", 0)),
            "description": karat_data.get("description", f"{karat_data.get('karat', '')} ({int(float(karat_data.get('fineness', 0)) * 1000)} milyem)")
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Karat not found")
    
    updated = await db.karats.find_one({"id": karat_id}, {"_id": 0})
    return updated


@router.delete("/karats/{karat_id}")
async def delete_karat(karat_id: int, current_user: User = Depends(get_current_user)):
    """Delete a karat"""
    db = get_db()
    
    result = await db.karats.delete_one({"id": karat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Karat not found")
    return {"message": "Karat deleted successfully"}


@router.get("/lookups/asset-types")
async def get_asset_types():
    """Get all asset types"""
    db = get_db()
    asset_types = await db.asset_types.find({}, {"_id": 0}).to_list(100)
    return asset_types


@router.get("/lookups/transaction-directions")
async def get_transaction_directions():
    """Get all transaction directions"""
    db = get_db()
    directions = await db.transaction_directions.find({}, {"_id": 0}).to_list(100)
    return directions


# Financial V2 lookups
@router.get("/financial-v2/lookups/transaction-types")
async def get_transaction_types(current_user: User = Depends(get_current_user)):
    """Get all transaction types"""
    db = get_db()
    types = await db.transaction_types.find({}, {"_id": 0}).to_list(100)
    return types


@router.get("/financial-v2/lookups/payment-methods")
async def get_payment_methods(current_user: User = Depends(get_current_user)):
    """Get all payment methods"""
    db = get_db()
    methods = await db.payment_methods.find({}, {"_id": 0}).to_list(100)
    return methods


@router.get("/financial-v2/lookups/currencies")
async def get_currencies(current_user: User = Depends(get_current_user)):
    """Get all currencies"""
    db = get_db()
    currencies = await db.currencies.find({}, {"_id": 0}).to_list(100)
    return currencies


@router.get("/market-data/latest")
async def get_latest_market_data(current_user: User = Depends(get_current_user)):
    """Get latest market data"""
    db = get_db()
    market_data = await db.market_data.find_one(
        {},
        {"_id": 0},
        sort=[("timestamp", -1)]
    )
    if not market_data:
        return {
            "has_gold_buy": 0,
            "has_gold_sell": 0,
            "usd_buy": 0,
            "usd_sell": 0,
            "eur_buy": 0,
            "eur_sell": 0,
            "timestamp": None
        }
    return market_data
