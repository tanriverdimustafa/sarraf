"""Product routes - Product CRUD and management"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import base64
import os

from database import get_db
from models.user import User
from models.product import ProductCreate, ProductUpdate, Product, ImageUpload
from auth import get_current_user

# Import ledger for adjustments
from init_unified_ledger import create_ledger_entry, create_adjustment_entry

router = APIRouter(prefix="/products", tags=["Products"])
logger = logging.getLogger(__name__)


def generate_barcode() -> str:
    """Generate unique barcode in format PRD-YYYYMMDD-NNNN"""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"PRD-{today}-{str(uuid.uuid4())[:4].upper()}"


def calculate_product_costs(product_data: dict, product_type: dict, karat: dict = None):
    """Calculate all product costs based on type and inputs"""
    is_gold_based = product_type.get("is_gold_based", False)
    
    # Initialize costs
    material_has_cost = 0.0
    labor_has_cost = 0.0
    
    if is_gold_based:
        # Altın ürün maliyet hesabı
        weight = product_data.get("weight_gram", 0)
        fineness = karat.get("fineness", 0) if karat else 0
        material_has_cost = weight * fineness
    else:
        # Altın olmayan ürün
        material_has_cost = product_data.get("alis_has_degeri", 0)
    
    # İşçilik hesabı
    labor_type_id = product_data.get("labor_type_id")
    labor_has_value = product_data.get("labor_has_value", 0)
    
    if labor_type_id:
        if labor_type_id == 1:  # PER_GRAM
            if is_gold_based:
                labor_has_cost = product_data.get("weight_gram", 0) * labor_has_value
            else:
                labor_has_cost = 0
        elif labor_type_id == 2:  # PER_PIECE
            labor_has_cost = labor_has_value
    
    total_cost_has = material_has_cost + labor_has_cost
    
    # Satış değeri hesabı
    profit_rate = product_data.get("profit_rate_percent", 0)
    sale_has_value = total_cost_has * (1 + profit_rate / 100)
    
    return {
        "material_has_cost": round(material_has_cost, 6),
        "labor_has_cost": round(labor_has_cost, 6),
        "total_cost_has": round(total_cost_has, 6),
        "sale_has_value": round(sale_has_value, 6)
    }


@router.post("", response_model=Product, status_code=201)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    """Create a new product"""
    db = get_db()
    try:
        logger.info(f"Creating product: {product_data.model_dump()}")
        
        # Verify product_type_id
        product_type = await db.product_types.find_one({"id": product_data.product_type_id})
        if not product_type:
            raise HTTPException(status_code=400, detail="Invalid product_type_id")
        
        is_gold_based = product_type["is_gold_based"]
        
        # Validate based on product type
        if is_gold_based:
            if not product_data.karat_id or not product_data.weight_gram:
                raise HTTPException(status_code=400, detail="Altın ürünler için ayar ve gram ağırlık zorunludur")
            
            # Get karat info
            karat = await db.karats.find_one({"id": product_data.karat_id})
            if not karat:
                raise HTTPException(status_code=400, detail="Invalid karat_id")
            fineness = karat["fineness"]
        else:
            if not product_data.alis_has_degeri:
                raise HTTPException(status_code=400, detail="Altın olmayan ürünler için alış HAS değeri zorunludur")
            fineness = None
            karat = None
        
        # Validate labor type
        if product_data.labor_type_id:
            labor_type = await db.labor_types.find_one({"id": product_data.labor_type_id})
            if not labor_type:
                raise HTTPException(status_code=400, detail="Invalid labor_type_id")
            
            # PER_GRAM only for gold products
            if labor_type["code"] == "PER_GRAM" and not is_gold_based:
                raise HTTPException(
                    status_code=400,
                    detail="Altın olmayan ürünlerde gram başı işçilik kullanılamaz"
                )
            
            if not product_data.labor_has_value:
                raise HTTPException(status_code=400, detail="İşçilik değeri zorunludur")
        
        # Calculate costs
        costs = calculate_product_costs(product_data.model_dump(), product_type, karat)
        
        # Generate barcode
        barcode = generate_barcode()
        
        # Validate supplier if provided
        if product_data.supplier_party_id:
            supplier = await db.parties.find_one({"id": product_data.supplier_party_id, "is_active": True})
            if not supplier:
                raise HTTPException(status_code=400, detail="Tedarikçi bulunamadı veya aktif değil")
        
        # Create product
        now = datetime.now(timezone.utc).isoformat()
        product_dict = {
            "id": str(uuid.uuid4()),
            "barcode": barcode,
            "product_type_id": product_data.product_type_id,
            "name": product_data.name,
            "notes": product_data.notes,
            "karat_id": product_data.karat_id,
            "fineness": fineness,
            "weight_gram": product_data.weight_gram,
            "labor_type_id": product_data.labor_type_id,
            "labor_has_value": product_data.labor_has_value,
            "alis_has_degeri": product_data.alis_has_degeri,
            "material_has_cost": costs["material_has_cost"],
            "labor_has_cost": costs["labor_has_cost"],
            "total_cost_has": costs["total_cost_has"],
            "profit_rate_percent": product_data.profit_rate_percent,
            "sale_has_value": costs["sale_has_value"],
            # Tedarikçi bilgisi
            "supplier_party_id": product_data.supplier_party_id,
            "purchase_date": product_data.purchase_date,
            "purchase_price_has": costs["total_cost_has"],
            "purchase_transaction_id": None,
            "images": product_data.images or [],
            "stock_status_id": 1,  # IN_STOCK
            "is_gold_based": is_gold_based,
            "created_at": now,
            "updated_at": now,
            # Track type ve unit - product_type'dan al
            "track_type": product_type.get("track_type", "UNIQUE"),
            "unit": product_type.get("unit", "GRAM"),
            # Quantity - FIFO ürünler için
            "quantity": product_data.quantity if hasattr(product_data, 'quantity') and product_data.quantity else 1,
            "remaining_quantity": product_data.quantity if hasattr(product_data, 'quantity') and product_data.quantity else 1,
            # Unit HAS - FIFO için birim değer
            "unit_has": costs["sale_has_value"] / (product_data.quantity if hasattr(product_data, 'quantity') and product_data.quantity else 1)
        }
        
        await db.products.insert_one(product_dict)
        product_dict.pop("_id", None)
        
        # ==================== TEDARİKÇİ BORÇ İŞLEMİ ====================
        # Tedarikçi seçildiyse, tedarikçinin bakiyesini güncelle (BORÇ oluştur)
        if product_data.supplier_party_id and costs["total_cost_has"] > 0:
            # Tedarikçi bakiyesini artır (biz borçlandık)
            await db.parties.update_one(
                {"id": product_data.supplier_party_id},
                {"$inc": {"has_balance": costs["total_cost_has"]}}
            )
            
            # Unified Ledger'a kaydet
            ledger_entry = {
                "id": str(uuid.uuid4()),
                "transaction_date": now,
                "type": "PURCHASE",
                "entry_type": "PRODUCT_ENTRY",
                "party_id": product_data.supplier_party_id,
                "product_id": product_dict["id"],
                "description": f"Ürün girişi: {product_data.name}",
                "has_in": 0,
                "has_out": costs["total_cost_has"],
                "has_net": costs["total_cost_has"],  # Tedarikçiye borç
                "amount_in": 0,
                "amount_out": 0,
                "amount_net": 0,
                "currency": "TRY",
                "created_at": now,
                "created_by": current_user.id if hasattr(current_user, 'id') else current_user.get("id", "system")
            }
            await db.unified_ledger.insert_one(ledger_entry)
            
            logger.info(f"✅ Supplier {product_data.supplier_party_id} balance updated: +{costs['total_cost_has']} HAS (product entry)")
        
        logger.info(f"✅ Product created: {product_dict['id']}")
        return Product(**product_dict)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating product: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_products(
    page: int = 1,
    per_page: int = 20,
    product_type_id: Optional[int] = None,
    stock_status_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all products with optional filters and pagination"""
    db = get_db()
    query = {}
    
    if product_type_id:
        query["product_type_id"] = product_type_id
    if stock_status_id:
        query["stock_status_id"] = stock_status_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}}
        ]
    
    # Toplam kayıt sayısı
    total = await db.products.count_documents(query)
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 1
    
    # Sayfalama ve sıralama - EN SON GİRİLEN EN ÜSTTE
    skip = (page - 1) * per_page
    products = await db.products.find(query, {"_id": 0}).sort([
        ("created_at", -1),
        ("id", -1)
    ]).skip(skip).limit(per_page).to_list(per_page)
    
    return {
        "products": products,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages
        }
    }


@router.get("/{product_id}")
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    """Get a single product by ID"""
    db = get_db()
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a product"""
    db = get_db()
    product = await db.products.find_one({"id": product_id})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if SOLD
    current_stock_status = product.get("stock_status_id")
    is_sold = current_stock_status == 2  # SOLD
    
    if is_sold:
        # Only allow notes and images update for SOLD products
        allowed_fields = ["notes", "images"]
        update_data = {}
        for field in allowed_fields:
            value = getattr(product_data, field, None)
            if value is not None:
                update_data[field] = value
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Satılan ürünlerde sadece notlar ve fotoğraflar güncellenebilir")
    else:
        # Stock status transition validation
        new_stock_status = product_data.stock_status_id
        if new_stock_status:
            # Cannot go back from SOLD
            if current_stock_status == 2 and new_stock_status != 2:
                raise HTTPException(status_code=400, detail="Satılan ürün stok durumu değiştirilemez")
        
        # Build update data
        update_data = {}
        
        # Get product type for is_gold_based
        product_type = await db.product_types.find_one({"id": product["product_type_id"]})
        is_gold_based = product_type["is_gold_based"]
        
        # Update editable fields
        if product_data.name is not None:
            update_data["name"] = product_data.name
        if product_data.notes is not None:
            update_data["notes"] = product_data.notes
        if product_data.images is not None:
            update_data["images"] = product_data.images
        if product_data.stock_status_id is not None:
            update_data["stock_status_id"] = product_data.stock_status_id
        
        # Fields that affect cost calculation
        cost_changed = False
        
        if product_data.karat_id is not None:
            update_data["karat_id"] = product_data.karat_id
            karat = await db.karats.find_one({"id": product_data.karat_id})
            if karat:
                update_data["fineness"] = karat["fineness"]
            cost_changed = True
        
        if product_data.weight_gram is not None:
            update_data["weight_gram"] = product_data.weight_gram
            cost_changed = True
        
        if product_data.labor_type_id is not None:
            # Validate PER_GRAM for non-gold
            if product_data.labor_type_id == 1 and not is_gold_based:
                raise HTTPException(
                    status_code=400,
                    detail="Altın olmayan ürünlerde gram başı işçilik kullanılamaz"
                )
            update_data["labor_type_id"] = product_data.labor_type_id
            cost_changed = True
        
        if product_data.labor_has_value is not None:
            update_data["labor_has_value"] = product_data.labor_has_value
            cost_changed = True
        
        if product_data.alis_has_degeri is not None:
            update_data["alis_has_degeri"] = product_data.alis_has_degeri
            cost_changed = True
        
        if product_data.profit_rate_percent is not None:
            update_data["profit_rate_percent"] = product_data.profit_rate_percent
            cost_changed = True
        
        # Recalculate costs if needed
        if cost_changed:
            merged_data = {**product, **update_data}
            karat = None
            if merged_data.get("karat_id"):
                karat = await db.karats.find_one({"id": merged_data["karat_id"]})
            
            costs = calculate_product_costs(merged_data, product_type, karat)
            update_data.update(costs)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # ESKİ MALİYET - Borç güncelleme için
    old_total_cost_has = product.get("total_cost_has", 0) or 0
    supplier_party_id = product.get("supplier_party_id")
    
    await db.products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    
    updated_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    
    # BORÇ FARKI GÜNCELLEME
    new_total_cost_has = updated_product.get("total_cost_has", 0) or 0
    if supplier_party_id and old_total_cost_has != new_total_cost_has:
        cost_difference = new_total_cost_has - old_total_cost_has
        await db.parties.update_one(
            {"id": supplier_party_id},
            {
                "$inc": {"has_balance": cost_difference},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        logger.info(f"Updated supplier {supplier_party_id} balance by {cost_difference} HAS (product edit)")
    
    # ADJUSTMENT KAYDI OLUŞTUR
    try:
        cost_diff = new_total_cost_has - old_total_cost_has
        if abs(cost_diff) > 0.000001:
            await create_adjustment_entry(
                original_reference_type="products",
                original_reference_id=product_id,
                adjustment_reason=f"Ürün maliyet düzeltme: {old_total_cost_has:.6f} → {new_total_cost_has:.6f} HAS",
                has_in_diff=cost_diff if cost_diff > 0 else 0,
                has_out_diff=abs(cost_diff) if cost_diff < 0 else 0,
                created_by=current_user.id if current_user else None
            )
    except Exception as e:
        logger.error(f"Failed to create adjustment entry: {e}")
    
    return Product(**updated_product)


@router.delete("/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    """Delete a product (only if IN_STOCK and no transactions)"""
    db = get_db()
    product = await db.products.find_one({"id": product_id})
    
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    
    # Check if SOLD
    if product.get("stock_status_id") == 2:
        raise HTTPException(status_code=400, detail="Satılmış ürün silinemez")
    
    # Check for related transactions
    tx_count = await db.financial_transactions.count_documents({
        "lines.product_id": product_id,
        "status": {"$ne": "CANCELLED"}
    })
    
    if tx_count > 0:
        raise HTTPException(status_code=400, detail=f"Bu ürünle ilişkili {tx_count} işlem var. Silinemez.")
    
    # Tedarikçi borç düzeltmesi
    supplier_party_id = product.get("supplier_party_id")
    total_cost_has = product.get("total_cost_has", 0) or 0
    
    if supplier_party_id and total_cost_has > 0:
        await db.parties.update_one(
            {"id": supplier_party_id},
            {
                "$inc": {"has_balance": -total_cost_has},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        logger.info(f"Reduced supplier {supplier_party_id} balance by {total_cost_has} HAS (product delete)")
    
    # Delete product
    await db.products.delete_one({"id": product_id})
    
    return {"message": "Ürün başarıyla silindi"}


@router.post("/{product_id}/images")
async def upload_product_image(
    product_id: str,
    image_data: ImageUpload,
    current_user: User = Depends(get_current_user)
):
    """Upload an image for a product (base64)"""
    db = get_db()
    
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    
    try:
        # Decode base64
        image_bytes = base64.b64decode(image_data.image.split(",")[-1])
        
        # Create uploads directory if not exists
        uploads_dir = "/app/backend/uploads/products"
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Generate filename
        extension = image_data.filename.split(".")[-1] if image_data.filename else "jpg"
        filename = f"{product_id}_{uuid.uuid4().hex[:8]}.{extension}"
        filepath = os.path.join(uploads_dir, filename)
        
        # Save file
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        
        # Update product images
        # NOTE: Use /api/uploads path for Kubernetes ingress routing
        image_url = f"/api/uploads/products/{filename}"
        images = product.get("images", [])
        images.append(image_url)
        
        await db.products.update_one(
            {"id": product_id},
            {"$set": {"images": images, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"image_url": image_url, "images": images}
    
    except Exception as e:
        logger.error(f"Failed to upload image: {e}")
        raise HTTPException(status_code=500, detail=f"Resim yüklenemedi: {str(e)}")


@router.delete("/{product_id}/images/{image_index}")
async def delete_product_image(
    product_id: str,
    image_index: int,
    current_user: User = Depends(get_current_user)
):
    """Delete an image from a product"""
    db = get_db()
    
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    
    images = product.get("images", [])
    
    if image_index < 0 or image_index >= len(images):
        raise HTTPException(status_code=400, detail="Geçersiz resim indeksi")
    
    # Remove from list
    removed_image = images.pop(image_index)
    
    # Try to delete file
    try:
        filepath = f"/app/backend{removed_image}"
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        logger.warning(f"Could not delete image file: {e}")
    
    # Update product
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"images": images, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Resim silindi", "images": images}


@router.get("/stock/summary")
async def get_stock_summary(
    current_user: User = Depends(get_current_user)
):
    """Get stock summary by product type"""
    db = get_db()
    
    # Get all product types
    product_types = await db.product_types.find({}, {"_id": 0}).to_list(100)
    product_type_map = {pt["id"]: pt for pt in product_types}
    
    # Get all karats
    karats = await db.karats.find({}, {"_id": 0}).to_list(100)
    karat_map = {k["id"]: k for k in karats}
    
    # Get all IN_STOCK products
    products = await db.products.find({"stock_status_id": 1}, {"_id": 0}).to_list(10000)
    
    # Build summary by product type
    type_summary = {}
    for product in products:
        pt_id = product.get("product_type_id")
        pt = product_type_map.get(pt_id, {})
        pt_code = pt.get("code", f"TYPE_{pt_id}")
        pt_name = pt.get("name", "Bilinmeyen")
        
        if pt_code not in type_summary:
            type_summary[pt_code] = {
                "product_type_id": pt_id,
                "product_type_code": pt_code,
                "product_type_name": pt_name,
                "total_count": 0,
                "total_weight_gram": 0,
                "total_cost_has": 0,
                "total_sale_has": 0,
                "by_karat": {}
            }
        
        summary = type_summary[pt_code]
        summary["total_count"] += 1
        summary["total_weight_gram"] += product.get("weight_gram", 0) or 0
        summary["total_cost_has"] += product.get("total_cost_has", 0) or 0
        summary["total_sale_has"] += product.get("sale_has_value", 0) or 0
        
        # Karat bazında
        karat_id = product.get("karat_id")
        if karat_id:
            karat = karat_map.get(karat_id, {})
            karat_name = karat.get("name", f"{karat_id}K")
            if karat_name not in summary["by_karat"]:
                summary["by_karat"][karat_name] = {
                    "count": 0,
                    "weight_gram": 0,
                    "cost_has": 0,
                    "sale_has": 0
                }
            k_summary = summary["by_karat"][karat_name]
            k_summary["count"] += 1
            k_summary["weight_gram"] += product.get("weight_gram", 0) or 0
            k_summary["cost_has"] += product.get("total_cost_has", 0) or 0
            k_summary["sale_has"] += product.get("sale_has_value", 0) or 0
    
    # Calculate grand total
    grand_total = {
        "total_count": sum(s["total_count"] for s in type_summary.values()),
        "total_weight_gram": round(sum(s["total_weight_gram"] for s in type_summary.values()), 2),
        "total_cost_has": round(sum(s["total_cost_has"] for s in type_summary.values()), 6),
        "total_sale_has": round(sum(s["total_sale_has"] for s in type_summary.values()), 6)
    }
    
    return {
        "by_type": list(type_summary.values()),
        "grand_total": grand_total
    }
