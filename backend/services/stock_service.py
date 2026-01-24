"""Stock Service - Stock pool and lot management"""
from datetime import datetime, timezone
from fastapi import HTTPException
import logging
import uuid

logger = logging.getLogger(__name__)


# ==================== STOCK POOL HELPERS (Bilezik vb.) ====================

async def get_or_create_stock_pool(db, product_type_id: int, karat_id: int, fineness: float = 0.916):
    """
    POOL için stok havuzu getir veya oluştur
    """
    pool_id = f"POOL-{product_type_id}-{karat_id}"
    
    pool = await db.stock_pools.find_one({"id": pool_id})
    
    if not pool:
        now = datetime.now(timezone.utc).isoformat()
        pool = {
            "id": pool_id,
            "product_type_id": product_type_id,
            "karat_id": karat_id,
            "fineness": fineness,
            "total_weight": 0.0,
            "total_cost_has": 0.0,
            "avg_cost_per_gram": 0.0,
            "created_at": now,
            "updated_at": now
        }
        await db.stock_pools.insert_one(pool)
        logger.info(f"Created stock pool: {pool_id}")
    
    return pool


async def add_to_stock_pool(db, product_type_id: int, karat_id: int, 
                           weight_gram: float, cost_has: float, fineness: float = 0.916):
    """
    POOL'a stok ekle (alış işlemi)
    """
    pool = await get_or_create_stock_pool(db, product_type_id, karat_id, fineness)
    
    new_total_weight = pool.get("total_weight", 0) + weight_gram
    new_total_cost = pool.get("total_cost_has", 0) + cost_has
    new_avg_cost = new_total_cost / new_total_weight if new_total_weight > 0 else 0
    
    await db.stock_pools.update_one(
        {"id": pool["id"]},
        {"$set": {
            "total_weight": new_total_weight,
            "total_cost_has": new_total_cost,
            "avg_cost_per_gram": new_avg_cost,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Added to pool {pool['id']}: +{weight_gram}g, new total: {new_total_weight}g")
    return {
        "pool_id": pool["id"],
        "added_weight": weight_gram,
        "added_cost": cost_has,
        "new_total_weight": new_total_weight,
        "new_total_cost": new_total_cost,
        "new_avg_cost": new_avg_cost
    }


async def get_stock_pool_info(db, product_type_id: int, karat_id: int):
    """
    POOL bilgisi getir - hem stock_pools tablosundan hem de products tablosundan hesapla
    """
    pool = await get_or_create_stock_pool(db, product_type_id, karat_id)
    pool_weight = pool.get("total_weight", 0)
    pool_cost = pool.get("total_cost_has", 0)
    
    # Products tablosundan da stok hesapla (IN_STOCK = 1)
    products_cursor = db.products.find({
        "product_type_id": product_type_id,
        "karat_id": karat_id,
        "stock_status_id": 1  # IN_STOCK
    }, {"_id": 0, "weight_gram": 1, "total_cost_has": 1})
    products = await products_cursor.to_list(1000)
    
    products_weight = sum(p.get("weight_gram", 0) or 0 for p in products)
    products_cost = sum(p.get("total_cost_has", 0) or 0 for p in products)
    
    # Toplam stok = pool + products
    total_weight = pool_weight + products_weight
    total_cost = pool_cost + products_cost
    avg_cost = total_cost / total_weight if total_weight > 0 else 0
    
    logger.info(f"Pool {product_type_id}/{karat_id}: pool_weight={pool_weight}, products_weight={products_weight}, total={total_weight}")
    
    return {
        "pool_id": pool.get("id"),
        "total_weight": total_weight,
        "total_cost_has": total_cost,
        "avg_cost_per_gram": avg_cost,
        "pool_weight": pool_weight,
        "products_weight": products_weight
    }


async def consume_from_stock_pool(db, product_type_id: int, karat_id: int, weight_gram: float):
    """
    POOL'dan stok düş (satış işlemi)
    Önce products tablosundan düşer, sonra stock_pools'dan
    Returns: consumed info with cost calculation
    """
    # Önce toplam mevcut stoğu hesapla
    pool_info = await get_stock_pool_info(db, product_type_id, karat_id)
    total_available = pool_info.get("total_weight", 0)
    
    if total_available < weight_gram:
        raise HTTPException(status_code=400, detail=f"Yetersiz havuz stoğu! Mevcut: {total_available:.2f}g, İstenen: {weight_gram:.2f}g")
    
    avg_cost = pool_info.get("avg_cost_per_gram", 0)
    consumed_cost = weight_gram * avg_cost
    
    remaining_to_consume = weight_gram
    
    # 1. Önce products tablosundan düş (SOLD yap)
    products_cursor = db.products.find({
        "product_type_id": product_type_id,
        "karat_id": karat_id,
        "stock_status_id": 1  # IN_STOCK
    }, {"_id": 0}).sort("created_at", 1)  # FIFO - eski olanı önce
    products = await products_cursor.to_list(100)
    
    for product in products:
        if remaining_to_consume <= 0:
            break
        
        product_weight = product.get("weight_gram", 0) or 0
        if product_weight <= 0:
            continue
        
        if product_weight <= remaining_to_consume:
            # Tüm ürünü sat
            await db.products.update_one(
                {"id": product["id"]},
                {"$set": {"stock_status_id": 2, "updated_at": datetime.now(timezone.utc).isoformat()}}  # SOLD
            )
            remaining_to_consume -= product_weight
            logger.info(f"Pool sale: Product {product['id']} fully sold ({product_weight}g)")
        else:
            # Kısmi satış - ürün ağırlığını düşür
            new_weight = product_weight - remaining_to_consume
            await db.products.update_one(
                {"id": product["id"]},
                {"$set": {"weight_gram": new_weight, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            logger.info(f"Pool sale: Product {product['id']} partial sold ({remaining_to_consume}g), remaining: {new_weight}g")
            remaining_to_consume = 0
    
    # 2. stock_pools tablosunu her zaman güncelle
    products_consumed = weight_gram - remaining_to_consume
    if products_consumed > 0:
        pool = await get_or_create_stock_pool(db, product_type_id, karat_id)
        current_pool_weight = pool.get("total_weight", 0)
        
        new_pool_weight = max(0, current_pool_weight - products_consumed)
        pool_consumed_cost = products_consumed * pool.get("avg_cost_per_gram", 0)
        new_pool_cost = max(0, pool.get("total_cost_has", 0) - pool_consumed_cost)
        
        await db.stock_pools.update_one(
            {"id": pool["id"]},
            {"$set": {
                "total_weight": new_pool_weight,
                "total_cost_has": new_pool_cost,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Pool sale: stock_pools reduced by {products_consumed}g (from products)")
    
    # 3. Kalan varsa stock_pools tablosundan ekstra düş
    if remaining_to_consume > 0:
        pool = await get_or_create_stock_pool(db, product_type_id, karat_id)
        current_pool_weight = pool.get("total_weight", 0)
        
        new_pool_weight = max(0, current_pool_weight - remaining_to_consume)
        pool_consumed_cost = remaining_to_consume * pool.get("avg_cost_per_gram", 0)
        new_pool_cost = max(0, pool.get("total_cost_has", 0) - pool_consumed_cost)
        
        await db.stock_pools.update_one(
            {"id": pool["id"]},
            {"$set": {
                "total_weight": new_pool_weight,
                "total_cost_has": new_pool_cost,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Pool sale: stock_pools reduced by {remaining_to_consume}g")
    
    # Güncel pool bilgisini al
    final_pool_info = await get_stock_pool_info(db, product_type_id, karat_id)
    
    logger.info(f"Pool consume complete: -{weight_gram}g, remaining: {final_pool_info['total_weight']}g")
    return {
        "pool_id": f"POOL-{product_type_id}-{karat_id}",
        "consumed_weight": weight_gram,
        "consumed_cost": consumed_cost,
        "avg_cost_per_gram": avg_cost,
        "remaining_weight": final_pool_info.get("total_weight", 0),
        "remaining_cost": final_pool_info.get("total_cost_has", 0)
    }


# ==================== STOCK LOT HELPERS ====================

async def create_stock_lot(db, product_type_id: int, product_type_code: str, karat_id: int, 
                          supplier_party_id: str, purchase_date: str, quantity: float,
                          unit_cost_has: float, labor_cost_has: float = 0, fineness: float = 0.916):
    """
    FIFO_LOT için yeni stok lotu oluştur
    """
    lot_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    lot_doc = {
        "id": lot_id,
        "product_type_id": product_type_id,
        "product_type_code": product_type_code,
        "karat_id": karat_id,
        "fineness": fineness,
        "supplier_party_id": supplier_party_id,
        "purchase_date": purchase_date,
        "initial_quantity": quantity,
        "remaining_quantity": quantity,
        "unit_cost_has": unit_cost_has,  # HAS/gram
        "labor_cost_has": labor_cost_has,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    
    await db.stock_lots.insert_one(lot_doc)
    logger.info(f"Created stock lot: {lot_id}, qty: {quantity}g, supplier: {supplier_party_id}")
    return lot_doc


async def consume_stock_lots_fifo(db, product_type_id: int, karat_id: int, quantity_to_sell: float):
    """
    FIFO sırasına göre lotlardan stok tüket
    Returns: list of consumed lots with quantities
    """
    # En eski lottan başla (purchase_date sırası)
    lots = await db.stock_lots.find({
        "product_type_id": product_type_id,
        "karat_id": karat_id,
        "status": "ACTIVE",
        "remaining_quantity": {"$gt": 0}
    }).sort("purchase_date", 1).to_list(100)
    
    consumed = []
    remaining_to_sell = quantity_to_sell
    
    for lot in lots:
        if remaining_to_sell <= 0:
            break
            
        lot_remaining = lot.get("remaining_quantity", 0)
        
        if lot_remaining <= 0:
            continue
            
        # Bu lottan ne kadar alabiliriz?
        take_from_lot = min(lot_remaining, remaining_to_sell)
        new_remaining = lot_remaining - take_from_lot
        
        # Lot güncelle
        update_data = {
            "remaining_quantity": new_remaining,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Lot bittiyse DEPLETED yap
        if new_remaining <= 0.001:  # Float toleransı
            update_data["status"] = "DEPLETED"
            update_data["remaining_quantity"] = 0
            
        await db.stock_lots.update_one(
            {"id": lot["id"]},
            {"$set": update_data}
        )
        
        consumed.append({
            "lot_id": lot["id"],
            "supplier_party_id": lot.get("supplier_party_id"),
            "quantity_taken": take_from_lot,
            "unit_cost_has": lot.get("unit_cost_has", 0),
            "lot_depleted": new_remaining <= 0.001
        })
        
        remaining_to_sell -= take_from_lot
        logger.info(f"Consumed {take_from_lot}g from lot {lot['id']}, remaining in lot: {new_remaining}g")
    
    if remaining_to_sell > 0.001:
        raise HTTPException(status_code=400, detail=f"Yetersiz stok! {remaining_to_sell:.2f}g eksik.")
    
    return consumed


async def get_stock_lot_summary(db, product_type_id: int, karat_id: int = None):
    """
    Belirli ürün tipi için lot bazlı stok özeti
    """
    query = {
        "product_type_id": product_type_id,
        "status": "ACTIVE",
        "remaining_quantity": {"$gt": 0}
    }
    if karat_id:
        query["karat_id"] = karat_id
        
    lots = await db.stock_lots.find(query).sort("purchase_date", 1).to_list(100)
    
    total_quantity = sum(lot.get("remaining_quantity", 0) for lot in lots)
    
    return {
        "total_quantity": total_quantity,
        "lot_count": len(lots),
        "lots": [{
            "id": lot["id"],
            "supplier_party_id": lot.get("supplier_party_id"),
            "purchase_date": lot.get("purchase_date"),
            "remaining_quantity": lot.get("remaining_quantity"),
            "unit_cost_has": lot.get("unit_cost_has")
        } for lot in lots]
    }
