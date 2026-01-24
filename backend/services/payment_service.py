"""Payment Service - Create payment transactions"""
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

logger = logging.getLogger(__name__)

async def create_payment_transaction(data, user_id: str, db):
    """
    PAYMENT Transaction - Ödeme yapma (HAS OUT) (Dokümana %100 uyumlu)
    
    İş Akışı (TRANSACTION_V2_MODULE.md):
    1. Party validasyonu (zorunlu)
    2. Idempotency kontrolü
    3. Price snapshot al
    4. Currency → HAS çevirimi (direction: "buy" - biz ödeme yapıyoruz)
    5. İskonto/Kısmi ödeme hesapla
    6. PAYMENT line oluştur
    7. Transaction dokümanı (total_has_amount: NEGATIVE - OUT)
    8. Party balance güncelle
    9. Audit log
    
    Not: PAYMENT = Party balance OUT (HAS negatif)
    
    İskonto Özelliği:
    - expected_amount_tl: Beklenen ödeme tutarı (borcumuz)
    - actual_amount_tl: Gerçek ödenen tutar
    - discount_tl/discount_has: Alınan iskonto tutarı
    - remaining_debt_has: Kalan borç (kısmi ödeme)
    """
    
    # 1. Validations
    party_id = data.party_id
    if not party_id:
        raise HTTPException(status_code=400, detail="party_id required for PAYMENT transaction")
    
    transaction_date = parse_transaction_date(data.transaction_date)
    currency = data.currency or "TRY"
    amount_currency = data.total_amount_currency
    payment_method = data.payment_method_code
    
    # Check if this is Gold Scrap payment
    is_gold_scrap = payment_method == "GOLD_SCRAP"
    scrap_lines_data = getattr(data, 'scrap_lines', None) if is_gold_scrap else None
    
    if not is_gold_scrap:
        # Normal payment - amount required
        if not amount_currency or amount_currency <= 0:
            raise HTTPException(status_code=400, detail="total_amount_currency required and must be positive for PAYMENT")
    else:
        # Gold scrap payment - scrap_lines required
        if not scrap_lines_data or len(scrap_lines_data) == 0:
            raise HTTPException(status_code=400, detail="scrap_lines required for GOLD_SCRAP payment")
    
    # Validate party exists
    party = await db.parties.find_one({"id": party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=404, detail=f"Party {party_id} not found or inactive")
    
    # 2. Idempotency check
    if data.idempotency_key:
        existing = await db.financial_transactions.find_one({"idempotency_key": data.idempotency_key})
        if existing:
            logger.warning(f"Duplicate PAYMENT transaction detected: {data.idempotency_key}")
            return {
                "code": existing["code"],
                "type_code": existing["type_code"],
                "party_id": existing["party_id"],
                "transaction_date": existing["transaction_date"].isoformat(),
                "status": existing["status"],
                "total_has_amount": existing["total_has_amount"],
                "currency": existing.get("currency"),
                "total_amount_currency": existing.get("total_amount_currency"),
                "notes": existing.get("notes", "")
            }
    
    # 3. Get price snapshot
    snapshot = await get_or_create_price_snapshot(db, transaction_date)
    tx_code = generate_transaction_code(transaction_date)
    
    # 4. Get discount/partial payment fields from request
    expected_amount_tl = getattr(data, 'expected_amount_tl', None) or (data.meta.get('expected_amount_tl') if data.meta else None) or 0.0
    actual_amount_tl = getattr(data, 'actual_amount_tl', None) or (data.meta.get('actual_amount_tl') if data.meta else None) or amount_currency
    discount_tl = getattr(data, 'discount_tl', None) or (data.meta.get('discount_tl') if data.meta else None) or 0.0
    discount_has = getattr(data, 'discount_has', None) or (data.meta.get('discount_has') if data.meta else None) or 0.0
    paid_has = getattr(data, 'paid_has', None) or (data.meta.get('paid_has') if data.meta else None) or 0.0
    remaining_debt_has = getattr(data, 'remaining_debt_has', None) or (data.meta.get('remaining_debt_has') if data.meta else None) or 0.0
    is_discount = getattr(data, 'is_discount', None) or (data.meta.get('is_discount') if data.meta else None) or False
    has_price_used = getattr(data, 'has_price_used', None) or (data.meta.get('has_price_used') if data.meta else None) or snapshot.get('has_sell_tl', 0)
    our_debt_has = getattr(data, 'our_debt_has', None) or (data.meta.get('our_debt_has') if data.meta else None) or 0.0
    
    # 5. Process lines based on payment method
    lines = []
    total_has_amount = 0.0
    
    if is_gold_scrap:
        # Process Gold Scrap lines
        for idx, scrap_line in enumerate(scrap_lines_data):
            karat_id = scrap_line.get('karat_id')
            weight_gram = scrap_line.get('weight_gram')
            fineness = scrap_line.get('fineness')
            has_amount = scrap_line.get('has_amount')
            
            # Validate karat
            karat = await db.karats.find_one({"id": karat_id})
            if not karat:
                raise HTTPException(status_code=400, detail=f"Invalid karat_id: {karat_id}")
            
            line_doc = {
                "_id": BsonObjectId(),
                "line_no": idx + 1,
                "line_kind": "GOLD_SCRAP_PAYMENT",
                "product_id": None,
                "sku": None,
                "product_type_code": "GOLD_SCRAP",
                "karat_id": karat_id,
                "fineness": fineness,
                "weight_gram": weight_gram,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": round_has(has_amount),
                "labor_has": 0.0,
                "line_total_has": round_has(has_amount),
                "quantity": 1,
                "unit_price_currency": None,
                "line_amount_currency": None,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": f"Hurda altın ödeme: {karat.get('karat')} - {weight_gram}gr",
                "meta": {
                    "karat_name": karat.get("karat"),
                    "calculated_has": has_amount
                }
            }
            lines.append(line_doc)
            total_has_amount += has_amount
            
            # HURDA STOKTAN DÜŞ - Products tablosundan FIFO ile düş (Havuz DEĞİL!)
            # Karat/fineness'a göre doğru hurda tipini bul
            hurda_product_type = await db.product_types.find_one({
                "group": "HURDA",
                "milyem": fineness
            })
            
            if not hurda_product_type:
                hurda_product_type = await db.product_types.find_one({"code": "GOLD_SCRAP"})
            
            if hurda_product_type:
                hurda_product_type_id = hurda_product_type["id"]
                logger.info(f"GOLD_SCRAP PAYMENT: Using product_type {hurda_product_type_id} ({hurda_product_type.get('name')}) for fineness {fineness}")
                
                # Hurda stoğunu PRODUCTS tablosundan kontrol et
                scrap_pipeline = [
                    {"$match": {
                        "product_type_id": hurda_product_type_id,
                        "karat_id": karat_id,
                        "stock_status_id": 1,  # IN_STOCK
                        "$or": [
                            {"remaining_quantity": {"$gt": 0}},
                            {"weight_gram": {"$gt": 0}}
                        ]
                    }},
                    {"$group": {
                        "_id": None,
                        "total": {"$sum": {"$ifNull": ["$remaining_quantity", "$weight_gram"]}}
                    }}
                ]
                scrap_stock = await db.products.aggregate(scrap_pipeline).to_list(1)
                total_scrap = scrap_stock[0]["total"] if scrap_stock else 0
                
                logger.info(f"GOLD_SCRAP PAYMENT: Available scrap stock = {total_scrap}g, requested = {weight_gram}g")
                
                if total_scrap < weight_gram:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Yetersiz hurda stoku: {total_scrap:.2f}g mevcut, {weight_gram:.2f}g istendi"
                    )
                
                # FIFO ile stoktan düş
                remaining_to_deduct = weight_gram
                scrap_products = await db.products.find({
                    "product_type_id": hurda_product_type_id,
                    "karat_id": karat_id,
                    "stock_status_id": 1,
                    "$or": [
                        {"remaining_quantity": {"$gt": 0}},
                        {"weight_gram": {"$gt": 0}}
                    ]
                }).sort("created_at", 1).to_list(None)  # FIFO - eskiden yeniye
                
                for product in scrap_products:
                    if remaining_to_deduct <= 0:
                        break
                    
                    available = product.get("remaining_quantity") or product.get("weight_gram", 0)
                    to_deduct = min(available, remaining_to_deduct)
                    new_remaining = available - to_deduct
                    
                    update_fields = {
                        "remaining_quantity": new_remaining,
                        "weight_gram": new_remaining,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    if new_remaining <= 0:
                        update_fields["stock_status_id"] = 2  # SOLD
                    
                    await db.products.update_one(
                        {"id": product["id"]},
                        {"$set": update_fields}
                    )
                    
                    logger.info(f"GOLD_SCRAP PAYMENT: Deducted {to_deduct}g from product {product['id']}, remaining: {new_remaining}g")
                    remaining_to_deduct -= to_deduct
                
                # Stock pool'u da güncelle (senkronizasyon için)
                pool = await db.stock_pools.find_one({
                    "product_type_id": hurda_product_type_id,
                    "karat_id": karat_id
                })
                if pool:
                    new_pool_weight = max(0, pool.get("total_weight", 0) - weight_gram)
                    new_pool_cost = max(0, pool.get("total_cost_has", 0) - (weight_gram * pool.get("avg_cost_per_gram", 0)))
                    await db.stock_pools.update_one(
                        {"id": pool["id"]},
                        {"$set": {
                            "total_weight": new_pool_weight,
                            "total_cost_has": new_pool_cost,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"GOLD_SCRAP PAYMENT: Updated stock_pool, new weight: {new_pool_weight}g")
        
        # Calculate TL equivalent for total
        amount_currency = total_has_amount * snapshot.get("has_sell_tl", 0)
    else:
        # Normal payment - use paid_has if provided, otherwise convert
        if paid_has and abs(paid_has) > 0:
            has_amount = abs(paid_has)
        else:
            has_amount = convert_currency_to_has(
                amount_currency,
                currency,
                snapshot,
                direction="buy"
            )
        total_has_amount = has_amount
        
        # Build PAYMENT line
        payment_line = {
            "_id": BsonObjectId(),
            "line_no": 1,
            "line_kind": "PAYMENT",
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
            "line_total_has": round_has(has_amount),
            "quantity": 1,
            "unit_price_currency": amount_currency,
            "line_amount_currency": amount_currency,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": data.notes or f"{currency} ödeme yapıldı",
            "meta": {
                "payment_currency": currency,
                "payment_amount": amount_currency
            }
        }
        lines.append(payment_line)
    
    # Add DISCOUNT line if applicable
    if discount_has > 0.001:
        discount_line = {
            "_id": BsonObjectId(),
            "line_no": len(lines) + 1,
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
            "line_total_has": round_has(discount_has),  # Positive (closes our debt without payment)
            "quantity": 1,
            "unit_price_currency": discount_tl,
            "line_amount_currency": discount_tl,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": f"İskonto - Tedarikçi indirimi",
            "meta": {
                "discount_tl": discount_tl,
                "discount_has": discount_has,
                "discount_percentage": round((discount_tl / expected_amount_tl * 100) if expected_amount_tl > 0 else 0, 2)
            }
        }
        lines.append(discount_line)
    
    # Total debt being closed (paid + discount)
    total_closed_has = total_has_amount + discount_has
    
    # 6. Calculate profit/loss for PAYMENT
    # Hurda ile ödeme yapıldıysa: Kapatılan borç - Verilen hurda HAS = Kâr/Zarar
    # Pozitif = Kâr (az verdik), Negatif = Zarar (fazla verdik)
    payment_profit_has = 0
    total_scrap_has = 0
    
    if is_gold_scrap and lines:
        # Hurda satırlarının toplam HAS değeri
        total_scrap_has = sum(
            line.get("line_total_has", 0) 
            for line in lines 
            if line.get("line_kind") == "GOLD_SCRAP_PAYMENT"
        )
        
        if total_scrap_has > 0 and our_debt_has > 0:
            # Kapatılan borç - Verilen hurda = Kâr/Zarar
            # our_debt_has: Tedarikçiye olan borcumuz
            # total_scrap_has: Verdiğimiz hurda değeri
            payment_profit_has = round_has(our_debt_has - total_scrap_has)
            logger.info(f"GOLD_SCRAP PAYMENT profit calc: debt={our_debt_has}, scrap={total_scrap_has}, profit={payment_profit_has}")
    else:
        # Normal ödeme - iskonto varsa kâr
        if discount_has > 0.001:
            payment_profit_has = round_has(discount_has)  # İskonto = Kâr
    
    # 7. Build transaction document
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "code": tx_code,
        "type_code": "PAYMENT",
        "party_id": party_id,
        "counterparty_id": None,
        "transaction_date": transaction_date,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "status": "COMPLETED",
        "total_has_amount": -round_has(total_closed_has),  # NEGATIVE (HAS OUT) - total debt being closed
        "profit_has": payment_profit_has,  # Hurda ödeme kâr/zararı veya iskonto kârı
        "currency": currency,
        "total_amount_currency": round_currency(amount_currency),
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": data.payment_method_code,
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": lines,
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": data.notes or f"{currency} ödeme - {party.get('name', party_id)}",
        "meta": {
            "payment_direction": "OUT",
            "expected_amount_tl": expected_amount_tl,
            "actual_amount_tl": actual_amount_tl,
            "discount_tl": discount_tl,
            "discount_has": discount_has,
            "paid_has": total_has_amount,
            "remaining_debt_has": remaining_debt_has,
            "is_discount": is_discount,
            "has_price_used": has_price_used,
            "our_debt_has": our_debt_has,
            "total_closed_has": total_closed_has,
            "total_scrap_has": total_scrap_has,
            "profit_has": payment_profit_has
        },
        "version": 1
    }
    
    # idempotency_key sadece değer varsa ekle (sparse index için field missing olmalı)
    if data.idempotency_key:
        transaction_doc["idempotency_key"] = data.idempotency_key
    
    # 8. Update party balance (close our debt)
    # Bizim borcumuz pozitif balance olarak tutulur (onlara borçluyuz)
    # Ödeme: balance'ı azalt (pozitiften 0'a doğru)
    balance_change = -total_closed_has  # Total debt being closed (negative)
    await db.parties.update_one(
        {"id": party_id},
        {
            "$inc": {"has_balance": balance_change},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    logger.info(f"Updated party {party_id} HAS balance by {balance_change} (payment)")
    
    # Insert to database
    result = await db.financial_transactions.insert_one(transaction_doc)
    
    # 8. Audit log
    await write_audit_log(
        db, "financial_transactions", result.inserted_id,
        "CREATE", user_id, {"before": None, "after": transaction_doc}
    )
    
    # 9. Create cash movement if cash_register_id provided (OUT - biz ödeme yapıyoruz)
    cash_register_id = getattr(data, 'cash_register_id', None) or (data.meta.get('cash_register_id') if hasattr(data, 'meta') and data.meta else None)
    
    # DÖVİZ BİLGİLERİ
    payment_currency = getattr(data, 'payment_currency', None) or 'TRY'
    foreign_amount = getattr(data, 'foreign_amount', None)
    exchange_rate = getattr(data, 'exchange_rate', None)
    
    if cash_register_id and amount_currency and amount_currency > 0:
        try:
            set_cash_db(db)
            cash_register = await db.cash_registers.find_one({"id": cash_register_id, "is_active": True})
            if cash_register:
                party_name = party.get("name", "Tedarikçi") if party else "Tedarikçi"
                
                # DÖVİZ İLE ÖDEME İSE - TL tutarını kura böl
                if payment_currency in ['USD', 'EUR'] and exchange_rate and exchange_rate > 0:
                    # TL tutarını dövize çevir: 34000 TL / 42 = 809.52 USD
                    calculated_foreign = amount_currency / float(exchange_rate)
                    actual_foreign_amount = float(foreign_amount) if foreign_amount else calculated_foreign
                    
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="OUT",
                        amount=actual_foreign_amount,  # 809.52 USD (TL değil!)
                        currency=payment_currency,  # USD veya EUR
                        reference_type="PAYMENT",
                        reference_id=tx_code,
                        description=f"Ödeme - {party_name} - {actual_foreign_amount:.2f} {payment_currency}",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"Cash movement created for PAYMENT {tx_code}: -{actual_foreign_amount:.2f} {payment_currency} from {cash_register_id}")
                else:
                    # Normal TL ödeme
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="OUT",
                        amount=amount_currency,
                        currency=cash_register.get("currency", "TRY"),
                        reference_type="PAYMENT",
                        reference_id=tx_code,
                        description=f"Ödeme - {party_name} ({currency})",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"Cash movement created for PAYMENT {tx_code}: -{amount_currency} TL from {cash_register_id}")
        except Exception as e:
            logger.error(f"Failed to create cash movement for PAYMENT {tx_code}: {e}")
    
    logger.info(f"PAYMENT transaction created: {tx_code}, Party: {party_id}, Method: {payment_method}, Amount: {amount_currency} {currency}, HAS: {total_has_amount}, Discount HAS: {discount_has}, Profit HAS: {payment_profit_has}")
    
    # ==================== UNIFIED LEDGER KAYDI (PAYMENT) ====================
    try:
        party_name_for_ledger = party.get("name") if party else None
        register = await db.cash_registers.find_one({"id": cash_register_id}) if cash_register_id else None
        register_name = register.get("name") if register else None
        
        await create_ledger_entry(
            entry_type="PAYMENT",
            transaction_date=now,
            
            # Ödeme = HAS çıkışı (borç kapatıyoruz)
            has_in=0.0,
            has_out=abs(total_closed_has),
            
            # Para çıkışı
            currency=currency,
            amount_in=0.0,
            amount_out=amount_currency,
            exchange_rate=exchange_rate,
            
            # İskonto varsa kâr
            profit_has=payment_profit_has if payment_profit_has else None,
            profit_tl=discount_tl if discount_tl else None,
            discount_has=discount_has if discount_has else None,
            
            # Taraflar
            party_id=party_id,
            party_name=party_name_for_ledger,
            party_type="SUPPLIER",
            
            # Kasa
            cash_register_id=cash_register_id,
            cash_register_name=register_name,
            
            # Referans
            reference_type="financial_transactions",
            reference_id=tx_code,
            
            description=f"Tedarikçi ödemesi: {party_name_for_ledger}",
            created_by=user_id
        )
        logger.info(f"✅ Unified ledger entry created for PAYMENT: {tx_code}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for PAYMENT {tx_code}: {e}")
    
    # Return response
    return {
        "code": transaction_doc["code"],
        "type_code": transaction_doc["type_code"],
        "party_id": transaction_doc["party_id"],
        "transaction_date": transaction_doc["transaction_date"].isoformat(),
        "status": transaction_doc["status"],
        "total_has_amount": transaction_doc["total_has_amount"],
        "profit_has": payment_profit_has,
        "currency": transaction_doc["currency"],
        "total_amount_currency": transaction_doc["total_amount_currency"],
        "discount_tl": discount_tl,
        "discount_has": discount_has,
        "remaining_debt_has": remaining_debt_has,
        "notes": transaction_doc["notes"]
    }


# ==================== RECEIPT TRANSACTION ====================

