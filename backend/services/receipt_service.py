"""Receipt Service - Create receipt transactions"""
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

async def create_receipt_transaction(data, user_id: str, db):
    """
    RECEIPT Transaction - Tahsilat (HAS IN) - PAYMENT'in tersi (Dokümana %100 uyumlu)
    
    İş Akışı (TRANSACTION_V2_MODULE.md):
    1. Party validasyonu (zorunlu)
    2. Idempotency kontrolü
    3. Price snapshot al
    4. Currency → HAS çevirimi (direction: "sell" - biz tahsilat yapıyoruz)
    5. İskonto/Kısmi tahsilat hesapla
    6. PAYMENT line oluştur
    7. Transaction dokümanı (total_has_amount: POSITIVE - IN)
    8. Party balance güncelle
    9. Audit log
    
    Not: RECEIPT = Party balance IN (HAS pozitif)
    
    İskonto Özelliği:
    - expected_amount_tl: Beklenen tahsilat tutarı (müşteri borcu)
    - actual_amount_tl: Gerçek tahsil edilen tutar
    - discount_tl/discount_has: İskonto tutarı
    - remaining_debt_has: Kalan borç (kısmi tahsilat)
    """
    
    # 1. Validations
    party_id = data.party_id
    if not party_id:
        raise HTTPException(status_code=400, detail="party_id required for RECEIPT transaction")
    
    transaction_date = parse_transaction_date(data.transaction_date)
    currency = data.currency or "TRY"
    amount_currency = data.total_amount_currency
    
    if not amount_currency or amount_currency <= 0:
        raise HTTPException(status_code=400, detail="total_amount_currency required and must be positive for RECEIPT")
    
    # Validate party exists
    party = await db.parties.find_one({"id": party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=404, detail=f"Party {party_id} not found or inactive")
    
    # 2. Idempotency check
    if data.idempotency_key:
        existing = await db.financial_transactions.find_one({"idempotency_key": data.idempotency_key})
        if existing:
            logger.warning(f"Duplicate RECEIPT transaction detected: {data.idempotency_key}")
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
    collected_has = getattr(data, 'collected_has', None) or (data.meta.get('collected_has') if data.meta else None) or 0.0
    remaining_debt_has = getattr(data, 'remaining_debt_has', None) or (data.meta.get('remaining_debt_has') if data.meta else None) or 0.0
    total_has_from_request = getattr(data, 'total_has_amount', None) or (data.meta.get('total_has_amount') if data.meta else None) or 0.0
    is_discount = getattr(data, 'is_discount', None) or (data.meta.get('is_discount') if data.meta else None) or False
    has_price_used = getattr(data, 'has_price_used', None) or (data.meta.get('has_price_used') if data.meta else None) or snapshot.get('has_sell_tl', 0)
    party_debt_has = getattr(data, 'party_debt_has', None) or (data.meta.get('party_debt_has') if data.meta else None) or 0.0
    
    # 5. Convert currency to HAS (direction: sell - we're receiving)
    if collected_has > 0:
        has_amount = collected_has
    else:
        has_amount = convert_currency_to_has(
            amount_currency,
            currency,
            snapshot,
            direction="sell"
        )
    
    # Total HAS being closed (received + discount)
    total_closed_has = has_amount + discount_has
    
    # Build lines
    lines = []
    
    # Main receipt line
    receipt_line = {
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
        "note": data.notes or f"{currency} tahsilat alındı",
        "meta": {
            "receipt_currency": currency,
            "receipt_amount": amount_currency
        }
    }
    lines.append(receipt_line)
    
    # Add DISCOUNT line if applicable
    if discount_has > 0.001:
        discount_line = {
            "_id": BsonObjectId(),
            "line_no": 2,
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
            "line_total_has": round_has(discount_has),  # Positive (closes debt)
            "quantity": 1,
            "unit_price_currency": discount_tl,
            "line_amount_currency": discount_tl,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": f"İskonto - Tahsilat",
            "meta": {
                "discount_tl": discount_tl,
                "discount_has": discount_has,
                "discount_percentage": round((discount_tl / expected_amount_tl * 100) if expected_amount_tl > 0 else 0, 2)
            }
        }
        lines.append(discount_line)
    
    # 6. Calculate profit/loss for RECEIPT
    # İskonto = Zarar (negatif profit)
    receipt_profit_has = round_has(-discount_has) if discount_has > 0.001 else 0
    
    # 7. Build transaction document
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "code": tx_code,
        "type_code": "RECEIPT",
        "party_id": party_id,
        "counterparty_id": None,
        "transaction_date": transaction_date,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "status": "COMPLETED",
        "total_has_amount": round_has(total_closed_has),  # POSITIVE (HAS IN) - total debt being closed
        "profit_has": receipt_profit_has,  # İskonto zararı
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
        "notes": data.notes or f"{currency} tahsilat - {party.get('name', party_id)}",
        "meta": {
            "receipt_direction": "IN",
            "expected_amount_tl": expected_amount_tl,
            "actual_amount_tl": actual_amount_tl,
            "discount_tl": discount_tl,
            "discount_has": discount_has,
            "collected_has": has_amount,
            "remaining_debt_has": remaining_debt_has,
            "is_discount": is_discount,
            "has_price_used": has_price_used,
            "party_debt_has": party_debt_has,
            "total_closed_has": total_closed_has,
            "profit_has": receipt_profit_has
        },
        "version": 1
    }
    
    # idempotency_key sadece değer varsa ekle (sparse index için field missing olmalı)
    if data.idempotency_key:
        transaction_doc["idempotency_key"] = data.idempotency_key
    
    # 7. Update party balance (close debt)
    # Party'nin borcu negatif balance olarak tutulur
    # Tahsilat: balance'ı artır (negatiften 0'a doğru)
    balance_change = total_closed_has  # Total debt being closed
    await db.parties.update_one(
        {"id": party_id},
        {
            "$inc": {"has_balance": balance_change},
            "$set": {"updated_at": now.isoformat()}
        }
    )
    logger.info(f"Updated party {party_id} HAS balance by +{balance_change} (receipt)")
    
    # Insert to database
    result = await db.financial_transactions.insert_one(transaction_doc)
    
    # 8. Audit log
    await write_audit_log(
        db, "financial_transactions", result.inserted_id,
        "CREATE", user_id, {"before": None, "after": transaction_doc}
    )
    
    # 9. Create cash movement if cash_register_id provided (IN - biz tahsilat yapıyoruz)
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
                party_name = party.get("name", "Müşteri") if party else "Müşteri"
                
                # DÖVİZ İLE TAHSİLAT İSE - TL tutarını kura böl
                if payment_currency in ['USD', 'EUR'] and exchange_rate and exchange_rate > 0:
                    # TL tutarını dövize çevir: 10000 TL / 42 = 238.10 USD
                    calculated_foreign = amount_currency / float(exchange_rate)
                    actual_foreign_amount = float(foreign_amount) if foreign_amount else calculated_foreign
                    
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="IN",
                        amount=actual_foreign_amount,  # 238.10 USD (TL değil!)
                        currency=payment_currency,  # USD veya EUR
                        reference_type="RECEIPT",
                        reference_id=tx_code,
                        description=f"Tahsilat - {party_name} - {actual_foreign_amount:.2f} {payment_currency}",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"Cash movement created for RECEIPT {tx_code}: +{actual_foreign_amount:.2f} {payment_currency} to {cash_register_id}")
                else:
                    # Normal TL tahsilat
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="IN",
                        amount=amount_currency,
                        currency=cash_register.get("currency", "TRY"),
                        reference_type="RECEIPT",
                        reference_id=tx_code,
                        description=f"Tahsilat - {party_name} ({currency})",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"Cash movement created for RECEIPT {tx_code}: +{amount_currency} TL to {cash_register_id}")
        except Exception as e:
            logger.error(f"Failed to create cash movement for RECEIPT {tx_code}: {e}")
    
    logger.info(f"RECEIPT transaction created: {tx_code}, Party: {party_id}, Amount: {amount_currency} {currency}, HAS: {has_amount}, Discount HAS: {discount_has}, Profit HAS: {receipt_profit_has}")
    
    # ==================== UNIFIED LEDGER KAYDI (RECEIPT) ====================
    try:
        party_name_for_ledger = party.get("name") if party else None
        register = await db.cash_registers.find_one({"id": cash_register_id}) if cash_register_id else None
        register_name = register.get("name") if register else None
        
        await create_ledger_entry(
            entry_type="RECEIPT",
            transaction_date=now,
            
            # Tahsilat = HAS girişi (alacak kapatıyoruz)
            has_in=abs(total_closed_has),
            has_out=0.0,
            
            # Para girişi
            currency=currency,
            amount_in=amount_currency,
            amount_out=0.0,
            exchange_rate=exchange_rate,
            
            # İskonto varsa zarar
            profit_has=receipt_profit_has if receipt_profit_has else None,
            discount_has=discount_has if discount_has else None,
            
            # Taraflar
            party_id=party_id,
            party_name=party_name_for_ledger,
            party_type="CUSTOMER",
            
            # Kasa
            cash_register_id=cash_register_id,
            cash_register_name=register_name,
            
            # Referans
            reference_type="financial_transactions",
            reference_id=tx_code,
            
            description=f"Müşteri tahsilatı: {party_name_for_ledger}",
            created_by=user_id
        )
        logger.info(f"✅ Unified ledger entry created for RECEIPT: {tx_code}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for RECEIPT {tx_code}: {e}")
    
    # Return response
    return {
        "code": transaction_doc["code"],
        "type_code": transaction_doc["type_code"],
        "party_id": transaction_doc["party_id"],
        "transaction_date": transaction_doc["transaction_date"].isoformat(),
        "status": transaction_doc["status"],
        "total_has_amount": transaction_doc["total_has_amount"],
        "profit_has": receipt_profit_has,
        "currency": transaction_doc["currency"],
        "total_amount_currency": transaction_doc["total_amount_currency"],
        "discount_tl": discount_tl,
        "discount_has": discount_has,
        "remaining_debt_has": remaining_debt_has,
        "notes": transaction_doc["notes"]
    }


# ==================== EXCHANGE TRANSACTION ====================

