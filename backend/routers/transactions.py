"""Financial Transaction routes - CRUD for all transaction types"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import logging

from database import get_db
from models.user import User
from models.transaction import (
    FinancialTransactionCreate, 
    FinancialTransactionResponse,
    TransactionCancelRequest,
    TransactionEditRequest
)
from auth import get_current_user

# Import transaction services from services package
from services import (
    create_purchase_transaction,
    create_sale_transaction,
    create_payment_transaction,
    create_receipt_transaction,
    create_exchange_transaction,
    create_hurda_transaction,
)

# Import ledger and cash services
from init_unified_ledger import create_void_entry, create_adjustment_entry
from cash_management import create_cash_movement_internal

router = APIRouter(prefix="/financial-transactions", tags=["Financial Transactions"])
logger = logging.getLogger(__name__)


@router.post("", status_code=201)
async def create_financial_transaction(
    data: FinancialTransactionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new financial transaction (PURCHASE, SALE, PAYMENT, RECEIPT, EXCHANGE, HURDA)"""
    db = get_db()
    
    try:
        type_code = data.type_code
        user_id = current_user["id"] if isinstance(current_user, dict) else str(current_user.id)
        
        # Route to appropriate handler
        if type_code == "PURCHASE":
            result = await create_purchase_transaction(data, user_id, db)
        elif type_code == "SALE":
            result = await create_sale_transaction(data, user_id, db)
        elif type_code == "PAYMENT":
            result = await create_payment_transaction(data, user_id, db)
        elif type_code == "RECEIPT":
            result = await create_receipt_transaction(data, user_id, db)
        elif type_code == "EXCHANGE":
            result = await create_exchange_transaction(data, user_id, db)
        elif type_code == "HURDA":
            result = await create_hurda_transaction(data, user_id, db)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported transaction type: {type_code}")
        
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Error creating financial transaction: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_financial_transactions(
    party_id: Optional[str] = None,
    type_code: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1, description="Sayfa numarası"),
    page_size: int = Query(10, ge=1, le=100, description="Sayfa başına kayıt"),
    sort_by: str = Query("transaction_date", description="Sıralama alanı"),
    sort_order: str = Query("desc", description="Sıralama yönü (asc/desc)"),
    current_user: User = Depends(get_current_user)
):
    """Get financial transactions with filters and pagination"""
    db = get_db()
    
    query = {}
    
    if party_id:
        query["party_id"] = party_id
    if type_code:
        query["type_code"] = type_code
    if status:
        query["status"] = status
    if start_date or end_date:
        query["transaction_date"] = {}
        if start_date:
            query["transaction_date"]["$gte"] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            query["transaction_date"]["$lte"] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    # Toplam kayıt sayısı
    total_items = await db.financial_transactions.count_documents(query)
    total_pages = (total_items + page_size - 1) // page_size
    
    # Sıralama yönü
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Sayfalama ile veri çek
    skip = (page - 1) * page_size
    transactions = await db.financial_transactions.find(
        query,
        {"_id": 0, "price_snapshot_id": 0}
    ).sort(sort_by, sort_direction).skip(skip).limit(page_size).to_list(page_size)
    
    # Collect unique party_ids to fetch party names
    party_ids = set(tx.get("party_id") for tx in transactions if tx.get("party_id"))
    party_names = {}
    if party_ids:
        parties = await db.parties.find(
            {"id": {"$in": list(party_ids)}}, 
            {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1, "company_name": 1, "party_type_id": 1}
        ).to_list(100)
        for p in parties:
            if p.get("party_type_id") == 1:  # Customer
                display_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or p.get("name")
            else:  # Supplier or other
                display_name = p.get("company_name") or p.get("name")
            party_names[p["id"]] = display_name
    
    # Product type code to Turkish name mapping
    product_type_names = {
        "GRAM_GOLD": "Gram Altın",
        "NECKLACE": "Kolye",
        "BRACELET": "Bilezik",
        "RING": "Yüzük",
        "EARRING": "Küpe",
        "SCRAP_GOLD": "Hurda Altın",
        "CEYREK": "Çeyrek",
        "YARIM": "Yarım",
        "TAM": "Tam",
        "ATA": "Ata",
        "RESAT": "Reşat",
        "HAMIT": "Hamit",
        "GOLD_BRACELET": "Altın Bilezik"
    }
    
    # Karat mapping
    karat_map = {1: "24K", 2: "22K", 3: "18K", 4: "14K", 5: "21K", 6: "8K", 7: "9K", 8: "10K"}
    
    # Process each transaction
    for tx in transactions:
        if isinstance(tx.get("transaction_date"), datetime):
            tx["transaction_date"] = tx["transaction_date"].isoformat()
        if isinstance(tx.get("created_at"), datetime):
            tx["created_at"] = tx["created_at"].isoformat()
        if isinstance(tx.get("updated_at"), datetime):
            tx["updated_at"] = tx["updated_at"].isoformat()
        
        # Add party_name if not present
        if not tx.get("party_name") and tx.get("party_id"):
            tx["party_name"] = party_names.get(tx["party_id"])
        
        # Convert lines to items format for frontend
        lines = tx.get("lines", [])
        items = []
        total_weight = 0.0
        
        for line in lines:
            product_name = line.get("note") or line.get("meta", {}).get("product_type_name") or ""
            if not product_name:
                product_type_code = line.get("product_type_code") or ""
                product_name = product_type_names.get(product_type_code, product_type_code)
            
            # Karat bilgisi
            karat_id = line.get("karat_id") or line.get("meta", {}).get("karat_id")
            karat_str = ""
            if karat_id:
                try:
                    karat_int = int(karat_id) if str(karat_id).isdigit() else karat_id
                    karat_str = karat_map.get(karat_int, f"{karat_id}K")
                except:
                    karat_str = str(karat_id)
            
            if not product_name and karat_str:
                weight = line.get("weight_gram") or 0
                if weight > 0:
                    product_name = f"Altın Ürün ({weight:.2f}gr)"
            
            item = {
                "product_name": product_name,
                "product_type": line.get("product_type_code") or "",
                "karat": karat_str,
                "weight_gram": line.get("weight_gram") or 0,
                "quantity": line.get("quantity") or 1,
                "line_total_has": line.get("line_total_has") or 0
            }
            items.append(item)
            total_weight += item["weight_gram"]
        
        tx["items"] = items if items else None
        tx["total_weight_gram"] = total_weight if total_weight > 0 else None
        
        # Remove lines from response (frontend uses items)
        if "lines" in tx:
            del tx["lines"]
    
    return {
        "data": transactions,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages
        }
    }


@router.get("/{code}")
async def get_financial_transaction(
    code: str,
    current_user: User = Depends(get_current_user)
):
    """Get single financial transaction by code"""
    db = get_db()
    
    tx = await db.financial_transactions.find_one({"code": code}, {"_id": 0})
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Convert datetime
    if isinstance(tx.get("transaction_date"), datetime):
        tx["transaction_date"] = tx["transaction_date"].isoformat()
    if isinstance(tx.get("created_at"), datetime):
        tx["created_at"] = tx["created_at"].isoformat()
    if isinstance(tx.get("updated_at"), datetime):
        tx["updated_at"] = tx["updated_at"].isoformat()
    if isinstance(tx.get("reconciled_at"), datetime):
        tx["reconciled_at"] = tx["reconciled_at"].isoformat()
    
    # Convert ObjectId fields to strings
    if tx.get("price_snapshot_id"):
        tx["price_snapshot_id"] = str(tx["price_snapshot_id"])
    
    # Convert nested _id in lines array
    if tx.get("lines"):
        for line in tx["lines"]:
            if line.get("_id"):
                line["_id"] = str(line["_id"])
            if line.get("referenced_tx_id") and hasattr(line["referenced_tx_id"], '__str__'):
                line["referenced_tx_id"] = str(line["referenced_tx_id"])
            if line.get("referenced_line_id") and hasattr(line["referenced_line_id"], '__str__'):
                line["referenced_line_id"] = str(line["referenced_line_id"])
    
    return tx


@router.post("/{trx_code}/cancel")
async def cancel_financial_transaction(
    trx_code: str,
    request: TransactionCancelRequest,
    current_user: User = Depends(get_current_user)
):
    """Cancel a transaction - creates VOID entry, reverses balances"""
    db = get_db()
    
    # 1. Find transaction
    trx = await db.financial_transactions.find_one({"code": trx_code})
    if not trx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # 2. Already cancelled?
    if trx.get("status") == "CANCELLED":
        raise HTTPException(status_code=400, detail="İşlem zaten iptal edilmiş")
    
    trx_type = trx.get("type_code")
    party_id = trx.get("party_id")
    total_has_amount = trx.get("total_has_amount", 0)
    
    # 3. Create VOID entry
    try:
        await create_void_entry(
            original_reference_type="financial_transactions",
            original_reference_id=trx_code,
            void_reason=f"{trx_type} iptali: {request.reason}",
            created_by=current_user.id,
            fallback_has_in=abs(total_has_amount) if total_has_amount < 0 else 0,
            fallback_has_out=total_has_amount if total_has_amount > 0 else 0,
            fallback_party_id=party_id,
            fallback_party_name=trx.get("party_name"),
            fallback_party_type=trx.get("party_type")
        )
        logger.info(f"Transaction VOID created: {trx_code}")
    except Exception as e:
        logger.error(f"Failed to create transaction VOID: {e}")
    
    # 4. Reverse party balance
    if party_id and total_has_amount != 0:
        balance_reversal = -total_has_amount
        await db.parties.update_one(
            {"id": party_id},
            {
                "$inc": {"has_balance": balance_reversal},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        logger.info(f"Party {party_id} balance reversed: {balance_reversal}")
    
    # 5. Reverse cash movements
    cash_register_id = trx.get("cash_register_id")
    if cash_register_id:
        cash_movements = await db.cash_movements.find({"reference_id": trx_code}).to_list(100)
        
        for cm in cash_movements:
            reverse_type = "OUT" if cm.get("type") == "IN" else "IN"
            try:
                await create_cash_movement_internal(
                    cash_register_id=cm.get("cash_register_id"),
                    movement_type=reverse_type,
                    amount=abs(cm.get("amount", 0)),
                    currency=cm.get("currency", "TRY"),
                    reference_type="CANCEL",
                    reference_id=trx_code,
                    description=f"İptal: {trx_code}",
                    created_by=current_user.id
                )
                logger.info(f"Cash movement reversed for {trx_code}")
            except Exception as e:
                logger.error(f"Failed to reverse cash movement: {e}")
    
    # 6. Restore stock for SALE
    if trx_type == "SALE":
        for line in trx.get("lines", []):
            product_id = line.get("product_id")
            if product_id:
                await db.products.update_one(
                    {"id": product_id},
                    {
                        "$set": {
                            "stock_status_id": 1,
                            "sold_at": None,
                            "sold_transaction_id": None,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                logger.info(f"Product {product_id} restored to stock")
    
    # 7. Delete products for PURCHASE (if not sold)
    if trx_type == "PURCHASE":
        for line in trx.get("lines", []):
            product_id = line.get("product_id")
            if product_id:
                product = await db.products.find_one({"id": product_id})
                if product and product.get("stock_status_id") != 2:
                    await db.products.delete_one({"id": product_id})
                    logger.info(f"Product {product_id} deleted (PURCHASE cancel)")
    
    # 8. Mark transaction as cancelled
    await db.financial_transactions.update_one(
        {"code": trx_code},
        {
            "$set": {
                "status": "CANCELLED",
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "cancelled_by": current_user.id,
                "cancel_reason": request.reason
            }
        }
    )
    
    return {
        "success": True,
        "message": f"İşlem iptal edildi: {trx_code}",
        "type": trx_type,
        "cancelled_at": datetime.now(timezone.utc).isoformat()
    }


@router.put("/{trx_code}")
async def edit_financial_transaction(
    trx_code: str,
    request: TransactionEditRequest,
    current_user: User = Depends(get_current_user)
):
    """Edit a transaction - only specific fields can be edited"""
    db = get_db()
    
    # 1. Find transaction
    trx = await db.financial_transactions.find_one({"code": trx_code})
    if not trx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # 2. Cannot edit cancelled transaction
    if trx.get("status") == "CANCELLED":
        raise HTTPException(status_code=400, detail="İptal edilmiş işlem düzenlenemez")
    
    trx_type = trx.get("type_code")
    party_id = trx.get("party_id")
    
    # 3. Save old values
    old_values = {
        "party_id": trx.get("party_id"),
        "transaction_date": trx.get("transaction_date"),
        "notes": trx.get("notes"),
        "payment_type": trx.get("payment_type"),
        "paid_amount": trx.get("paid_amount", 0),
        "payment_currency": trx.get("payment_currency"),
        "cash_register_id": trx.get("cash_register_id"),
        "discount_has": trx.get("discount_has", 0),
        "total_has_amount": trx.get("total_has_amount", 0)
    }
    
    # 4. Prepare update fields
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    changes = []
    
    if request.party_id is not None and request.party_id != old_values["party_id"]:
        update_fields["party_id"] = request.party_id
        new_party = await db.parties.find_one({"id": request.party_id})
        if new_party:
            update_fields["party_name"] = new_party.get("name")
        changes.append(f"Cari değişti")
    
    if request.transaction_date is not None:
        update_fields["transaction_date"] = request.transaction_date
        changes.append(f"Tarih değişti")
    
    if request.notes is not None:
        update_fields["notes"] = request.notes
        changes.append(f"Not güncellendi")
    
    if request.payment_type is not None:
        update_fields["payment_type"] = request.payment_type
        changes.append(f"Ödeme tipi değişti")
    
    if request.payment_currency is not None:
        update_fields["payment_currency"] = request.payment_currency
        changes.append(f"Para birimi değişti")
    
    # 5. Handle paid amount change
    old_paid = old_values["paid_amount"] or 0
    new_paid = request.paid_amount if request.paid_amount is not None else old_paid
    
    if request.paid_amount is not None and abs(new_paid - old_paid) > 0.01:
        update_fields["paid_amount"] = new_paid
        changes.append(f"Ödenen: {old_paid:.2f} → {new_paid:.2f}")
        
        payment_diff = new_paid - old_paid
        cash_register_id = request.cash_register_id or trx.get("cash_register_id")
        
        if cash_register_id and abs(payment_diff) > 0.01:
            try:
                movement_type = "IN" if payment_diff > 0 else "OUT"
                if trx_type in ["PURCHASE", "PAYMENT"]:
                    movement_type = "OUT" if payment_diff > 0 else "IN"
                
                await create_cash_movement_internal(
                    cash_register_id=cash_register_id,
                    movement_type=movement_type,
                    amount=abs(payment_diff),
                    currency=request.payment_currency or trx.get("payment_currency", "TRY"),
                    reference_type="EDIT",
                    reference_id=trx_code,
                    description=f"Düzenleme farkı: {trx_code}",
                    created_by=current_user.id
                )
            except Exception as e:
                logger.error(f"Failed to create payment diff cash movement: {e}")
    
    # 6. Handle discount change
    old_discount = old_values["discount_has"] or 0
    new_discount = request.discount_has if request.discount_has is not None else old_discount
    
    if request.discount_has is not None and abs(new_discount - old_discount) > 0.000001:
        update_fields["discount_has"] = new_discount
        
        if request.discount_description:
            update_fields["discount_description"] = request.discount_description
        
        changes.append(f"İndirim HAS: {old_discount:.6f} → {new_discount:.6f}")
        
        discount_diff = new_discount - old_discount
        old_total = old_values["total_has_amount"]
        new_total = old_total - discount_diff
        update_fields["total_has_amount"] = new_total
        
        if party_id:
            balance_diff = -discount_diff
            await db.parties.update_one(
                {"id": party_id},
                {
                    "$inc": {"has_balance": balance_diff},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            logger.info(f"Party {party_id} balance adjusted by {balance_diff}")
    
    # 7. No changes? Return early
    if len(changes) == 0:
        return {"success": True, "message": "Değişiklik yapılmadı", "code": trx_code}
    
    # 8. Update transaction
    await db.financial_transactions.update_one(
        {"code": trx_code},
        {"$set": update_fields}
    )
    
    # 9. Create adjustment entry
    try:
        adjustment_reason = f"{trx_type} düzenleme: " + ", ".join(changes)
        has_diff = 0
        if request.discount_has is not None:
            has_diff = new_discount - old_discount
        
        await create_adjustment_entry(
            original_reference_type="financial_transactions",
            original_reference_id=trx_code,
            adjustment_reason=adjustment_reason,
            has_in_diff=has_diff if has_diff > 0 else 0,
            has_out_diff=abs(has_diff) if has_diff < 0 else 0,
            created_by=current_user.id
        )
        logger.info(f"Transaction ADJUSTMENT created: {trx_code}")
    except Exception as e:
        logger.error(f"Failed to create transaction ADJUSTMENT: {e}")
    
    return {
        "success": True,
        "message": f"İşlem düzenlendi: {trx_code}",
        "changes": changes,
        "code": trx_code
    }
