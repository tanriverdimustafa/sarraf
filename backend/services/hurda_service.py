"""Hurda Service - Create scrap gold transactions"""
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

async def create_hurda_transaction(data, user_id: str, db):
    """
    HURDA Transaction - Hurda altın ile ödeme (Dokümana %100 uyumlu)
    
    İş Akışı (TRANSACTION_V2_MODULE.md):
    1. Party validasyonu (zorunlu)
    2. Lines validasyonu (en az 1 line gerekli)
    3. Idempotency kontrolü
    4. Price snapshot al
    5. Her line için:
       - Karat validasyonu
       - HAS hesaplama: weight_gram * fineness
       - INVENTORY line oluştur (product_type_code: GOLD_SCRAP)
    6. Toplam HAS hesapla
    7. TL karşılığını hesapla (referans için)
    8. Transaction dokümanı (total_has_amount: NEGATIVE - OUT)
    9. Audit log
    
    Not: HURDA = Hurda altın kabul ederek ödeme yapma (HAS OUT)
    """
    
    # 1. Validations
    party_id = data.party_id
    if not party_id:
        raise HTTPException(status_code=400, detail="party_id required for HURDA transaction")
    
    transaction_date = parse_transaction_date(data.transaction_date)
    
    # Validate party exists
    party = await db.parties.find_one({"id": party_id, "is_active": True})
    if not party:
        raise HTTPException(status_code=404, detail=f"Party {party_id} not found or inactive")
    
    # 2. Lines validation
    if not data.lines or len(data.lines) == 0:
        raise HTTPException(status_code=400, detail="At least one line required for HURDA (scrap gold items)")
    
    # 3. Idempotency check
    if data.idempotency_key:
        existing = await db.financial_transactions.find_one({"idempotency_key": data.idempotency_key})
        if existing:
            logger.warning(f"Duplicate HURDA transaction detected: {data.idempotency_key}")
            return {
                "code": existing["code"],
                "type_code": existing["type_code"],
                "party_id": existing["party_id"],
                "transaction_date": existing["transaction_date"].isoformat(),
                "status": existing["status"],
                "total_has_amount": existing["total_has_amount"],
                "total_scrap_has": abs(existing["total_has_amount"]),
                "equivalent_tl": existing["meta"].get("equivalent_tl"),
                "notes": existing.get("notes", "")
            }
    
    # 4. Get price snapshot
    snapshot = await get_or_create_price_snapshot(db, transaction_date)
    tx_code = generate_transaction_code(transaction_date)
    
    # 5. Process hurda (scrap gold) lines
    processed_lines = []
    total_scrap_has = 0.0
    total_weight_gram = 0.0
    
    for idx, line_input in enumerate(data.lines, 1):
        karat_id = line_input.get("karat_id")
        weight_gram = line_input.get("weight_gram")
        
        if not karat_id:
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: karat_id required for HURDA"
            )
        
        if not weight_gram or weight_gram <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: weight_gram required and must be positive"
            )
        
        # Get karat info
        karat = await db.karats.find_one({"id": karat_id})
        if not karat:
            raise HTTPException(
                status_code=404,
                detail=f"Line {idx}: Karat {karat_id} not found"
            )
        
        fineness = karat.get("fineness")
        if not fineness:
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: Karat {karat_id} missing fineness value"
            )
        
        # Calculate HAS for this scrap item
        scrap_has = round_has(weight_gram * fineness)
        
        # Build line document
        line_doc = {
            "_id": BsonObjectId(),
            "line_no": idx,
            "line_kind": "INVENTORY",
            "product_id": None,  # No product, just scrap gold
            "sku": None,
            "product_type_code": "GOLD_SCRAP",
            "karat_id": karat_id,
            "fineness": fineness,
            "weight_gram": weight_gram,
            "labor_type_code": None,
            "labor_has_value": None,
            "material_has": scrap_has,
            "labor_has": 0.0,
            "line_total_has": scrap_has,
            "quantity": 1,
            "unit_price_currency": None,
            "line_amount_currency": None,
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": line_input.get("note", f"Hurda {karat.get('karat', '')}k - {weight_gram}gr"),
            "meta": {
                "scrap_type": line_input.get("scrap_type", "broken_jewelry"),
                "karat_name": karat.get("karat"),
                "fineness": fineness
            }
        }
        
        processed_lines.append(line_doc)
        total_scrap_has += scrap_has
        total_weight_gram += weight_gram
    
    # 6. Calculate TL equivalent (for reference - meta field)
    equivalent_tl = convert_has_to_currency(
        total_scrap_has,
        "TRY",
        snapshot,
        direction="sell"
    )
    
    # 7. Build transaction document
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "code": tx_code,
        "type_code": "HURDA",
        "party_id": party_id,
        "counterparty_id": None,
        "transaction_date": transaction_date,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "status": "COMPLETED",
        "total_has_amount": -round_has(total_scrap_has),  # NEGATIVE (HAS OUT - payment made)
        "currency": None,  # No currency, HAS-based transaction
        "total_amount_currency": None,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": "GOLD_SCRAP",
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": processed_lines,
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": data.notes or f"Hurda altın ile ödeme - {party.get('name', party_id)}",
        "meta": {
            "total_scrap_has": round_has(total_scrap_has),
            "total_weight_gram": round_currency(total_weight_gram),
            "equivalent_tl": equivalent_tl,
            "scrap_items_count": len(processed_lines),
            "has_price_used": snapshot.get("has_buy_tl", 5923.30)  # HURDA alış olduğu için alış fiyatı
        },
        "version": 1
    }
    
    # idempotency_key sadece değer varsa ekle (sparse index için field missing olmalı)
    if data.idempotency_key:
        transaction_doc["idempotency_key"] = data.idempotency_key
    
    # Insert to database
    result = await db.financial_transactions.insert_one(transaction_doc)
    
    # 8. Audit log
    await write_audit_log(
        db, "financial_transactions", result.inserted_id,
        "CREATE", user_id, {"before": None, "after": transaction_doc}
    )
    
    logger.info(f"HURDA transaction created: {tx_code}, Party: {party_id}, Total Scrap HAS: {total_scrap_has}, Weight: {total_weight_gram}gr")
    
    # Return response
    return {
        "code": transaction_doc["code"],
        "type_code": transaction_doc["type_code"],
        "party_id": transaction_doc["party_id"],
        "transaction_date": transaction_doc["transaction_date"].isoformat(),
        "status": transaction_doc["status"],
        "total_has_amount": transaction_doc["total_has_amount"],
        "total_scrap_has": round_has(total_scrap_has),
        "total_weight_gram": round_currency(total_weight_gram),
        "equivalent_tl": equivalent_tl,
        "scrap_items_count": len(processed_lines),
        "notes": transaction_doc["notes"]
    }
