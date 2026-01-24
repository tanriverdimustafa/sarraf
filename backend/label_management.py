from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
label_router = APIRouter(prefix="/api/labels", tags=["Labels"])
db = None

def set_database(database):
    global db
    db = database

class LabelGenerateRequest(BaseModel):
    product_ids: List[str]
    quantity_each: int = 1

class ShopNameRequest(BaseModel):
    shop_name: str

async def get_supplier_name(supplier_party_id: str) -> str:
    if not supplier_party_id:
        return ""
    party = await db.parties.find_one({"id": supplier_party_id}, {"name": 1, "_id": 0})
    if party:
        return party.get("name", "")[:8]
    return ""

def generate_jewelry_label_zpl(product: dict, shop_name: str, supplier_name: str, quantity: int = 1) -> str:
    # Urun bilgileri
    barcode = product.get("barcode", product.get("id", ""))
    product_code = barcode[-4:] if len(barcode) > 4 else barcode
    
    # Tarih
    created = product.get("created_at", "")
    if created:
        try:
            date_str = created[:10]
            date_parts = date_str.split("-")
            date_display = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0][2:]}"
        except:
            date_display = datetime.now().strftime("%d-%m-%y")
    else:
        date_display = datetime.now().strftime("%d-%m-%y")
    
    gram = float(product.get("weight_gram", 0) or 0)
    
    # Karat bilgisi
    karat_id = product.get("karat_id")
    karat_display = ""
    fineness = product.get("fineness", 0)
    if karat_id == 1: karat_display = "24K"
    elif karat_id == 2: karat_display = "22K"
    elif karat_id == 3: karat_display = "18K"
    elif karat_id == 4: karat_display = "14K"
    elif fineness:
        if fineness >= 0.99: karat_display = "24K"
        elif fineness >= 0.90: karat_display = "22K"
        elif fineness >= 0.74: karat_display = "18K"
        elif fineness >= 0.58: karat_display = "14K"
    
    # HAS degerleri (2 ondalik)
    cost_has = float(product.get("total_cost_has", 0) or product.get("material_has_cost", 0) or 0)
    sale_has = float(product.get("sale_has_value", 0) or 0)
    labor_has = float(product.get("labor_has_cost", 0) or 0)
    
    # Tedarikci (max 8 karakter)
    supplier_short = supplier_name[:8] if supplier_name else ""
    
    # Shop name (max 8 karakter)
    shop_display = (shop_name or "TKGold")[:8]

    # ZPL kodu
    zpl = f"""^XA
^PW576
^LL100
^MD30
^FO24,32^BXN,3,200^FD{barcode}^FS
^FO85,34^A0N,18,14^FD{product_code}^FS
^FO85,56^A0N,14,12^FD{date_display}^FS
^FO170,29^A0N,16,14^FD{shop_display}^FS
^FO170,44^A0N,14,12^FD{gram:.2f}g {karat_display}^FS
^FO170,58^A0N,13,11^FDM:{cost_has:.2f} S:{sale_has:.2f}^FS
^FO170,71^A0N,13,11^FDI:{labor_has:.2f} T:{supplier_short}^FS
^PQ{quantity}
^XZ"""
    return zpl.strip()

async def generate_multiple_labels_zpl(products: List[dict], shop_name: str, quantity_each: int = 1) -> str:
    zpl_parts = []
    for product in products:
        supplier_name = await get_supplier_name(product.get("supplier_party_id", ""))
        zpl = generate_jewelry_label_zpl(product, shop_name, supplier_name, quantity_each)
        zpl_parts.append(zpl)
    return "\n\n".join(zpl_parts)

@label_router.post("/generate")
async def generate_labels(request: LabelGenerateRequest):
    if not request.product_ids:
        raise HTTPException(status_code=400, detail="En az bir urun secilmelidir")
    if request.quantity_each < 1 or request.quantity_each > 99:
        raise HTTPException(status_code=400, detail="Adet 1-99 arasinda olmalidir")
    
    settings = await db.settings.find_one({"key": "shop_name"})
    shop_name = settings.get("value", "TKGold") if settings else "TKGold"
    
    products = []
    for pid in request.product_ids:
        product = await db.products.find_one({"id": pid}, {"_id": 0})
        if product:
            products.append(product)
    
    if not products:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    
    zpl = await generate_multiple_labels_zpl(products, shop_name, request.quantity_each)
    logger.info(f"Generated labels for {len(products)} products, {request.quantity_each} each")
    
    return {
        "zpl": zpl,
        "count": len(products),
        "quantity_each": request.quantity_each,
        "total_labels": len(products) * request.quantity_each,
        "shop_name": shop_name
    }

@label_router.get("/preview/{product_id}")
async def preview_label(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Urun bulunamadi")
    
    settings = await db.settings.find_one({"key": "shop_name"})
    shop_name = settings.get("value", "TKGold") if settings else "TKGold"
    
    karat_id = product.get("karat_id")
    karat_display = ""
    fineness = product.get("fineness", 0)
    if karat_id == 1: karat_display = "24K"
    elif karat_id == 2: karat_display = "22K"
    elif karat_id == 3: karat_display = "18K"
    elif karat_id == 4: karat_display = "14K"
    elif fineness:
        if fineness >= 0.99: karat_display = "24K"
        elif fineness >= 0.90: karat_display = "22K"
        elif fineness >= 0.74: karat_display = "18K"
        elif fineness >= 0.58: karat_display = "14K"
    
    return {
        "product_id": product_id,
        "product_code": product.get("barcode", product_id)[:18],
        "product_name": product.get("name", ""),
        "shop_name": shop_name,
        "weight_gram": float(product.get("weight_gram", 0) or 0),
        "karat": karat_display,
        "cost_has": float(product.get("total_cost_has", 0) or 0),
        "sale_has": float(product.get("sale_has_value", 0) or 0),
        "labor_has": float(product.get("labor_has_cost", 0) or 0)
    }

@label_router.get("/settings/shop-name")
async def get_shop_name():
    settings = await db.settings.find_one({"key": "shop_name"})
    return {"shop_name": settings.get("value", "TKGold") if settings else "TKGold"}

@label_router.put("/settings/shop-name")
async def update_shop_name(request: ShopNameRequest):
    if not request.shop_name or len(request.shop_name.strip()) < 1:
        raise HTTPException(status_code=400, detail="Dukkan adi bos olamaz")
    shop_name = request.shop_name.strip()[:50]
    await db.settings.update_one(
        {"key": "shop_name"},
        {"$set": {"key": "shop_name", "value": shop_name, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    logger.info(f"Shop name updated to: {shop_name}")
    return {"shop_name": shop_name, "message": "Dukkan adi guncellendi"}