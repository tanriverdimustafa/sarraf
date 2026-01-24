"""Sale Service - Create sale transactions"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from bson import ObjectId as BsonObjectId
from fastapi import HTTPException
import logging
import uuid

from services.base_service import (
    parse_transaction_date, round_has, round_currency,
    generate_transaction_code, get_or_create_price_snapshot,
    convert_currency_to_has, convert_has_to_currency,
    write_audit_log, create_cash_movement_internal, set_cash_db,
    create_ledger_entry
)
from services.stock_service import consume_from_stock_pool, consume_stock_lots_fifo

logger = logging.getLogger(__name__)

async def create_sale_transaction(data, user_id: str, db):
    """
    SALE Transaction - Müşteriye ürün satışı (Dokümana %100 uyumlu implementasyon)
    
    İş Akışı (TRANSACTION_V2_MODULE.md):
    1. Party validasyonu
    2. Idempotency kontrolü
    3. Price snapshot al
    4. Her line için:
       - Product validasyonu (SOLD değil mi kontrol)
       - Product cost bilgilerini al (material_has_cost, labor_has_cost, total_cost_has)
       - Sale HAS value ile kar hesapla
       - Product durumunu SOLD yap
    5. Komisyon hesapla (varsa)
    6. İskonto/Borç hesapla (pazarlık)
    7. Transaction dokümanı oluştur (total_has_amount: NEGATIVE - OUT)
    8. Audit log
    
    Yeni Özellikler (Pazarlık/İskonto):
    - expected_amount_tl: Beklenen satış tutarı (TL)
    - actual_amount_tl: Alınan tutar (TL)
    - discount_tl/discount_has: İskonto tutarı
    - customer_debt_has: Müşteri borcu (HAS)
    - is_credit_sale: Veresiye satış mı?
    """
    
    # 1. Validations
    party_id = data.party_id
    if not party_id:
        raise HTTPException(status_code=400, detail="party_id required for SALE transaction")
    
    transaction_date = parse_transaction_date(data.transaction_date)
    
    # Validate party exists
    party = await db.parties.find_one({"id": party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=404, detail=f"Party {party_id} not found or inactive")
    
    # 2. Idempotency check
    if data.idempotency_key:
        existing = await db.financial_transactions.find_one({"idempotency_key": data.idempotency_key})
        if existing:
            logger.warning(f"Duplicate transaction detected: {data.idempotency_key}")
            return {
                "code": existing["code"],
                "type_code": existing["type_code"],
                "party_id": existing["party_id"],
                "transaction_date": existing["transaction_date"].isoformat(),
                "status": existing["status"],
                "total_has_amount": existing["total_has_amount"],
                "currency": existing.get("currency"),
                "total_amount_currency": existing.get("total_amount_currency"),
                "profit_has": existing.get("meta", {}).get("net_profit_has"),
                "notes": existing.get("notes", "")
            }
    
    # 3. Get price snapshot
    snapshot = await get_or_create_price_snapshot(db, transaction_date)
    tx_code = generate_transaction_code(transaction_date)
    
    # 4. Process lines
    if not data.lines or len(data.lines) == 0:
        raise HTTPException(status_code=400, detail="At least one line required for SALE")
    
    processed_lines = []
    total_cost_has = 0.0  # Toplam maliyet (OUT)
    total_sale_has = 0.0  # Toplam satış değeri
    
    for idx, line_input in enumerate(data.lines, 1):
        product_id = line_input.get("product_id")
        sale_quantity = float(line_input.get("quantity", 1) or 1)  # Satış miktarı
        
        if not product_id:
            raise HTTPException(status_code=400, detail=f"Line {idx}: product_id required for SALE")
        
        # Get product
        product = await db.products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Line {idx}: Product {product_id} not found")
        
        # Check product not already fully SOLD
        if product.get("stock_status_id") == 2:
            raise HTTPException(
                status_code=400, 
                detail=f"Line {idx}: Product {product_id} is already SOLD"
            )
        
        # FIFO parçalı satış kontrolü
        track_type = product.get("track_type", "UNIQUE")
        remaining_qty = float(product.get("remaining_quantity", 1) or 1)
        unit_has = float(product.get("unit_has", product.get("total_cost_has", 0)) or 0)
        
        if track_type == "FIFO_LOT":
            # Lot bazlı FIFO satış - stok lotlarından tüket
            product_type_id = product.get("product_type_id")
            karat_id = product.get("karat_id")
            
            try:
                consumed_lots = await consume_stock_lots_fifo(db, product_type_id, karat_id, sale_quantity)
            except HTTPException as e:
                raise HTTPException(status_code=400, detail=f"Line {idx}: {e.detail}")
            
            # Toplam maliyet hesapla (lot bazlı)
            product_cost_has = 0
            for consumed in consumed_lots:
                product_cost_has += consumed["quantity_taken"] * consumed["unit_cost_has"]
            
            sale_has_value = round_has(sale_quantity * unit_has)  # Satış HAS
            
            # Ürün remaining_quantity güncelle
            new_remaining = remaining_qty - sale_quantity
            update_data = {
                "remaining_quantity": new_remaining,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if new_remaining <= 0.001:
                update_data["stock_status_id"] = 2
                update_data["sold_date"] = transaction_date.isoformat()
                update_data["sold_transaction_code"] = tx_code
            
            await db.products.update_one({"id": product_id}, {"$set": update_data})
            
            # Lot bilgilerini line meta'ya ekle
            line_input["consumed_lots"] = consumed_lots
            logger.info(f"FIFO_LOT Sale: {sale_quantity}g from {len(consumed_lots)} lots")
            
        elif track_type == "FIFO":
            # Parçalı satış mümkün
            if sale_quantity > remaining_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {idx}: Satış miktarı ({sale_quantity}) kalan stoktan ({remaining_qty}) fazla olamaz"
                )
            
            # Maliyet HAS = birim maliyet * satış miktarı
            unit_cost_has = product.get("total_cost_has", 0) / remaining_qty if remaining_qty > 0 else 0
            product_cost_has = round_has(unit_cost_has * sale_quantity)
            
            # Satış HAS değeri - frontend'den gelen fiyattan hesapla
            # Eğer line_amount_currency verilmişse onu kullan, yoksa birim HAS * miktar
            line_amount_currency = float(line_input.get("line_amount_currency", 0) or line_input.get("line_total_currency", 0) or 0)
            if line_amount_currency > 0:
                # TL fiyatından HAS hesapla
                sale_has_value = convert_currency_to_has(
                    line_amount_currency,
                    data.currency or "TRY",
                    snapshot,
                    direction="sell"
                )
            else:
                # Birim HAS değerinden hesapla
                sale_has_value = round_has(unit_has * sale_quantity)
            
            logger.info(f"FIFO Sale: cost_has={product_cost_has:.4f}, sale_has={sale_has_value:.4f}, profit={sale_has_value - product_cost_has:.4f}")
            
            # Update remaining_quantity
            new_remaining = remaining_qty - sale_quantity
            update_data = {
                "remaining_quantity": new_remaining,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Tamamı satıldıysa SOLD yap
            if new_remaining <= 0.001:  # Küçük tolerans
                update_data["stock_status_id"] = 2
                update_data["sold_date"] = transaction_date.isoformat()
                update_data["sold_transaction_code"] = tx_code
            
            await db.products.update_one({"id": product_id}, {"$set": update_data})
            logger.info(f"FIFO Sale: Product {product_id}, sold {sale_quantity}, remaining {new_remaining}")
        
        elif track_type == "POOL":
            # POOL satış - havuzdan düş
            product_type_id = product.get("product_type_id")
            karat_id = product.get("karat_id")
            
            try:
                pool_result = await consume_from_stock_pool(db, product_type_id, karat_id, sale_quantity)
            except HTTPException as e:
                raise HTTPException(status_code=400, detail=f"Line {idx}: {e.detail}")
            
            # Maliyet = ortalama maliyet × satılan gram
            product_cost_has = pool_result["consumed_cost"]
            
            # Satış HAS değeri = gram × milyem + işçilik
            # Frontend'den gelen fineness değerini kullan, yoksa karat'tan al
            fineness = float(line_input.get("fineness", 0) or 0)
            if fineness <= 0:
                # Karat tablosundan milyem değerini al
                karat_doc = await db.karats.find_one({"id": karat_id})
                fineness = karat_doc.get("fineness", 0.916) if karat_doc else 0.916
            
            # İşçilik: line'dan gelen toplam labor_has_value (zaten gram * işçilik hesaplanmış)
            labor_has = float(line_input.get("labor_has_value", 0) or 0)
            
            # Satış HAS = (gram × milyem) + işçilik HAS
            material_has = sale_quantity * fineness
            sale_has_value = round_has(material_has + labor_has)
            
            logger.info(f"POOL Sale HAS calculation: {sale_quantity}g × {fineness} + {labor_has} = {sale_has_value}")
            
            # Ürün remaining_quantity güncelle
            new_remaining = pool_result["remaining_weight"]
            update_data = {
                "remaining_quantity": new_remaining,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if new_remaining <= 0.001:
                update_data["stock_status_id"] = 2
                update_data["sold_date"] = transaction_date.isoformat()
                update_data["sold_transaction_code"] = tx_code
            
            await db.products.update_one({"id": product_id}, {"$set": update_data})
            
            # Pool bilgilerini line meta'ya ekle
            line_input["pool_info"] = pool_result
            logger.info(f"POOL Sale: {sale_quantity}g, cost: {product_cost_has:.4f} HAS, remaining pool: {new_remaining}g")
            
        else:
            # UNIQUE - tam satış
            new_remaining = 0  # UNIQUE için kalan 0
            sale_quantity = 1  # UNIQUE için her zaman 1
            product_cost_has = product.get("total_cost_has", 0.0)
            
            # Satış HAS değeri - frontend'den gelen fiyattan hesapla
            line_amount_currency = float(line_input.get("line_amount_currency", 0) or line_input.get("line_total_currency", 0) or 0)
            if line_amount_currency > 0:
                # TL fiyatından HAS hesapla
                sale_has_value = convert_currency_to_has(
                    line_amount_currency,
                    data.currency or "TRY",
                    snapshot,
                    direction="sell"
                )
            else:
                # Ürün kaydındaki değeri kullan
                sale_has_value = product.get("sale_has_value", 0.0)
            
            logger.info(f"UNIQUE Sale: cost_has={product_cost_has:.4f}, sale_has={sale_has_value:.4f}, profit={sale_has_value - product_cost_has:.4f}")
            
            # Mark product as SOLD
            await db.products.update_one(
                {"id": product_id},
                {"$set": {
                    "stock_status_id": 2,  # SOLD
                    "remaining_quantity": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "sold_date": transaction_date.isoformat(),
                    "sold_transaction_code": tx_code
                }}
            )
        
        # Get cost values from product
        material_has = product.get("material_has_cost", 0.0)
        labor_has = product.get("labor_has_cost", 0.0)
        
        # Calculate profit for this line
        line_profit_has = round_has(sale_has_value - product_cost_has)
        
        # Build line document
        line_doc = {
            "_id": BsonObjectId(),
            "line_no": idx,
            "line_kind": "INVENTORY",
            "product_id": product_id,
            "sku": product.get("barcode"),
            "product_type_code": product.get("product_type_code"),
            "karat_id": product.get("karat_id"),
            "fineness": product.get("fineness"),
            "weight_gram": product.get("weight_gram"),
            "labor_type_code": product.get("labor_type_code"),
            "labor_has_value": product.get("labor_has_value"),
            "material_has": round_has(material_has),
            "labor_has": round_has(labor_has),
            "line_total_has": round_has(sale_has_value),  # SALE PRICE (not cost!)
            "quantity": sale_quantity,
            "unit_has": unit_has,
            "track_type": track_type,
            "unit_price_currency": line_input.get("unit_price_currency"),
            "line_amount_currency": line_input.get("line_amount_currency"),
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": line_input.get("note", ""),
            "meta": {
                "sale_has_value": sale_has_value,
                "product_cost_has": product_cost_has,
                "line_profit_has": line_profit_has,
                "sale_quantity": sale_quantity,
                "remaining_quantity_after": new_remaining if track_type == "FIFO" else 0
            }
        }
        
        processed_lines.append(line_doc)
        total_cost_has += product_cost_has
        total_sale_has += sale_has_value
    
    # 5. Commission calculation
    commission_amount_currency = 0.0
    commission_has_amount = 0.0
    
    if data.payment_method_code and data.total_amount_currency:
        payment_method = await db.payment_methods.find_one({"code": data.payment_method_code})
        if payment_method and payment_method.get("commission_rate", 0) > 0:
            commission_amount_currency = round_currency(
                data.total_amount_currency * payment_method["commission_rate"]
            )
            commission_has_amount = convert_currency_to_has(
                commission_amount_currency,
                data.currency or "TRY",
                snapshot,
                direction="sell"
            )
            
            # Add FEE line (negative impact on profit)
            fee_line = {
                "_id": BsonObjectId(),
                "line_no": len(processed_lines) + 1,
                "line_kind": "FEE",
                "product_id": None,
                "sku": None,
                "product_type_code": None,
                "karat_id": None,
                "fineness": None,
                "weight_gram": None,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 0.0,
                "labor_has": 0.0,
                "line_total_has": -commission_has_amount,
                "quantity": 1,
                "unit_price_currency": -commission_amount_currency,
                "line_amount_currency": -commission_amount_currency,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": f"Ödeme komisyonu - {payment_method.get('name', data.payment_method_code)}",
                "meta": {
                    "commission_rate": payment_method["commission_rate"],
                    "payment_method": data.payment_method_code
                }
            }
            processed_lines.append(fee_line)
    
    # 6. Discount/Debt calculation (Pazarlık)
    # Get discount and debt values from request (calculated by frontend)
    expected_amount_tl = getattr(data, 'expected_amount_tl', None) or (data.meta.get('expected_amount_tl') if data.meta else None) or 0.0
    actual_amount_tl = getattr(data, 'actual_amount_tl', None) or (data.meta.get('actual_amount_tl') if data.meta else None) or (data.total_amount_currency or 0.0)
    discount_tl = getattr(data, 'discount_tl', None) or (data.meta.get('discount_tl') if data.meta else None) or 0.0
    discount_has = getattr(data, 'discount_has', None) or (data.meta.get('discount_has') if data.meta else None) or 0.0
    customer_debt_has = getattr(data, 'customer_debt_has', None) or (data.meta.get('customer_debt_has') if data.meta else None) or 0.0
    is_credit_sale = getattr(data, 'is_credit_sale', None) or (data.meta.get('is_credit_sale') if data.meta else None) or False
    collected_has = getattr(data, 'collected_has', None) or (data.meta.get('collected_has') if data.meta else None) or 0.0
    has_price_used = getattr(data, 'has_price_used', None) or (data.meta.get('has_price_used') if data.meta else None) or snapshot.get('has_sell_tl', 0)
    
    # Add DISCOUNT line if applicable
    if discount_has > 0.001:
        discount_line = {
            "_id": BsonObjectId(),
            "line_no": len(processed_lines) + 1,
            "line_kind": "DISCOUNT",
            "product_id": None,
            "sku": None,
            "product_type_code": None,
            "karat_id": None,
            "fineness": None,
            "weight_gram": None,
            "labor_type_code": None,
            "labor_has_value": None,
            "material_has": 0.0,
            "labor_has": 0.0,
            "line_total_has": round_has(discount_has),  # Positive (reduces what customer owes)
            "quantity": 1,
            "unit_price_currency": discount_tl,
            "line_amount_currency": discount_tl,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": f"İskonto - Pazarlık",
            "meta": {
                "discount_tl": discount_tl,
                "discount_has": discount_has,
                "discount_percentage": round((discount_tl / expected_amount_tl * 100) if expected_amount_tl > 0 else 0, 2)
            }
        }
        processed_lines.append(discount_line)
    
    # Calculate profit (adjusted for discount)
    gross_profit_has = round_has(total_sale_has - total_cost_has)
    # Discount reduces our profit
    adjusted_profit_has = round_has(gross_profit_has - discount_has)
    net_profit_has = round_has(adjusted_profit_has - commission_has_amount)
    
    # Convert profit to currency for reporting
    net_profit_currency = convert_has_to_currency(
        net_profit_has,
        data.currency or "TRY",
        snapshot,
        direction="sell"
    )
    
    # Effective HAS amount (what we actually received in HAS terms)
    # If there's debt, the total_has_amount still reflects full sale value (negative)
    # but customer_debt_has tracks what they still owe
    effective_sale_has = round_has(total_sale_has - discount_has)
    
    # 7. Build transaction document
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "code": tx_code,
        "type_code": "SALE",
        "party_id": party_id,
        "counterparty_id": None,
        "transaction_date": transaction_date,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "status": "COMPLETED",
        "total_has_amount": -round_has(effective_sale_has),  # NEGATIVE (HAS OUT - after discount!)
        "profit_has": net_profit_has,  # KÂR - satış anında hesaplanır, ödeme durumuna bakılmaz
        "currency": data.currency,
        "total_amount_currency": round_currency(actual_amount_tl) if actual_amount_tl else None,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": data.payment_method_code,
        "commission_amount_currency": commission_amount_currency,
        "commission_has_amount": commission_has_amount,
        "lines": processed_lines,
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": data.notes or "",
        "meta": {
            "total_cost_has": round_has(total_cost_has),
            "total_sale_has": round_has(total_sale_has),
            "gross_profit_has": gross_profit_has,
            "commission_has": commission_has_amount,
            "net_profit_has": net_profit_has,
            "net_profit_currency": net_profit_currency,
            # New discount/debt fields
            "expected_amount_tl": expected_amount_tl,
            "actual_amount_tl": actual_amount_tl,
            "discount_tl": discount_tl,
            "discount_has": discount_has,
            "customer_debt_has": customer_debt_has,
            "collected_has": collected_has,
            "is_credit_sale": is_credit_sale,
            "has_price_used": has_price_used,
            "effective_sale_has": effective_sale_has
        },
        "version": 1
    }
    
    # idempotency_key sadece değer varsa ekle (sparse index için field missing olmalı)
    if data.idempotency_key:
        transaction_doc["idempotency_key"] = data.idempotency_key
    
    # ==================== MÜŞTERİ BALANCE GÜNCELLEME (SALE) ====================
    # Satış yaptık = müşteri bize borçlandı
    # effective_sale_has: Satış tutarı (iskonto sonrası)
    # Negatif balance = karşı taraf bize borçlu
    # 
    # DURUMLAR:
    # 1. Veresiye satış: Müşteri tam borçlanır (-effective_sale_has)
    # 2. Peşin satış: Müşteri anında ödedi, borç yok (collected_has = effective_sale_has)
    # 3. Kısmi ödeme: Müşteri sadece customer_debt_has kadar borçlanır
    #
    # Eğer müşteri anında ödeme yaptıysa (collected_has > 0), kasa hareketi zaten oluşturulacak
    # Party balance sadece BORÇ kısmını tutar
    if party_id and customer_debt_has > 0.001:
        # Sadece ödenmeyen kısım borç olarak yazılır
        await db.parties.update_one(
            {"id": party_id},
            {
                "$inc": {"has_balance": -customer_debt_has},  # Negatif = müşteri bize borçlu
                "$set": {"updated_at": now.isoformat()}
            }
        )
        logger.info(f"Updated party {party_id} HAS balance by -{customer_debt_has} (SALE - customer owes us)")
    
    # Insert to database
    result = await db.financial_transactions.insert_one(transaction_doc)
    
    # 8. Audit log
    await write_audit_log(
        db, "financial_transactions", result.inserted_id,
        "CREATE", user_id, {"before": None, "after": transaction_doc}
    )
    
    # 9. Create cash movement if cash_register_id provided
    cash_register_id = getattr(data, 'cash_register_id', None) or (data.meta.get('cash_register_id') if hasattr(data, 'meta') and data.meta else None)
    
    # DÖVİZ BİLGİLERİ
    payment_currency = getattr(data, 'payment_currency', None) or 'TRY'
    foreign_amount = getattr(data, 'foreign_amount', None)
    exchange_rate = getattr(data, 'exchange_rate', None)
    
    if cash_register_id and actual_amount_tl and actual_amount_tl > 0:
        try:
            # Set db for cash management module
            set_cash_db(db)
            
            # Get cash register to determine currency
            cash_register = await db.cash_registers.find_one({"id": cash_register_id, "is_active": True})
            if cash_register:
                # Get product names for description
                product_names = []
                for line in processed_lines[:3]:  # Max 3 products in description
                    if line.get("line_kind") == "PRODUCT" and line.get("sku"):
                        product_names.append(line.get("sku"))
                
                products_str = ", ".join(product_names) if product_names else "Ürün"
                party_name = party.get("name", "Müşteri")
                
                # DÖVİZ İLE ÖDEME İSE
                if payment_currency in ['USD', 'EUR'] and foreign_amount and foreign_amount > 0:
                    # Döviz kasasına döviz tutarı GİRİŞ
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="IN",
                        amount=float(foreign_amount),  # Döviz tutarı (283 USD gibi)
                        currency=payment_currency,  # USD veya EUR
                        reference_type="SALE",
                        reference_id=tx_code,
                        description=f"Satış tahsilatı - {party_name} - {foreign_amount} {payment_currency}",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"Cash movement created for SALE {tx_code}: +{foreign_amount} {payment_currency} to {cash_register_id}")
                else:
                    # Normal TL ödeme
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="IN",
                        amount=actual_amount_tl,
                        currency=cash_register.get("currency", "TRY"),
                        reference_type="SALE",
                        reference_id=tx_code,
                        description=f"Satış tahsilatı - {party_name} - {products_str}",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"Cash movement created for SALE {tx_code}: +{actual_amount_tl} TL to {cash_register_id}")
        except Exception as e:
            logger.error(f"Failed to create cash movement for SALE {tx_code}: {e}")
            # Don't fail the transaction, just log the error
    
    logger.info(f"SALE transaction created: {tx_code}, Party: {party_id}, Net Profit HAS: {net_profit_has}, Discount HAS: {discount_has}, Debt HAS: {customer_debt_has}")
    
    # ==================== UNIFIED LEDGER KAYDI (SALE) ====================
    try:
        # Party bilgilerini al
        party_doc = await db.parties.find_one({"id": party_id}) if party_id else None
        party_name_for_ledger = party_doc.get("name") if party_doc else None
        party_type_id_val = party_doc.get("party_type_id") if party_doc else None
        ledger_party_type = "CUSTOMER" if party_type_id_val == 1 else "SUPPLIER" if party_type_id_val == 2 else None
        
        # Kasa bilgisi
        register = await db.cash_registers.find_one({"id": cash_register_id}) if cash_register_id else None
        register_name = register.get("name") if register else None
        
        # Ürün bilgisi (ilk line'dan)
        first_line = processed_lines[0] if processed_lines else None
        ledger_product_id = first_line.get("product_id") if first_line else None
        ledger_product_name = first_line.get("product_name") if first_line else None
        
        # TL bazlı maliyet ve kar hesaplama
        # cost_tl = Maliyet HAS * HAS Satış Fiyatı
        has_sell_price = snapshot.get('has_sell_tl', 0) or has_price_used or 0
        cost_tl = total_cost_has * has_sell_price if has_sell_price > 0 else 0
        
        # profit_tl = Alınan TL - Maliyet TL
        profit_tl = (actual_amount_tl or 0) - cost_tl
        
        await create_ledger_entry(
            entry_type="SALE",
            transaction_date=now,
            
            # Satışta HAS çıkışı (ürün veriyoruz)
            has_in=0.0,
            has_out=abs(effective_sale_has),
            
            # Para girişi
            currency=data.currency or "TRY",
            amount_in=actual_amount_tl or 0.0,
            amount_out=0.0,
            
            # Kar/Zarar (HAS ve TL)
            cost_has=total_cost_has,
            cost_tl=cost_tl,
            profit_has=net_profit_has,
            profit_tl=profit_tl,
            discount_has=discount_has if discount_has else None,
            commission_has=commission_has_amount if commission_has_amount else None,
            
            # Taraflar
            party_id=party_id,
            party_name=party_name_for_ledger,
            party_type=ledger_party_type,
            
            # Kasa
            cash_register_id=cash_register_id,
            cash_register_name=register_name,
            
            # Ürün
            product_id=ledger_product_id,
            product_name=ledger_product_name,
            weight_gram=sum(line.get("weight_gram", 0) or 0 for line in processed_lines),
            
            # Referans
            reference_type="financial_transactions",
            reference_id=tx_code,
            
            description=f"Satış: {len(processed_lines)} ürün",
            created_by=user_id
        )
        logger.info(f"✅ Unified ledger entry created for SALE: {tx_code}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for SALE {tx_code}: {e}")
        # Ledger hatası ana işlemi engellemez
    
    # Return response
    return {
        "code": transaction_doc["code"],
        "type_code": transaction_doc["type_code"],
        "party_id": transaction_doc["party_id"],
        "transaction_date": transaction_doc["transaction_date"].isoformat(),
        "status": transaction_doc["status"],
        "total_has_amount": transaction_doc["total_has_amount"],
        "profit_has": net_profit_has,  # Satış kârı
        "currency": transaction_doc["currency"],
        "total_amount_currency": transaction_doc["total_amount_currency"],
        "net_profit_has": net_profit_has,
        "net_profit_currency": net_profit_currency,
        "discount_tl": discount_tl,
        "discount_has": discount_has,
        "customer_debt_has": customer_debt_has,
        "is_credit_sale": is_credit_sale,
        "notes": transaction_doc["notes"]
    }


# ==================== PAYMENT TRANSACTION ====================

