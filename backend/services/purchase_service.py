"""Purchase Service - Create purchase transactions"""
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
from services.stock_service import create_stock_lot, add_to_stock_pool

logger = logging.getLogger(__name__)

async def create_purchase_transaction(data, user_id: str, db):
    """
    PURCHASE Transaction - Tedarikçiden veya müşteriden ürün alımı
    
    Flow:
    1. Validate party and snapshot
    2. Process each line - HER SATIR İÇİN ÜRÜN OLUŞTUR
    3. Calculate totals and commission
    4. Create transaction document
    5. Write audit log
    
    Yeni: Alış yapılınca otomatik stok girişi (ürün oluşturma)
    """
    
    party_id = data.party_id
    transaction_date = parse_transaction_date(data.transaction_date)
    
    # Validate party
    if party_id:
        party = await db.parties.find_one({"id": party_id, "is_active": True})
        if not party:
            raise HTTPException(status_code=404, detail="Party not found")
    
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
                "notes": existing.get("notes"),
                "meta": existing.get("meta", {})
            }
    
    # Get price snapshot
    snapshot = await get_or_create_price_snapshot(db, transaction_date)
    tx_code = generate_transaction_code(transaction_date)
    
    # Process lines
    processed_lines = []
    created_products = []
    total_has = 0.0
    
    # Logger already defined at module level
    
    for idx, line_input in enumerate(data.lines, 1):
        product_id = line_input.get("product_id")
        
        # DEBUG: Log line_input
        logger.info(f"Line input {idx}: {line_input}")
        
        # Initialize fineness at the start
        fineness = line_input.get("fineness")
        karat_id = line_input.get("karat_id")
        weight_gram = 0
        material_has_cost = 0
        labor_has_cost = 0
        total_cost_has = 0
        product_type_id = None
        product_type = None  # Initialize product_type for all lines
        quantity = float(line_input.get("quantity", 1) or 1)  # Initialize quantity
        
        # HER SATIR İÇİN YENİ ÜRÜN OLUŞTUR (product_id yoksa)
        product_type_code = line_input.get("product_type_code")
        product_type_id_input = line_input.get("product_type_id")
        
        if not product_id and (product_type_code or product_type_id_input):
            # Get product type
            product_type = None
            if product_type_code:
                product_type = await db.product_types.find_one({"code": product_type_code})
            if not product_type and product_type_id_input:
                # Try by id
                try:
                    type_id = int(product_type_id_input)
                except (ValueError, TypeError):
                    type_id = 0
                product_type = await db.product_types.find_one({"id": type_id})
            
            product_type_id = product_type["id"] if product_type else 1
            is_gold_based = product_type.get("is_gold_based", True) if product_type else True
            track_type = product_type.get("track_type", "UNIQUE") if product_type else "UNIQUE"
            unit = product_type.get("unit", "PIECE") if product_type else "PIECE"
            fixed_weight = product_type.get("fixed_weight") if product_type else None
            
            # Get karat info
            if karat_id and not fineness:
                # Ensure karat_id is an integer for MongoDB lookup
                try:
                    karat_id_int = int(karat_id)
                except (ValueError, TypeError):
                    karat_id_int = 0
                karat = await db.karats.find_one({"id": karat_id_int})
                if karat:
                    fineness = karat.get("fineness", 0.995)
                else:
                    fineness = 0.995  # Default fineness if karat not found
            elif not fineness:
                # Neither karat_id nor fineness provided - use default
                fineness = 0.995
            
            # Calculate costs based on track_type
            quantity = float(line_input.get("quantity", 1) or 1)
            
            if track_type == "FIFO" and fixed_weight:
                # Sarrafiye - sabit ağırlık kullan
                weight_gram = fixed_weight * quantity
            elif track_type == "FIFO" and unit == "GRAM":
                # Gram altın/Külçe
                weight_gram = float(line_input.get("weight_gram", 0) or 0)
                quantity = weight_gram  # Gram için quantity = weight
            elif track_type == "FIFO_LOT":
                # Lot bazlı FIFO (bilezik vb.) - gram olarak alınır
                weight_gram = float(line_input.get("weight_gram", 0) or 0)
                quantity = weight_gram  # Gram bazlı
            elif track_type == "POOL":
                # Havuz sistemi (bilezik vb.) - gram olarak alınır
                weight_gram = float(line_input.get("weight_gram", 0) or 0)
                quantity = weight_gram  # Gram bazlı
            else:
                # UNIQUE
                weight_gram = float(line_input.get("weight_gram", 0) or 0)
                quantity = 1  # UNIQUE için her zaman 1
            
            material_has_cost = weight_gram * (fineness or 0.995) if is_gold_based else 0
            labor_has_cost = float(line_input.get("labor_has_value", 0) or 0)
            total_cost_has = material_has_cost + labor_has_cost
            
            # Use provided line_total_has ONLY if it's greater than 0
            provided_line_total = float(line_input.get("line_total_has", 0) or 0)
            if provided_line_total > 0.001:
                total_cost_has = provided_line_total
            
            # Calculate unit_has (birim HAS değeri)
            unit_has = total_cost_has / quantity if quantity > 0 else total_cost_has
            
            # Generate barcode
            barcode = f"PRD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            
            # Create product name
            product_name = line_input.get("note") or f"{product_type.get('name', 'Ürün') if product_type else 'Ürün'}"
            if quantity > 1 and track_type == "FIFO":
                if unit == "PIECE":
                    product_name = f"{product_name} ({int(quantity)} adet)"
                else:
                    product_name = f"{product_name} ({quantity:.2f} gram)"
            
            # Create product document
            now = datetime.now(timezone.utc).isoformat()
            new_product = {
                "id": str(uuid.uuid4()),
                "barcode": barcode,
                "product_type_id": product_type_id,
                "name": product_name,
                "notes": line_input.get("note", f"Alış: {tx_code}"),
                "karat_id": int(karat_id) if karat_id else None,
                "fineness": fineness,
                "weight_gram": weight_gram,
                "labor_type_id": 1 if labor_has_cost > 0 else None,
                "labor_has_value": labor_has_cost if labor_has_cost > 0 else None,
                "material_has_cost": material_has_cost,
                "labor_has_cost": labor_has_cost,
                "total_cost_has": total_cost_has,
                "alis_has_degeri": total_cost_has,
                "profit_rate_percent": 0,  # Alışta kar yok
                "sale_has_value": total_cost_has,  # Maliyet = Satış (kar oranı eklenecek)
                "supplier_party_id": party_id,
                "purchase_date": transaction_date.isoformat(),
                "purchase_price_has": total_cost_has,
                "purchase_transaction_id": tx_code,
                "images": [],
                "stock_status_id": 1,  # IN_STOCK
                "is_gold_based": is_gold_based,
                # FIFO alanları
                "quantity": quantity,
                "remaining_quantity": quantity,  # Başta quantity = remaining_quantity
                "unit_has": unit_has,
                "track_type": track_type,
                "unit": unit,
                "fixed_weight": fixed_weight,
                "created_at": now,
                "updated_at": now
            }
            
            # Insert product
            await db.products.insert_one(new_product)
            product_id = new_product["id"]
            created_products.append(new_product)
            
            # FIFO_LOT için stock_lot oluştur
            if track_type == "FIFO_LOT":
                unit_cost_has = total_cost_has / weight_gram if weight_gram > 0 else 0
                await create_stock_lot(
                    db=db,
                    product_type_id=product_type_id,
                    product_type_code=line_input.get("product_type_code"),
                    karat_id=karat_id,
                    supplier_party_id=data.party_id,
                    purchase_date=transaction_date,
                    quantity=weight_gram,  # Gram bazlı
                    unit_cost_has=unit_cost_has,
                    labor_cost_has=labor_has_cost,
                    fineness=fineness or 0.916
                )
                logger.info(f"Created FIFO_LOT for {product_type.get('name')}: {weight_gram}g")
            
            # POOL için havuza ekle
            elif track_type == "POOL":
                pool_result = await add_to_stock_pool(
                    db=db,
                    product_type_id=product_type_id,
                    karat_id=int(karat_id) if karat_id else 1,
                    weight_gram=weight_gram,
                    cost_has=total_cost_has,
                    fineness=fineness or 0.916
                )
                logger.info(f"Added to POOL for {product_type.get('name')}: {weight_gram}g, new total: {pool_result['new_total_weight']}g")
        
        # If product exists, update stock status
        elif product_id:
            product = await db.products.find_one({"id": product_id})
            if product:
                await db.products.update_one(
                    {"id": product_id},
                    {"$set": {
                        "stock_status_id": 1,  # IN_STOCK
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        # Build line document - use calculated values, not frontend values
        # Note için ürün adı belirle
        line_note = line_input.get("note", "")
        if not line_note and product_type:
            # Hurda ise karat bilgisi ekle
            if product_type.get("group") == "HURDA":
                karat_name = ""
                if karat_id:
                    karat_doc = await db.karats.find_one({"id": int(karat_id)})
                    if karat_doc:
                        karat_name = karat_doc.get("karat", "")
                line_note = f"{product_type.get('name', 'Hurda')} - {weight_gram}gr"
                if karat_name:
                    line_note = f"Hurda {karat_name} - {weight_gram}gr"
            else:
                line_note = product_type.get("name", "")
        
        line_doc = {
            "_id": BsonObjectId(),
            "line_no": idx,
            "line_kind": "INVENTORY",
            "product_id": product_id,
            "sku": line_input.get("sku"),
            "product_type_code": line_input.get("product_type_code"),
            "karat_id": line_input.get("karat_id"),
            "fineness": fineness,
            "weight_gram": weight_gram,
            "labor_type_code": line_input.get("labor_type_code"),
            "labor_has_value": labor_has_cost,
            "material_has": material_has_cost,
            "labor_has": labor_has_cost,
            "line_total_has": total_cost_has,
            "quantity": quantity,
            "unit_price_currency": line_input.get("unit_price_currency"),
            "line_amount_currency": line_input.get("line_amount_currency"),
            "referenced_tx_id": None,
            "referenced_line_id": None,
            "note": line_note,
            "meta": {
                **line_input.get("meta", {}),
                "product_type_name": product_type.get("name") if product_type else None,
                "karat_id": karat_id,
                "weight_gram": weight_gram,
                "fineness": fineness
            }
        }
        
        processed_lines.append(line_doc)
        total_has += total_cost_has
    
    # Commission calculation
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
                direction="buy"
            )
            
            # Add commission line
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
                "line_total_has": commission_has_amount,
                "quantity": 1,
                "unit_price_currency": commission_amount_currency,
                "line_amount_currency": commission_amount_currency,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": f"Ödeme komisyonu ({payment_method['name']})",
                "meta": {"commission_rate": payment_method["commission_rate"]}
            }
            processed_lines.append(fee_line)
            total_has += commission_has_amount
    
    # Build transaction document
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "code": tx_code,
        "type_code": "PURCHASE",
        "party_id": party_id,
        "counterparty_id": None,
        "transaction_date": transaction_date,
        "created_at": now,
        "updated_at": now,
        "created_by": user_id,
        "status": "COMPLETED",
        "total_has_amount": round_has(total_has),  # Positive (IN)
        "currency": data.currency,
        "total_amount_currency": round_currency(data.total_amount_currency) if data.total_amount_currency else None,
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
            **(data.meta or {}),
            "has_price_used": snapshot.get("has_buy_tl", 5923.30),  # PURCHASE için alış fiyatı
            "actual_amount_tl": round_currency(data.total_amount_currency) if data.total_amount_currency else None,
        },
        "version": 1
    }
    
    # idempotency_key sadece değer varsa ekle (sparse index için field missing olmalı)
    if data.idempotency_key:
        transaction_doc["idempotency_key"] = data.idempotency_key
    
    # Insert
    result = await db.financial_transactions.insert_one(transaction_doc)
    
    # Audit
    await write_audit_log(
        db, "financial_transactions", result.inserted_id,
        "CREATE", user_id, {"before": None, "after": None}
    )
    
    # ==================== PARTY BALANCE GÜNCELLEME ====================
    # İŞ MANTIĞI:
    # 1. Alış yapınca: bakiye += alınan_has (biz borçlandık)
    # 2. Ödeme yapılınca: payment_difference_action'a göre:
    #    - "PROFIT_LOSS": Bakiye 0, fark kar/zarar olarak kaydedilir
    #    - "CREDIT": Fark bakiyeye yansır
    # 3. Ödeme yapılmadıysa: Tam borç eklenir
    
    has_price = snapshot.get("has_buy_tl", 5943.30)
    paid_amount_tl = data.total_amount_currency if data.total_amount_currency else 0
    alis_has = round_has(total_has)  # Alınan HAS miktarı
    
    # Yeni parametre: Fark işlemi seçimi (PROFIT_LOSS veya CREDIT)
    payment_difference_action = getattr(data, 'payment_difference_action', None) or "PROFIT_LOSS"
    
    # Kar/Zarar hesaplama
    beklenen_tl = alis_has * has_price
    profit_loss_tl = 0
    profit_loss_has = 0
    net_balance_change = 0
    
    if party_id:
        if paid_amount_tl > 0:
            # ÖDEME YAPILDI
            fark_tl = round(beklenen_tl - paid_amount_tl, 2)
            fark_has = round_has(fark_tl / has_price)
            
            if abs(fark_tl) < 1:
                # Tam ödeme (fark < 1 TL) - Bakiye 0
                net_balance_change = 0
                logger.info(f"PURCHASE full payment: Party {party_id} balance = 0 (exact payment)")
            elif payment_difference_action == "PROFIT_LOSS":
                # Fark kar/zarar olarak kaydedilecek, bakiye 0
                net_balance_change = 0
                profit_loss_tl = fark_tl
                profit_loss_has = fark_has
                logger.info(f"PURCHASE with PROFIT_LOSS: Party {party_id} balance = 0, profit/loss = {fark_tl:.2f} TL")
            else:
                # CREDIT: Fark bakiyeye yansıyacak
                # fark > 0 = eksik ödedik = biz hala borçluyuz (pozitif bakiye)
                # fark < 0 = fazla ödedik = müşteri bize borçlu (negatif bakiye)
                net_balance_change = fark_has
                logger.info(f"PURCHASE with CREDIT: Party {party_id} balance += {fark_has:.6f} HAS")
        else:
            # ÖDEME YAPILMADI - Tam borç eklenir
            net_balance_change = alis_has
            logger.info(f"PURCHASE without payment: Party {party_id} balance += {alis_has:.6f} HAS (full debt)")
        
        # Bakiye güncelle (sadece değişiklik varsa)
        await db.parties.update_one(
            {"id": party_id},
            {
                "$inc": {"has_balance": net_balance_change},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        logger.info(f"Party {party_id} balance updated by {net_balance_change:.6f} HAS")
    
    # ==================== KASA HAREKETİ ====================
    # Ödeme yapıldıysa kasadan para çıkışı oluştur
    cash_register_id = getattr(data, 'cash_register_id', None) or (data.meta.get('cash_register_id') if hasattr(data, 'meta') and data.meta else None)
    paid_amount = data.total_amount_currency if data.total_amount_currency else None
    
    # DÖVİZ BİLGİLERİ
    payment_currency = getattr(data, 'payment_currency', None) or 'TRY'
    foreign_amount = getattr(data, 'foreign_amount', None)
    exchange_rate = getattr(data, 'exchange_rate', None)
    
    # Party name for ledger entry (define outside conditional block)
    party_name = party.get("name", "Müşteri") if party else "Müşteri"
    
    if cash_register_id and paid_amount and paid_amount > 0:
        try:
            set_cash_db(db)
            cash_register = await db.cash_registers.find_one({"id": cash_register_id, "is_active": True})
            if cash_register:
                register_currency = cash_register.get("currency", "TRY")
                
                # DÖVİZ İLE ÖDEME
                if payment_currency in ['USD', 'EUR']:
                    # Döviz ödemesi
                    if foreign_amount and float(foreign_amount) > 0:
                        # Doğrudan döviz miktarı verilmiş
                        actual_amount = float(foreign_amount)
                    elif exchange_rate and float(exchange_rate) > 0:
                        # TL tutarını kura böl
                        actual_amount = paid_amount / float(exchange_rate)
                    else:
                        # Fallback: paid_amount'u döviz olarak al
                        actual_amount = paid_amount
                    
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="OUT",
                        amount=actual_amount,
                        currency=payment_currency,  # USD veya EUR
                        reference_type="PURCHASE",
                        reference_id=tx_code,
                        description=f"Alış ödemesi - {party_name} - {actual_amount:.2f} {payment_currency}",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"✅ Cash movement (PURCHASE): -{actual_amount:.2f} {payment_currency} from {cash_register.get('name')}")
                else:
                    # TL ödeme
                    await create_cash_movement_internal(
                        cash_register_id=cash_register_id,
                        movement_type="OUT",
                        amount=paid_amount,
                        currency="TRY",
                        reference_type="PURCHASE",
                        reference_id=tx_code,
                        description=f"Alış ödemesi - {party_name} - {paid_amount:.2f} TL",
                        created_by=user_id,
                        transaction_date=transaction_date
                    )
                    logger.info(f"✅ Cash movement (PURCHASE): -{paid_amount:.2f} TL from {cash_register.get('name')}")
            else:
                logger.warning(f"Cash register {cash_register_id} not found for PURCHASE payment")
        except Exception as e:
            logger.error(f"Failed to create cash movement for PURCHASE {tx_code}: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    # ==================== UNIFIED LEDGER KAYDI (PURCHASE) ====================
    try:
        # Kasa bilgisi
        register = await db.cash_registers.find_one({"id": cash_register_id}) if cash_register_id else None
        register_name = register.get("name") if register else None
        
        # İlk oluşturulan ürün bilgisi (güvenli erişim)
        first_product = created_products[0] if created_products and len(created_products) > 0 else {}
        ledger_product_id = first_product.get("id") if isinstance(first_product, dict) else None
        ledger_product_name = first_product.get("name") if isinstance(first_product, dict) else None
        
        await create_ledger_entry(
            entry_type="PURCHASE",
            transaction_date=now,
            
            # Alışta HAS girişi (ürün alıyoruz)
            has_in=round_has(total_has) if total_has else 0.0,
            has_out=0.0,
            
            # Para çıkışı (ödeme yaptıysak)
            currency=payment_currency if payment_currency else "TRY",
            amount_in=0.0,
            amount_out=float(paid_amount) if paid_amount else 0.0,
            
            # Taraflar
            party_id=party_id,
            party_name=party_name,
            party_type="SUPPLIER",
            
            # Kasa
            cash_register_id=cash_register_id,
            cash_register_name=register_name,
            
            # Ürün
            product_id=ledger_product_id,
            product_name=ledger_product_name,
            product_type_id=product_type_id,
            weight_gram=float(weight_gram) if weight_gram else None,
            
            # Referans
            reference_type="financial_transactions",
            reference_id=tx_code,
            
            description=f"Alış: {len(created_products)} ürün - {ledger_product_name or 'Ürün'}",
            created_by=user_id
        )
        logger.info(f"✅ Unified ledger entry created for PURCHASE: {tx_code}")
        
        # ==================== KAR/ZARAR LEDGER KAYDI ====================
        # Eğer PROFIT_LOSS seçildiyse ve fark varsa, ayrı bir kar/zarar kaydı oluştur
        if profit_loss_tl != 0 and abs(profit_loss_tl) > 1:
            # Kar mı zarar mı?
            if profit_loss_tl > 0:
                # KAR: Eksik ödedik, fark şirkete kaldı
                entry_type = "PURCHASE_PROFIT"
                description = f"Alış karı: {party_name} - {profit_loss_tl:.2f} TL ({profit_loss_has:.6f} HAS)"
            else:
                # ZARAR: Fazla ödedik
                entry_type = "PURCHASE_LOSS"
                description = f"Alış zararı: {party_name} - {abs(profit_loss_tl):.2f} TL ({abs(profit_loss_has):.6f} HAS)"
            
            await create_ledger_entry(
                entry_type=entry_type,
                transaction_date=now,
                
                # Kar > 0: HAS girişi (bize kaldı), Zarar < 0: HAS çıkışı (fazla ödedik)
                has_in=profit_loss_has if profit_loss_has > 0 else 0.0,
                has_out=abs(profit_loss_has) if profit_loss_has < 0 else 0.0,
                
                # TL karşılığı
                currency="TRY",
                amount_in=profit_loss_tl if profit_loss_tl > 0 else 0.0,
                amount_out=abs(profit_loss_tl) if profit_loss_tl < 0 else 0.0,
                
                # Taraflar
                party_id=party_id,
                party_name=party_name,
                party_type="CUSTOMER",
                
                # Referans
                reference_type="financial_transactions",
                reference_id=tx_code,
                
                description=description,
                created_by=user_id
            )
            logger.info(f"✅ {entry_type} ledger entry created: {profit_loss_tl:.2f} TL")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for PURCHASE {tx_code}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Return clean response
    return {
        "code": transaction_doc["code"],
        "type_code": transaction_doc["type_code"],
        "party_id": transaction_doc["party_id"],
        "transaction_date": transaction_doc["transaction_date"].isoformat(),
        "status": transaction_doc["status"],
        "total_has_amount": transaction_doc["total_has_amount"],
        "currency": transaction_doc["currency"],
        "total_amount_currency": transaction_doc["total_amount_currency"],
        "notes": transaction_doc["notes"],
        "created_products_count": len(created_products),
        "created_products": [{"id": p["id"], "barcode": p["barcode"], "name": p["name"]} for p in created_products]
    }

