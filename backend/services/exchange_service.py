"""Exchange Service - Create currency exchange transactions"""
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

async def create_exchange_transaction(data, user_id: str, db):
    """
    EXCHANGE Transaction - Döviz alım-satım (Dokümana %100 uyumlu)
    
    İş Akışı (TRANSACTION_V2_MODULE.md):
    1. Validations (from_currency, to_currency, from_amount, to_amount)
    2. Idempotency kontrolü
    3. Price snapshot al
    4. Her iki currency'yi HAS'a çevir:
       - from_currency → HAS (direction: "buy" - veriyoruz)
       - to_currency → HAS (direction: "sell" - alıyoruz)
    5. Net HAS hesapla (to_has - from_has)
    6. İki FX line oluştur (OUT ve IN)
    7. Transaction dokümanı (party_id: None - internal operation)
    8. Audit log
    
    Not: EXCHANGE = Internal FX operation, net HAS spread'i gösterir
    """
    
    # 1. Validations
    transaction_date = parse_transaction_date(data.transaction_date)
    from_currency = data.from_currency
    to_currency = data.to_currency
    from_amount = data.from_amount
    to_amount = data.to_amount
    
    if not from_currency or not to_currency:
        raise HTTPException(
            status_code=400,
            detail="from_currency and to_currency required for EXCHANGE"
        )
    
    if not from_amount or from_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="from_amount required and must be positive for EXCHANGE"
        )
    
    if not to_amount or to_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="to_amount required and must be positive for EXCHANGE"
        )
    
    if from_currency == to_currency:
        raise HTTPException(
            status_code=400,
            detail="from_currency and to_currency must be different"
        )
    
    # 2. Idempotency check
    if data.idempotency_key:
        existing = await db.financial_transactions.find_one({"idempotency_key": data.idempotency_key})
        if existing:
            logger.warning(f"Duplicate EXCHANGE transaction detected: {data.idempotency_key}")
            return {
                "code": existing["code"],
                "type_code": existing["type_code"],
                "transaction_date": existing["transaction_date"].isoformat(),
                "status": existing["status"],
                "total_has_amount": existing["total_has_amount"],
                "from_currency": existing["meta"]["from_currency"],
                "to_currency": existing["meta"]["to_currency"],
                "from_amount": existing["meta"]["from_amount"],
                "to_amount": existing["meta"]["to_amount"],
                "net_has": existing["total_has_amount"],
                "notes": existing.get("notes", "")
            }
    
    # 3. Get price snapshot
    snapshot = await get_or_create_price_snapshot(db, transaction_date)
    tx_code = generate_transaction_code(transaction_date)
    
    # 4. Convert both currencies to HAS
    # from_currency: We're giving away (buy direction)
    from_has = convert_currency_to_has(from_amount, from_currency, snapshot, direction="buy")
    
    # to_currency: We're receiving (sell direction)
    to_has = convert_currency_to_has(to_amount, to_currency, snapshot, direction="sell")
    
    # Calculate net HAS (positive = gain, negative = loss)
    net_has = round_has(to_has - from_has)
    
    # 5. Build FX lines
    lines = [
        {
            "_id": BsonObjectId(),
            "line_no": 1,
            "line_kind": "FX",
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
            "line_total_has": -from_has,  # NEGATIVE (OUT)
            "quantity": 1,
            "unit_price_currency": -from_amount,
            "line_amount_currency": -from_amount,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": f"{from_currency} {from_amount} verilen",
            "meta": {
                "currency": from_currency,
                "amount": from_amount,
                "direction": "OUT",
                "has_equivalent": from_has
            }
        },
        {
            "_id": BsonObjectId(),
            "line_no": 2,
            "line_kind": "FX",
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
            "line_total_has": to_has,  # POSITIVE (IN)
            "quantity": 1,
            "unit_price_currency": to_amount,
            "line_amount_currency": to_amount,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": f"{to_currency} {to_amount} alınan",
            "meta": {
                "currency": to_currency,
                "amount": to_amount,
                "direction": "IN",
                "has_equivalent": to_has
            }
        }
    ]
    
    # Calculate effective FX rate
    fx_rate = to_amount / from_amount if from_amount > 0 else 0
    
    # 6. Build transaction document
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "code": tx_code,
        "type_code": "EXCHANGE",
        "party_id": None,  # Internal operation, no party
        "counterparty_id": None,
        "transaction_date": transaction_date,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "status": "COMPLETED",
        "total_has_amount": net_has,  # Net HAS impact (can be +/-)
        "currency": None,  # Multi-currency transaction
        "total_amount_currency": None,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": None,
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": lines,
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": data.notes or f"Döviz değişimi: {from_amount} {from_currency} → {to_amount} {to_currency}",
        "meta": {
            "from_currency": from_currency,
            "to_currency": to_currency,
            "from_amount": from_amount,
            "to_amount": to_amount,
            "from_has": from_has,
            "to_has": to_has,
            "net_has": net_has,
            "fx_rate": fx_rate,
            "user_provided_rate": data.fx_rate if hasattr(data, 'fx_rate') else None,
            "has_price_used": snapshot.get("has_sell_tl", 5943.30)
        },
        "version": 1
    }
    
    # idempotency_key sadece değer varsa ekle (sparse index için field missing olmalı)
    if data.idempotency_key:
        transaction_doc["idempotency_key"] = data.idempotency_key
    
    # Insert to database
    result = await db.financial_transactions.insert_one(transaction_doc)
    
    # 7. Audit log
    await write_audit_log(
        db, "financial_transactions", result.inserted_id,
        "CREATE", user_id, {"before": None, "after": transaction_doc}
    )
    
    # 8. Create cash movements for EXCHANGE
    foreign_cash_register_id = getattr(data, 'foreign_cash_register_id', None)
    tl_cash_register_id = getattr(data, 'tl_cash_register_id', None)
    exchange_type = getattr(data, 'exchange_type', None)  # BUY or SELL
    foreign_amount_param = getattr(data, 'foreign_amount', None)
    tl_amount_param = getattr(data, 'tl_amount', None)
    
    if foreign_cash_register_id and tl_cash_register_id:
        try:
            set_cash_db(db)
            
            # Determine actual amounts
            actual_foreign = float(foreign_amount_param) if foreign_amount_param else float(to_amount if to_currency != 'TRY' else from_amount)
            actual_tl = float(tl_amount_param) if tl_amount_param else float(from_amount if from_currency == 'TRY' else to_amount)
            actual_currency = to_currency if to_currency != 'TRY' else from_currency
            
            if exchange_type == 'BUY':
                # Döviz ALIŞ: TL veriyoruz, döviz alıyoruz
                # 1. Döviz kasasına GİRİŞ
                await create_cash_movement_internal(
                    cash_register_id=foreign_cash_register_id,
                    movement_type="IN",
                    amount=actual_foreign,
                    currency=actual_currency,
                    reference_type="EXCHANGE",
                    reference_id=tx_code,
                    description=f"Döviz alış - {actual_foreign} {actual_currency}",
                    created_by=user_id,
                    transaction_date=transaction_date
                )
                # 2. TL kasasından ÇIKIŞ
                await create_cash_movement_internal(
                    cash_register_id=tl_cash_register_id,
                    movement_type="OUT",
                    amount=actual_tl,
                    currency="TRY",
                    reference_type="EXCHANGE",
                    reference_id=tx_code,
                    description=f"Döviz alış karşılığı - {actual_tl:.2f} TL",
                    created_by=user_id,
                    transaction_date=transaction_date
                )
                logger.info(f"EXCHANGE BUY cash movements: +{actual_foreign} {actual_currency}, -{actual_tl:.2f} TL")
                
            elif exchange_type == 'SELL':
                # Döviz SATIŞ: Döviz veriyoruz, TL alıyoruz
                # 1. Döviz kasasından ÇIKIŞ
                await create_cash_movement_internal(
                    cash_register_id=foreign_cash_register_id,
                    movement_type="OUT",
                    amount=actual_foreign,
                    currency=actual_currency,
                    reference_type="EXCHANGE",
                    reference_id=tx_code,
                    description=f"Döviz satış - {actual_foreign} {actual_currency}",
                    created_by=user_id,
                    transaction_date=transaction_date
                )
                # 2. TL kasasına GİRİŞ
                await create_cash_movement_internal(
                    cash_register_id=tl_cash_register_id,
                    movement_type="IN",
                    amount=actual_tl,
                    currency="TRY",
                    reference_type="EXCHANGE",
                    reference_id=tx_code,
                    description=f"Döviz satış karşılığı - {actual_tl:.2f} TL",
                    created_by=user_id,
                    transaction_date=transaction_date
                )
                logger.info(f"EXCHANGE SELL cash movements: -{actual_foreign} {actual_currency}, +{actual_tl:.2f} TL")
                
        except Exception as e:
            logger.error(f"Failed to create cash movements for EXCHANGE {tx_code}: {e}")
    
    # ==================== UNIFIED LEDGER KAYDI (EXCHANGE) ====================
    try:
        # TL bazlı maliyet ve kar hesaplama
        has_sell_price = snapshot.get('has_sell_tl', 0)
        
        # Cost TL = Verilen değerin TL karşılığı
        # Eğer TRY veriyorsak doğrudan from_amount, değilse döviz kurunu kullan
        if from_currency == "TRY":
            exchange_cost_tl = from_amount
        else:
            # Verilen dövizin TL karşılığı (piyasa kuru ile)
            exchange_cost_tl = from_has * has_sell_price if has_sell_price > 0 else 0
        
        # Profit TL = Net HAS * HAS Satış Fiyatı
        exchange_profit_tl = net_has * has_sell_price if has_sell_price > 0 else 0
        
        await create_ledger_entry(
            entry_type="EXCHANGE",
            transaction_date=transaction_date,
            
            # Net HAS impact (pozitif = kar, negatif = zarar)
            has_in=to_has if net_has > 0 else 0,
            has_out=from_has if net_has > 0 else 0,
            
            currency=from_currency,  # Verilen para birimi
            amount_in=to_amount,  # Alınan tutar
            amount_out=from_amount,  # Verilen tutar
            
            # Kar/Zarar (TL ve HAS)
            cost_tl=exchange_cost_tl,
            profit_tl=exchange_profit_tl,
            profit_has=net_has,
            
            cash_register_id=tl_cash_register_id or foreign_cash_register_id,
            
            reference_type="financial_transactions",
            reference_id=tx_code,
            
            description=f"Döviz değişim: {from_amount} {from_currency} → {to_amount} {to_currency} (Net HAS: {net_has:+.6f})",
            created_by=user_id
        )
        logger.info(f"Exchange ledger entry created: {tx_code}")
    except Exception as e:
        logger.error(f"Failed to create exchange ledger entry: {e}")
    
    logger.info(f"EXCHANGE transaction created: {tx_code}, {from_amount} {from_currency} → {to_amount} {to_currency}, Net HAS: {net_has}")
    
    # Return response
    return {
        "code": transaction_doc["code"],
        "type_code": transaction_doc["type_code"],
        "transaction_date": transaction_doc["transaction_date"].isoformat(),
        "status": transaction_doc["status"],
        "total_has_amount": transaction_doc["total_has_amount"],
        "from_currency": from_currency,
        "to_currency": to_currency,
        "from_amount": from_amount,
        "to_amount": to_amount,
        "net_has": net_has,
        "fx_rate": fx_rate,
        "notes": transaction_doc["notes"]
    }


# ==================== HURDA TRANSACTION ====================

