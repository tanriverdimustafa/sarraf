"""
Stock Count Management Module
Stok sayım sistemi - Manuel ve Barkodlu sayım desteği
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import uuid
import logging
import jwt
import os

# Load .env file
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

stock_count_router = APIRouter(prefix="/api/stock-counts", tags=["Stock Counts"])
security = HTTPBearer()

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Database reference
db = None

def set_database(database):
    global db
    db = database

async def get_current_user_internal(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== MODELS ====================

class StockCountCreate(BaseModel):
    type: str = Field(..., description="MANUAL or BARCODE")
    notes: Optional[str] = None

class StockCountUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class StockCountItemUpdate(BaseModel):
    counted_weight_gram: Optional[float] = None
    counted_quantity: Optional[float] = None
    notes: Optional[str] = None

class BarcodeScancRequest(BaseModel):
    barcode: str

# ==================== HELPER FUNCTIONS ====================

def generate_count_id():
    """Generate stock count ID: CNT-YYYYMMDD-XXXX"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:4].upper()
    return f"CNT-{today}-{random_part}"

def generate_item_id():
    """Generate stock count item ID"""
    return f"CNT-ITEM-{uuid.uuid4().hex[:8].upper()}"

def get_product_category(product_type_name: str, product_type_code: str = None) -> str:
    """
    Determine product category for counting purposes
    Returns: BARCODE, POOL, or PIECE
    """
    # Bilezik Havuz (gram tartılacak)
    pool_keywords = ["Bilezik", "Bracelet"]
    
    # Sarrafiye/Ziynet (adet sayılacak)
    piece_keywords = [
        "Çeyrek", "Yarım", "Tam", "Cumhuriyet", "Ata", "Ata Lira",
        "Ata Çeyrek", "Reşat", "Reşat Çeyrek", "Hamit", 
        "2.5", "İkibuçuk", "5'lik", "Beşlik", "Gram Ziynet", "Ziynet",
        "QUARTER", "HALF", "FULL", "REPUBLIC", "ATA"
    ]
    
    # Sarrafiye kodları
    piece_codes = [
        "SARRAFIYE_CEYREK", "SARRAFIYE_YARIM", "SARRAFIYE_TAM", 
        "SARRAFIYE_ATA", "SARRAFIYE_RESAT", "SARRAFIYE_HAMIT",
        "SARRAFIYE_IKIBUCULUK", "SARRAFIYE_BESLIK", "SARRAFIYE_GRAM",
        "CEYREK", "YARIM", "TAM", "ATA", "RESAT", "CUMHURIYET"
    ]
    
    name_upper = (product_type_name or "").upper()
    code_upper = (product_type_code or "").upper()
    
    # Check for pool products (Bilezik)
    for keyword in pool_keywords:
        if keyword.upper() in name_upper or keyword.upper() in code_upper:
            return "POOL"
    
    # Check for piece products (Sarrafiye)
    for keyword in piece_keywords:
        if keyword.upper() in name_upper:
            return "PIECE"
    
    for code in piece_codes:
        if code in code_upper:
            return "PIECE"
    
    # Default to barcode
    return "BARCODE"

async def get_stock_items_for_count(count_id: str, user_id: str) -> List[dict]:
    """
    Get all IN_STOCK products and prepare them for counting
    Aggregates pool products by karat
    """
    items = []
    
    # Get product types for categorization
    product_types = await db.product_types.find({}).to_list(100)
    type_map = {pt["id"]: pt for pt in product_types}
    
    # Get karats
    karats = await db.karats.find({}).to_list(20)
    karat_map = {k["id"]: k for k in karats}
    
    # Get all IN_STOCK products
    products = await db.products.find({"stock_status_id": 1}).to_list(10000)
    
    # Group pool products by type and karat
    pool_groups = {}
    
    for product in products:
        pt_id = product.get("product_type_id")
        product_type = type_map.get(pt_id, {})
        pt_name = product_type.get("name", "Bilinmiyor")
        pt_code = product_type.get("code", "")
        
        category = get_product_category(pt_name, pt_code)
        
        karat_id = product.get("karat_id")
        karat = karat_map.get(karat_id, {})
        karat_name = karat.get("name", "")
        
        if category == "POOL":
            # Group by product_type_id and karat_id
            group_key = f"{pt_id}_{karat_id}"
            if group_key not in pool_groups:
                pool_groups[group_key] = {
                    "product_type_id": pt_id,
                    "product_type_name": pt_name,
                    "karat_id": karat_id,
                    "karat_name": karat_name,
                    "total_weight": 0,
                    "total_has": 0,
                    "product_ids": []
                }
            
            weight = product.get("weight_gram") or product.get("remaining_quantity") or 0
            has_value = product.get("sale_has_value") or product.get("total_cost_has") or 0
            
            pool_groups[group_key]["total_weight"] += weight
            pool_groups[group_key]["total_has"] += has_value
            pool_groups[group_key]["product_ids"].append(product["id"])
        
        elif category == "PIECE":
            # Sarrafiye - aggregate by product type and karat
            group_key = f"PIECE_{pt_id}_{karat_id}"
            if group_key not in pool_groups:
                pool_groups[group_key] = {
                    "category": "PIECE",
                    "product_type_id": pt_id,
                    "product_type_name": pt_name,
                    "karat_id": karat_id,
                    "karat_name": karat_name,
                    "total_quantity": 0,
                    "total_has": 0,
                    "product_ids": []
                }
            
            qty = product.get("remaining_quantity") or product.get("quantity") or 1
            has_value = product.get("sale_has_value") or product.get("total_cost_has") or 0
            
            pool_groups[group_key]["total_quantity"] += qty
            pool_groups[group_key]["total_has"] += has_value
            pool_groups[group_key]["product_ids"].append(product["id"])
        
        else:
            # Barcode product - individual item
            item = {
                "id": generate_item_id(),
                "count_id": count_id,
                "product_id": product["id"],
                "barcode": product.get("barcode", ""),
                "product_name": product.get("name", ""),
                "product_type": pt_name,
                "product_type_id": pt_id,
                "karat": karat_name,
                "karat_id": karat_id,
                "category": "BARCODE",
                
                # System values
                "system_weight_gram": product.get("weight_gram"),
                "system_quantity": 1,
                "system_has": product.get("sale_has_value") or product.get("total_cost_has") or 0,
                
                # Count values
                "counted_weight_gram": None,
                "counted_quantity": None,
                "counted_at": None,
                "counted_by": None,
                
                # Result
                "is_counted": False,
                "is_matched": None,
                "difference_gram": None,
                "difference_quantity": None,
                "notes": None,
                
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            items.append(item)
    
    # Add pool items
    for group_key, group in pool_groups.items():
        if group.get("category") == "PIECE":
            # Sarrafiye item
            item = {
                "id": generate_item_id(),
                "count_id": count_id,
                "product_id": None,  # Aggregated
                "product_ids": group["product_ids"],
                "barcode": None,
                "product_name": f"{group['karat_name']} {group['product_type_name']}",
                "product_type": group["product_type_name"],
                "product_type_id": group["product_type_id"],
                "karat": group["karat_name"],
                "karat_id": group["karat_id"],
                "category": "PIECE",
                
                # System values
                "system_weight_gram": None,
                "system_quantity": group["total_quantity"],
                "system_has": group["total_has"],
                
                # Count values
                "counted_weight_gram": None,
                "counted_quantity": None,
                "counted_at": None,
                "counted_by": None,
                
                # Result
                "is_counted": False,
                "is_matched": None,
                "difference_gram": None,
                "difference_quantity": None,
                "notes": None,
                
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            items.append(item)
        else:
            # Pool item (Bilezik)
            item = {
                "id": generate_item_id(),
                "count_id": count_id,
                "product_id": None,  # Aggregated
                "product_ids": group["product_ids"],
                "barcode": None,
                "product_name": f"{group['karat_name']} {group['product_type_name']} Havuz",
                "product_type": group["product_type_name"],
                "product_type_id": group["product_type_id"],
                "karat": group["karat_name"],
                "karat_id": group["karat_id"],
                "category": "POOL",
                
                # System values
                "system_weight_gram": group["total_weight"],
                "system_quantity": None,
                "system_has": group["total_has"],
                
                # Count values
                "counted_weight_gram": None,
                "counted_quantity": None,
                "counted_at": None,
                "counted_by": None,
                
                # Result
                "is_counted": False,
                "is_matched": None,
                "difference_gram": None,
                "difference_quantity": None,
                "notes": None,
                
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            items.append(item)
    
    return items

# ==================== ENDPOINTS ====================

@stock_count_router.post("")
async def create_stock_count(
    data: StockCountCreate,
    current_user: dict = Depends(get_current_user_internal)
):
    """Start a new stock count"""
    if data.type not in ["MANUAL", "BARCODE"]:
        raise HTTPException(status_code=400, detail="Geçersiz sayım tipi. MANUAL veya BARCODE olmalı.")
    
    count_id = generate_count_id()
    user_id = current_user.get("id", "system") if current_user else "system"
    
    # Create stock count record
    count_record = {
        "id": count_id,
        "type": data.type,
        "status": "IN_PROGRESS",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "paused_at": None,
        "completed_at": None,
        "started_by": user_id,
        "notes": data.notes,
        "total_items": 0,
        "counted_items": 0,
        "matched_items": 0,
        "mismatched_items": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Get all stock items for counting
    items = await get_stock_items_for_count(count_id, user_id)
    
    # Update totals
    count_record["total_items"] = len(items)
    
    # Save to database
    await db.stock_counts.insert_one(count_record)
    
    if items:
        await db.stock_count_items.insert_many(items)
    
    logger.info(f"Stock count {count_id} created with {len(items)} items")
    
    return {
        "id": count_id,
        "type": data.type,
        "status": "IN_PROGRESS",
        "total_items": len(items),
        "message": f"Sayım başlatıldı. {len(items)} ürün sayıma eklendi."
    }

@stock_count_router.get("")
async def get_stock_counts(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    status: Optional[str] = None,
    type: Optional[str] = None
):
    """Get list of stock counts"""
    query = {}
    
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    total = await db.stock_counts.count_documents(query)
    
    counts = await db.stock_counts.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "stock_counts": counts,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    }

@stock_count_router.get("/{count_id}")
async def get_stock_count(count_id: str):
    """Get stock count details"""
    count = await db.stock_counts.find_one({"id": count_id}, {"_id": 0})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    return count

@stock_count_router.put("/{count_id}")
async def update_stock_count(count_id: str, data: StockCountUpdate):
    """Update stock count (status change, notes)"""
    count = await db.stock_counts.find_one({"id": count_id})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.status:
        valid_statuses = ["DRAFT", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"]
        if data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Geçersiz durum. Geçerli durumlar: {valid_statuses}")
        
        update_data["status"] = data.status
        
        if data.status == "PAUSED":
            update_data["paused_at"] = datetime.now(timezone.utc).isoformat()
        elif data.status == "IN_PROGRESS" and count.get("paused_at"):
            update_data["paused_at"] = None
        elif data.status == "COMPLETED":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            # Recalculate stats
            items = await db.stock_count_items.find({"count_id": count_id}).to_list(10000)
            counted = sum(1 for i in items if i.get("is_counted"))
            matched = sum(1 for i in items if i.get("is_matched") == True)
            mismatched = sum(1 for i in items if i.get("is_matched") == False)
            
            update_data["counted_items"] = counted
            update_data["matched_items"] = matched
            update_data["mismatched_items"] = mismatched
    
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    await db.stock_counts.update_one({"id": count_id}, {"$set": update_data})
    
    updated = await db.stock_counts.find_one({"id": count_id}, {"_id": 0})
    return updated

@stock_count_router.delete("/{count_id}")
async def delete_stock_count(count_id: str):
    """Delete stock count"""
    count = await db.stock_counts.find_one({"id": count_id})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    
    # Delete items first
    await db.stock_count_items.delete_many({"count_id": count_id})
    
    # Delete count
    await db.stock_counts.delete_one({"id": count_id})
    
    return {"message": "Sayım silindi", "id": count_id}

@stock_count_router.get("/{count_id}/items")
async def get_stock_count_items(
    count_id: str,
    category: Optional[str] = None,
    is_counted: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500)
):
    """Get stock count items with filters"""
    count = await db.stock_counts.find_one({"id": count_id})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    
    query = {"count_id": count_id}
    
    if category:
        query["category"] = category
    if is_counted is not None:
        query["is_counted"] = is_counted
    
    total = await db.stock_count_items.count_documents(query)
    
    items = await db.stock_count_items.find(query, {"_id": 0}).sort([
        ("category", 1),
        ("product_type", 1),
        ("karat", 1),
        ("barcode", 1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    # Group by category for frontend
    barcode_items = [i for i in items if i.get("category") == "BARCODE"]
    pool_items = [i for i in items if i.get("category") == "POOL"]
    piece_items = [i for i in items if i.get("category") == "PIECE"]
    
    return {
        "items": items,
        "grouped": {
            "barcode": barcode_items,
            "pool": pool_items,
            "piece": piece_items
        },
        "summary": {
            "total": total,
            "barcode_count": len(barcode_items),
            "pool_count": len(pool_items),
            "piece_count": len(piece_items)
        },
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    }

@stock_count_router.put("/{count_id}/items/{item_id}")
async def update_stock_count_item(
    count_id: str,
    item_id: str,
    data: StockCountItemUpdate,
    current_user: dict = Depends(get_current_user_internal)
):
    """Update stock count item (record count)"""
    item = await db.stock_count_items.find_one({"id": item_id, "count_id": count_id})
    if not item:
        raise HTTPException(status_code=404, detail="Sayım kalemi bulunamadı")
    
    user_id = current_user.get("id", "system") if current_user else "system"
    
    update_data = {
        "counted_at": datetime.now(timezone.utc).isoformat(),
        "counted_by": user_id,
        "is_counted": True
    }
    
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    category = item.get("category")
    
    # Calculate differences based on category
    if category == "POOL":
        # Pool - compare weights
        if data.counted_weight_gram is not None:
            update_data["counted_weight_gram"] = data.counted_weight_gram
            system_weight = item.get("system_weight_gram") or 0
            diff = data.counted_weight_gram - system_weight
            update_data["difference_gram"] = round(diff, 2)
            
            # Tolerance check (±0.5 gr)
            tolerance = 0.5
            update_data["is_matched"] = abs(diff) <= tolerance
    
    elif category == "PIECE":
        # Piece - compare quantities
        if data.counted_quantity is not None:
            update_data["counted_quantity"] = data.counted_quantity
            system_qty = item.get("system_quantity") or 0
            diff = data.counted_quantity - system_qty
            update_data["difference_quantity"] = diff
            update_data["is_matched"] = diff == 0
    
    else:
        # Barcode - mark as counted (exists = matched)
        update_data["counted_quantity"] = 1
        update_data["is_matched"] = True
    
    await db.stock_count_items.update_one({"id": item_id}, {"$set": update_data})
    
    # Update count stats
    await update_count_stats(count_id)
    
    updated = await db.stock_count_items.find_one({"id": item_id}, {"_id": 0})
    return updated

@stock_count_router.post("/{count_id}/scan")
async def scan_barcode(
    count_id: str,
    data: BarcodeScancRequest,
    current_user: dict = Depends(get_current_user_internal)
):
    """Scan barcode and mark item as counted"""
    count = await db.stock_counts.find_one({"id": count_id})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    
    if count.get("status") not in ["IN_PROGRESS"]:
        raise HTTPException(status_code=400, detail="Sayım devam etmiyor")
    
    # Find item by barcode
    item = await db.stock_count_items.find_one({
        "count_id": count_id,
        "barcode": data.barcode
    })
    
    if not item:
        # Barcode not found in count - add to not found list
        not_found = {
            "id": generate_item_id(),
            "count_id": count_id,
            "barcode": data.barcode,
            "category": "NOT_FOUND",
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "is_counted": False,
            "is_matched": False
        }
        await db.stock_count_items.insert_one(not_found)
        
        return {
            "success": False,
            "error": "NOT_FOUND",
            "message": f"Barkod sistemde bulunamadı: {data.barcode}",
            "barcode": data.barcode
        }
    
    if item.get("is_counted"):
        return {
            "success": False,
            "error": "ALREADY_COUNTED",
            "message": f"Bu ürün zaten sayıldı: {item.get('product_name')}",
            "item": {k: v for k, v in item.items() if k != "_id"}
        }
    
    user_id = current_user.get("id", "system") if current_user else "system"
    
    # Mark as counted
    update_data = {
        "counted_at": datetime.now(timezone.utc).isoformat(),
        "counted_by": user_id,
        "counted_quantity": 1,
        "is_counted": True,
        "is_matched": True
    }
    
    await db.stock_count_items.update_one({"id": item["id"]}, {"$set": update_data})
    
    # Update count stats
    await update_count_stats(count_id)
    
    updated = await db.stock_count_items.find_one({"id": item["id"]}, {"_id": 0})
    
    return {
        "success": True,
        "message": f"✅ {item.get('product_name')} sayıldı",
        "item": updated
    }

async def update_count_stats(count_id: str):
    """Update stock count statistics"""
    items = await db.stock_count_items.find({"count_id": count_id}).to_list(10000)
    
    total = len([i for i in items if i.get("category") != "NOT_FOUND"])
    counted = sum(1 for i in items if i.get("is_counted") and i.get("category") != "NOT_FOUND")
    matched = sum(1 for i in items if i.get("is_matched") == True and i.get("category") != "NOT_FOUND")
    mismatched = sum(1 for i in items if i.get("is_matched") == False and i.get("category") != "NOT_FOUND")
    
    await db.stock_counts.update_one(
        {"id": count_id},
        {"$set": {
            "total_items": total,
            "counted_items": counted,
            "matched_items": matched,
            "mismatched_items": mismatched,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

@stock_count_router.get("/{count_id}/report")
async def get_stock_count_report(count_id: str):
    """Get comprehensive stock count report"""
    count = await db.stock_counts.find_one({"id": count_id}, {"_id": 0})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    
    items = await db.stock_count_items.find({"count_id": count_id}, {"_id": 0}).to_list(10000)
    
    # Separate by category
    barcode_items = [i for i in items if i.get("category") == "BARCODE"]
    pool_items = [i for i in items if i.get("category") == "POOL"]
    piece_items = [i for i in items if i.get("category") == "PIECE"]
    not_found_items = [i for i in items if i.get("category") == "NOT_FOUND"]
    
    # Find items with differences
    differences = []
    
    for item in items:
        if item.get("is_matched") == False:
            differences.append({
                "product_name": item.get("product_name"),
                "barcode": item.get("barcode"),
                "category": item.get("category"),
                "system_value": item.get("system_weight_gram") or item.get("system_quantity"),
                "counted_value": item.get("counted_weight_gram") or item.get("counted_quantity"),
                "difference": item.get("difference_gram") or item.get("difference_quantity"),
                "unit": "gr" if item.get("category") == "POOL" else "adet"
            })
    
    # Find uncounted items
    uncounted = [i for i in items if not i.get("is_counted") and i.get("category") != "NOT_FOUND"]
    
    # Calculate totals
    total_system_has = sum(i.get("system_has", 0) for i in items if i.get("category") != "NOT_FOUND")
    
    return {
        "count": count,
        "summary": {
            "total_items": count.get("total_items", 0),
            "counted_items": count.get("counted_items", 0),
            "matched_items": count.get("matched_items", 0),
            "mismatched_items": count.get("mismatched_items", 0),
            "uncounted_items": len(uncounted),
            "not_found_items": len(not_found_items),
            "total_system_has": round(total_system_has, 2),
            "completion_percent": round((count.get("counted_items", 0) / max(count.get("total_items", 1), 1)) * 100, 1)
        },
        "by_category": {
            "barcode": {
                "total": len(barcode_items),
                "counted": sum(1 for i in barcode_items if i.get("is_counted")),
                "matched": sum(1 for i in barcode_items if i.get("is_matched") == True)
            },
            "pool": {
                "total": len(pool_items),
                "counted": sum(1 for i in pool_items if i.get("is_counted")),
                "matched": sum(1 for i in pool_items if i.get("is_matched") == True),
                "total_system_weight": round(sum(i.get("system_weight_gram", 0) for i in pool_items), 2),
                "total_counted_weight": round(sum(i.get("counted_weight_gram", 0) or 0 for i in pool_items), 2)
            },
            "piece": {
                "total": len(piece_items),
                "counted": sum(1 for i in piece_items if i.get("is_counted")),
                "matched": sum(1 for i in piece_items if i.get("is_matched") == True),
                "total_system_quantity": sum(i.get("system_quantity", 0) or 0 for i in piece_items),
                "total_counted_quantity": sum(i.get("counted_quantity", 0) or 0 for i in piece_items)
            }
        },
        "differences": differences,
        "uncounted": uncounted[:50],  # Limit to 50
        "not_found": not_found_items
    }

@stock_count_router.get("/{count_id}/print")
async def get_printable_list(count_id: str):
    """Get printable stock count list"""
    count = await db.stock_counts.find_one({"id": count_id}, {"_id": 0})
    if not count:
        raise HTTPException(status_code=404, detail="Sayım bulunamadı")
    
    items = await db.stock_count_items.find(
        {"count_id": count_id, "category": {"$ne": "NOT_FOUND"}},
        {"_id": 0}
    ).sort([
        ("category", 1),
        ("product_type", 1),
        ("karat", 1),
        ("barcode", 1)
    ]).to_list(10000)
    
    # Separate by category
    barcode_items = [i for i in items if i.get("category") == "BARCODE"]
    pool_items = [i for i in items if i.get("category") == "POOL"]
    piece_items = [i for i in items if i.get("category") == "PIECE"]
    
    # Calculate totals
    total_barcode_count = len(barcode_items)
    total_pool_weight = round(sum(i.get("system_weight_gram", 0) or 0 for i in pool_items), 2)
    total_piece_count = sum(i.get("system_quantity", 0) or 0 for i in piece_items)
    
    return {
        "count": count,
        "print_date": datetime.now(timezone.utc).isoformat(),
        "sections": {
            "barcode": {
                "title": "BARKODLU ÜRÜNLER",
                "items": barcode_items,
                "total": total_barcode_count
            },
            "pool": {
                "title": "BİLEZİK HAVUZ (Gram Tartılacak)",
                "items": pool_items,
                "total_weight": total_pool_weight
            },
            "piece": {
                "title": "SARRAFİYE (Adet Sayılacak)",
                "items": piece_items,
                "total_count": total_piece_count
            }
        },
        "summary": {
            "total_barcode_items": total_barcode_count,
            "total_pool_weight": total_pool_weight,
            "total_piece_count": total_piece_count
        }
    }
