"""Reports routes - Profit/Loss, Account Statements, Gold Movements"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime
import logging

from database import get_db
from models.user import User
from auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])
logger = logging.getLogger(__name__)


@router.get("/profit-loss")
async def get_profit_loss_report(
    start_date: str = Query(..., description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Bitiş tarihi (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user)
):
    """
    Kar/Zarar Raporu - Unified Ledger'dan hesaplanır
    
    MANTIK:
    - ALIŞ = Stok girişi (gider DEĞİL!)
    - SATIŞ = Gelir
    - KAR = Satış Geliri - Satılan Ürünün Maliyeti (COGS)
    
    GELİRLER:
    - Satış Gelirleri (amount_in)
    - Alış Karları (PURCHASE_PROFIT)
    - Döviz Karları (EXCHANGE pozitif)
    
    GİDERLER:
    - Satılan Ürünlerin Maliyeti (COGS) = SALE'deki cost_has
    - İşletme Giderleri (EXPENSE)
    - Maaşlar (SALARY_PAYMENT)
    - Alış Zararları (PURCHASE_LOSS)
    - Döviz Zararları (EXCHANGE negatif)
    """
    db = get_db()
    
    # Tarih formatı doğrulama
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="Geçersiz tarih formatı. Format: YYYY-MM-DD")
    
    # Unified Ledger'dan verileri çek
    query = {
        "transaction_date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }
    
    ledger_entries = await db.unified_ledger.find(query, {"_id": 0}).to_list(length=None)
    
    # Başlangıç değerleri - GELİRLER
    revenues = {
        "sales": {"tl": 0, "has": 0, "count": 0},           # Satış gelirleri
        "receipts": {"tl": 0, "has": 0, "count": 0},        # Tahsilatlar
        "purchase_profit": {"tl": 0, "has": 0, "count": 0}, # Alıştan kar (eksik ödeme)
        "payment_discount": {"tl": 0, "has": 0, "count": 0}, # Ödeme iskontoları
        "exchange_profit": {"tl": 0, "has": 0, "count": 0}, # Döviz karları
        "total": {"tl": 0, "has": 0, "count": 0}
    }
    
    # GİDERLER - ALIŞ artık GİDER DEĞİL!
    expenses = {
        "cogs": {"tl": 0, "has": 0, "count": 0},            # Satılan Ürünlerin Maliyeti (Cost of Goods Sold)
        "operating_expenses": {"tl": 0, "has": 0, "count": 0}, # İşletme Giderleri
        "salaries": {"tl": 0, "has": 0, "count": 0},        # Maaşlar
        "purchase_loss": {"tl": 0, "has": 0, "count": 0},   # Alıştan zarar (fazla ödeme)
        "exchange_loss": {"tl": 0, "has": 0, "count": 0},   # Döviz zararları
        "total": {"tl": 0, "has": 0, "count": 0}
    }
    
    # Stok bilgisi (bilgi amaçlı)
    stock_info = {
        "purchases": {"tl": 0, "has": 0, "count": 0},  # Dönem içi alışlar
        "sales_has": 0  # Dönem içi satılan HAS
    }
    
    details = []
    
    for entry in ledger_entries:
        entry_type = entry.get("type", "")
        
        amount_in = entry.get("amount_in", 0) or 0
        amount_out = entry.get("amount_out", 0) or 0
        has_in = entry.get("has_in", 0) or 0
        has_out = entry.get("has_out", 0) or 0
        cost_has = entry.get("cost_has", 0) or 0
        cost_tl = entry.get("cost_tl", 0) or 0
        profit_has = entry.get("profit_has", 0) or 0
        profit_tl = entry.get("profit_tl", 0) or 0
        
        detail_entry = {
            "id": entry.get("id"),
            "date": (entry.get("transaction_date") or "")[:10],
            "type": entry_type,
            "description": entry.get("description", ""),
            "revenue_tl": 0,
            "revenue_has": 0,
            "expense_tl": 0,
            "expense_has": 0,
            "profit_tl": 0,
            "profit_has": 0
        }
        
        # SATIŞLAR (GELİR + MALİYET)
        if entry_type == "SALE":
            # Satış geliri = amount_in (tahsilat)
            revenues["sales"]["tl"] += amount_in
            revenues["sales"]["has"] += profit_has  # Net kar HAS
            revenues["sales"]["count"] += 1
            detail_entry["revenue_tl"] = amount_in
            detail_entry["revenue_has"] = profit_has
            detail_entry["profit_tl"] = profit_tl
            detail_entry["profit_has"] = profit_has
            
            # Satılan ürünün maliyeti (COGS) - artık cost_tl var!
            if cost_has > 0 or cost_tl > 0:
                expenses["cogs"]["has"] += cost_has
                expenses["cogs"]["tl"] += cost_tl
                expenses["cogs"]["count"] += 1
            
            stock_info["sales_has"] += has_out
        
        # TAHSİLATLAR - Party tipine göre ayır
        elif entry_type == "RECEIPT":
            party_type = entry.get("party_type", "")
            receipt_tl = amount_in or 0
            receipt_has = has_in or 0
            
            # Tedarikçiden tahsilat = Bilanço hareketi, Kar/Zarar'a yansımaz
            if party_type == "SUPPLIER":
                continue  # Detay listesine ekleme
            else:
                # Müşteriden tahsilat = GELİR
                revenues["receipts"]["tl"] += receipt_tl
                revenues["receipts"]["has"] += receipt_has
                revenues["receipts"]["count"] += 1
                detail_entry["revenue_tl"] = receipt_tl
                detail_entry["revenue_has"] = receipt_has
                detail_entry["profit_tl"] = receipt_tl
                detail_entry["profit_has"] = receipt_has
        
        # ÖDEMELER - İskonto varsa KAR olarak kaydet
        elif entry_type == "PAYMENT":
            # PAYMENT normalde bilanço hareketi, Kar/Zarar'a yansımaz
            # AMA iskonto varsa bu bir KAR
            payment_profit_has = entry.get("profit_has", 0) or 0
            payment_profit_tl = entry.get("profit_tl", 0) or 0
            
            if payment_profit_has > 0.001 or payment_profit_tl > 0.01:
                revenues["payment_discount"]["tl"] += payment_profit_tl
                revenues["payment_discount"]["has"] += payment_profit_has
                revenues["payment_discount"]["count"] += 1
                detail_entry["revenue_tl"] = payment_profit_tl
                detail_entry["revenue_has"] = payment_profit_has
                detail_entry["profit_tl"] = payment_profit_tl
                detail_entry["profit_has"] = payment_profit_has
            else:
                # İskonto yok, normal borç kapatma - Kar/Zarar'a yansımaz
                continue
        
        # ALIŞ KARI (GELİR)
        elif entry_type in ["PURCHASE_PROFIT", "PURCHASE_PROFIT_LOSS"]:
            profit_amount = entry.get("profit_amount", 0) or amount_in or 0
            profit_has_val = profit_has or has_in or 0
            if profit_amount > 0 or profit_has_val > 0:
                revenues["purchase_profit"]["tl"] += profit_amount
                revenues["purchase_profit"]["has"] += profit_has_val
                revenues["purchase_profit"]["count"] += 1
                detail_entry["revenue_tl"] = profit_amount
                detail_entry["revenue_has"] = profit_has_val
                detail_entry["profit_tl"] = profit_amount
                detail_entry["profit_has"] = profit_has_val
        
        # ALIŞLAR - STOK GİRİŞİ (GİDER DEĞİL!)
        elif entry_type == "PURCHASE":
            # Sadece stok bilgisi olarak tut
            stock_info["purchases"]["tl"] += amount_out
            stock_info["purchases"]["has"] += has_in
            stock_info["purchases"]["count"] += 1
            # Bu detail'e eklenmez çünkü kar/zarar etkisi yok
            continue  # Detay listesine ekleme
        
        # İŞLETME GİDERLERİ (GİDER)
        elif entry_type == "EXPENSE":
            expenses["operating_expenses"]["tl"] += amount_out
            expenses["operating_expenses"]["count"] += 1
            detail_entry["expense_tl"] = amount_out
            detail_entry["profit_tl"] = -amount_out  # Gider = negatif kar
        
        # MAAŞLAR (GİDER) - SADECE ÖDEME, TAHAKKUK DEĞİL!
        elif entry_type == "SALARY_PAYMENT":
            expenses["salaries"]["tl"] += amount_out
            expenses["salaries"]["count"] += 1
            detail_entry["expense_tl"] = amount_out
            detail_entry["profit_tl"] = -amount_out  # Gider = negatif kar
        
        # MAAŞ TAHAKKUKU - Kar/Zarar'a YANSIMAZ (borç kaydı)
        elif entry_type == "SALARY_ACCRUAL":
            # Tahakkuk bir borç kaydıdır, gider değildir
            # Sadece personele borç oluşur, kasa hareketi yok
            detail_entry["expense_tl"] = 0  # Gider değil
            detail_entry["profit_tl"] = 0   # Kar/Zarar'a yansımaz
        
        # ALIŞ ZARARI (GİDER)
        elif entry_type == "PURCHASE_LOSS":
            loss_amount = entry.get("loss_amount", 0) or amount_out or 0
            loss_has = entry.get("loss_has", 0) or has_out or 0
            expenses["purchase_loss"]["tl"] += loss_amount
            expenses["purchase_loss"]["has"] += loss_has
            expenses["purchase_loss"]["count"] += 1
            detail_entry["expense_tl"] = loss_amount
            detail_entry["expense_has"] = loss_has
            detail_entry["profit_tl"] = -loss_amount
            detail_entry["profit_has"] = -loss_has
        
        # DÖVİZ İŞLEMLERİ (Kar veya Zarar) - artık profit_tl var!
        elif entry_type == "EXCHANGE":
            exchange_profit_tl = profit_tl  # Yeni alan
            exchange_profit_has = profit_has or entry.get("has_net", 0) or 0
            
            if exchange_profit_has > 0:
                revenues["exchange_profit"]["has"] += exchange_profit_has
                revenues["exchange_profit"]["tl"] += exchange_profit_tl if exchange_profit_tl > 0 else 0
                revenues["exchange_profit"]["count"] += 1
                detail_entry["revenue_has"] = exchange_profit_has
                detail_entry["revenue_tl"] = exchange_profit_tl
                detail_entry["profit_tl"] = exchange_profit_tl
                detail_entry["profit_has"] = exchange_profit_has
            elif exchange_profit_has < 0:
                expenses["exchange_loss"]["has"] += abs(exchange_profit_has)
                expenses["exchange_loss"]["tl"] += abs(exchange_profit_tl) if exchange_profit_tl < 0 else 0
                expenses["exchange_loss"]["count"] += 1
                detail_entry["expense_has"] = abs(exchange_profit_has)
                detail_entry["expense_tl"] = abs(exchange_profit_tl)
                detail_entry["profit_tl"] = exchange_profit_tl  # negatif
                detail_entry["profit_has"] = exchange_profit_has  # negatif
        
        # VOID kayıtları (iptal)
        elif entry_type == "VOID":
            adjustment_reason = entry.get("adjustment_reason", "") or ""
            original_type = entry.get("reference_type", "") or ""
            
            if "SALE" in adjustment_reason.upper() or "SALE" in original_type.upper():
                revenues["sales"]["tl"] -= amount_out
                revenues["sales"]["has"] -= has_in
                detail_entry["revenue_tl"] = -amount_out
                detail_entry["revenue_has"] = -has_in
        
        # Detay listesine ekle (sadece kar/zarar etkisi olanlar)
        if detail_entry["revenue_tl"] != 0 or detail_entry["revenue_has"] != 0 or detail_entry["expense_tl"] != 0 or detail_entry["expense_has"] != 0:
            details.append(detail_entry)
    
    # Toplamları hesapla
    revenues["total"]["tl"] = sum(v["tl"] for k, v in revenues.items() if k != "total")
    revenues["total"]["has"] = sum(v["has"] for k, v in revenues.items() if k != "total")
    revenues["total"]["count"] = sum(v["count"] for k, v in revenues.items() if k != "total")
    
    expenses["total"]["tl"] = sum(v["tl"] for k, v in expenses.items() if k != "total")
    expenses["total"]["has"] = sum(v["has"] for k, v in expenses.items() if k != "total")
    expenses["total"]["count"] = sum(v["count"] for k, v in expenses.items() if k != "total")
    
    # Net kar/zarar TL
    net_profit_tl = revenues["total"]["tl"] - expenses["total"]["tl"]
    
    # Net kar/zarar HAS = Kar TL / HAS Satış Fiyatı
    # Güncel HAS satış fiyatını al
    price_snapshot = await db.price_snapshots.find_one(
        {}, sort=[("captured_at", -1)]
    )
    has_sell_price = price_snapshot.get("has_sell_tl", 6000) if price_snapshot else 6000
    
    # Net kar'ın HAS karşılığını hesapla
    if has_sell_price and has_sell_price > 0:
        net_profit_has = net_profit_tl / has_sell_price
    else:
        net_profit_has = 0
    
    return {
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "summary": {
            "total_revenue_tl": round(revenues["total"]["tl"], 2),
            "total_revenue_has": round(revenues["total"]["has"], 6),
            "total_expense_tl": round(expenses["total"]["tl"], 2),
            "total_expense_has": round(expenses["total"]["has"], 6),
            "net_profit_tl": round(net_profit_tl, 2),
            "net_profit_has": round(net_profit_has, 6)
        },
        "revenues": revenues,
        "expenses": expenses,
        "stock_info": stock_info,  # Bilgi amaçlı stok verisi
        "details": details
    }


@router.get("/unified-ledger")
async def get_unified_ledger(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    party_id: Optional[str] = None,
    party_type: Optional[str] = None,
    cash_register_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get unified ledger entries with filters"""
    db = get_db()
    query = {}
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    if type:
        query["type"] = type
    if party_id:
        query["party_id"] = party_id
    if party_type:
        query["party_type"] = party_type
    if cash_register_id:
        query["cash_register_id"] = cash_register_id
    
    total = await db.unified_ledger.count_documents(query)
    
    entries = await db.unified_ledger.find(query, {"_id": 0}).sort([
        ("transaction_date", -1),
        ("created_at", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "entries": entries,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 1
        }
    }


@router.get("/unified-ledger/summary")
async def get_ledger_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get summary by type"""
    db = get_db()
    match_query = {}
    if start_date:
        match_query["transaction_date"] = {"$gte": start_date}
    if end_date:
        if "transaction_date" in match_query:
            match_query["transaction_date"]["$lte"] = end_date
        else:
            match_query["transaction_date"] = {"$lte": end_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total_has_in": {"$sum": "$has_in"},
            "total_has_out": {"$sum": "$has_out"},
            "total_amount_in": {"$sum": "$amount_in"},
            "total_amount_out": {"$sum": "$amount_out"},
            "total_profit": {"$sum": {"$ifNull": ["$profit_has", 0]}},
            "total_cost": {"$sum": {"$ifNull": ["$cost_has", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.unified_ledger.aggregate(pipeline).to_list(100)
    
    # Calculate totals
    totals = {
        "total_has_in": round(sum(r["total_has_in"] for r in results), 6),
        "total_has_out": round(sum(r["total_has_out"] for r in results), 6),
        "total_amount_in": round(sum(r["total_amount_in"] for r in results), 2),
        "total_amount_out": round(sum(r["total_amount_out"] for r in results), 2),
        "total_profit": round(sum(r["total_profit"] for r in results), 6),
        "total_cost": round(sum(r["total_cost"] for r in results), 6),
        "entry_count": sum(r["count"] for r in results)
    }
    
    return {
        "by_type": results,
        "totals": totals,
        "start_date": start_date,
        "end_date": end_date
    }


@router.get("/gold-movements")
async def get_gold_movements_report(
    start_date: str = Query(..., description="Başlangıç tarihi (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Bitiş tarihi (YYYY-MM-DD)"),
    product_type: Optional[str] = Query(None, description="Ürün tipi filtresi"),
    karat: Optional[str] = Query(None, description="Ayar filtresi"),
    current_user: User = Depends(get_current_user)
):
    """
    Altın Hareketleri Raporu - Giriş/Çıkış Hareketleri
    Ürün tipi ve ayar bazında gruplar.
    """
    db = get_db()
    
    # Tarih formatı doğrulama
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="Geçersiz tarih formatı. Format: YYYY-MM-DD")
    
    # Karat mapping
    karat_map = {1: "24K", 2: "22K", 3: "18K", 4: "14K", 5: "8K"}
    
    # Financial transactions'dan verileri çek (lines dahil)
    ft_query = {
        "transaction_date": {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date + "T23:59:59")
        }
    }
    financial_txs = await db.financial_transactions.find(ft_query).to_list(length=None)
    
    # Sonuç yapıları
    sales = {"items": {}, "totals": {"gram": 0, "has": 0, "cash": 0, "credit": 0, "count": 0}}
    purchases = {"items": {}, "totals": {"gram": 0, "has": 0, "paid": 0, "debt": 0, "count": 0}}
    scrap_payments = {"items": {}, "totals": {"gram": 0, "has": 0, "tl_value": 0, "count": 0}}
    
    def get_product_type_from_note(note: str) -> str:
        """Note alanından ürün tipini belirle"""
        note_lower = note.lower() if note else ""
        if "hurda" in note_lower:
            return "Hurda"
        elif "gram altın" in note_lower or "gram altin" in note_lower:
            return "Gram Altın"
        elif "çeyrek" in note_lower or "ceyrek" in note_lower:
            return "Çeyrek"
        elif "yarım" in note_lower or "yarim" in note_lower:
            return "Yarım"
        elif "tam" in note_lower or "cumhuriyet" in note_lower:
            return "Tam Altın"
        elif "bilezik" in note_lower:
            return "Bilezik"
        elif "kolye" in note_lower:
            return "Kolye"
        elif "yüzük" in note_lower or "yuzuk" in note_lower:
            return "Yüzük"
        elif "küpe" in note_lower or "kupe" in note_lower:
            return "Küpe"
        return "Diğer"
    
    for tx in financial_txs:
        tx_type = tx.get("type_code", "")
        lines = tx.get("lines", [])
        amount_in = tx.get("total_amount_currency", 0) or 0
        
        # SATIŞ İŞLEMLERİ
        if tx_type == "SALE":
            for line in lines:
                # Ürün bilgilerini al
                note = line.get("note", "") or ""
                karat_id = line.get("karat_id")
                line_total_has = line.get("line_total_has", 0) or 0
                
                # SATILAN GRAM MİKTARI
                meta = line.get("meta", {})
                sold_gram = meta.get("sale_quantity") or line.get("quantity", 0) or 0
                
                # Ayar
                karat_value = karat_map.get(karat_id, "Bilinmeyen")
                
                # Ürün tipi
                product_type_name = get_product_type_from_note(note)
                
                # Filtre uygula
                if product_type and product_type != "all" and product_type_name.lower() != product_type.lower():
                    continue
                if karat and karat != "all" and karat_value != karat:
                    continue
                
                group_key = f"{product_type_name}|{karat_value}"
                
                # Peşin vs Veresiye
                meta = tx.get("meta", {})
                is_credit_sale = meta.get("is_credit_sale", False)
                line_cash = amount_in / len(lines) if not is_credit_sale and len(lines) > 0 else 0
                line_credit = (line.get("line_amount_currency", 0) or 0) if is_credit_sale else 0
                
                if group_key not in sales["items"]:
                    sales["items"][group_key] = {
                        "product_type": product_type_name,
                        "karat": karat_value,
                        "total_gram": 0,
                        "total_has": 0,
                        "cash_amount": 0,
                        "credit_amount": 0,
                        "transaction_count": 0
                    }
                
                sales["items"][group_key]["total_gram"] += sold_gram
                sales["items"][group_key]["total_has"] += line_total_has
                sales["items"][group_key]["cash_amount"] += line_cash
                sales["items"][group_key]["credit_amount"] += line_credit
                sales["items"][group_key]["transaction_count"] += 1
                
                sales["totals"]["gram"] += sold_gram
                sales["totals"]["has"] += line_total_has
                sales["totals"]["cash"] += line_cash
                sales["totals"]["credit"] += line_credit
                sales["totals"]["count"] += 1
        
        # ALIŞ İŞLEMLERİ
        elif tx_type == "PURCHASE":
            for line in lines:
                note = line.get("note", "") or ""
                karat_id = line.get("karat_id")
                line_total_has = line.get("line_total_has", 0) or 0
                
                # ALINAN GRAM MİKTARI
                meta = line.get("meta", {})
                purchased_gram = meta.get("purchase_quantity") or line.get("quantity", 0) or line.get("weight_gram", 0) or 0
                
                karat_value = karat_map.get(karat_id, "Bilinmeyen")
                product_type_name = get_product_type_from_note(note)
                
                if product_type and product_type != "all" and product_type_name.lower() != product_type.lower():
                    continue
                if karat and karat != "all" and karat_value != karat:
                    continue
                
                group_key = f"{product_type_name}|{karat_value}"
                
                amount_out = tx.get("total_amount_currency", 0) or 0
                line_paid = amount_out / len(lines) if len(lines) > 0 else 0
                
                if group_key not in purchases["items"]:
                    purchases["items"][group_key] = {
                        "product_type": product_type_name,
                        "karat": karat_value,
                        "total_gram": 0,
                        "total_has": 0,
                        "paid_amount": 0,
                        "debt_amount": 0,
                        "transaction_count": 0
                    }
                
                purchases["items"][group_key]["total_gram"] += purchased_gram
                purchases["items"][group_key]["total_has"] += line_total_has
                purchases["items"][group_key]["paid_amount"] += line_paid
                purchases["items"][group_key]["transaction_count"] += 1
                
                purchases["totals"]["gram"] += purchased_gram
                purchases["totals"]["has"] += line_total_has
                purchases["totals"]["paid"] += line_paid
                purchases["totals"]["count"] += 1
        
        # HURDA ÖDEME (PAYMENT with has_out)
        elif tx_type == "PAYMENT":
            for line in lines:
                has_out = line.get("line_total_has", 0) or 0
                if has_out > 0:
                    note = line.get("note", "") or ""
                    karat_id = line.get("karat_id")
                    weight_gram = line.get("weight_gram", 0) or 0
                    
                    karat_value = karat_map.get(karat_id, "Bilinmeyen")
                    product_type_name = get_product_type_from_note(note)
                    
                    if product_type and product_type != "all" and product_type_name.lower() != product_type.lower():
                        continue
                    if karat and karat != "all" and karat_value != karat:
                        continue
                    
                    group_key = f"{product_type_name}|{karat_value}"
                    
                    if group_key not in scrap_payments["items"]:
                        scrap_payments["items"][group_key] = {
                            "product_type": product_type_name,
                            "karat": karat_value,
                            "total_gram": 0,
                            "total_has": 0,
                            "tl_value": 0,
                            "transaction_count": 0
                        }
                    
                    scrap_payments["items"][group_key]["total_gram"] += weight_gram
                    scrap_payments["items"][group_key]["total_has"] += has_out
                    scrap_payments["items"][group_key]["transaction_count"] += 1
                    
                    scrap_payments["totals"]["gram"] += weight_gram
                    scrap_payments["totals"]["has"] += has_out
                    scrap_payments["totals"]["count"] += 1
    
    # Dict'leri list'e çevir ve sırala
    sales["items"] = sorted(list(sales["items"].values()), key=lambda x: (x["product_type"], x["karat"]))
    purchases["items"] = sorted(list(purchases["items"].values()), key=lambda x: (x["product_type"], x["karat"]))
    scrap_payments["items"] = sorted(list(scrap_payments["items"].values()), key=lambda x: (x["product_type"], x["karat"]))
    
    # Özet hesapla
    total_out_gram = sales["totals"]["gram"] + scrap_payments["totals"]["gram"]
    total_out_has = sales["totals"]["has"] + scrap_payments["totals"]["has"]
    total_in_gram = purchases["totals"]["gram"]
    total_in_has = purchases["totals"]["has"]
    
    return {
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "sales": sales,
        "purchases": purchases,
        "scrap_payments": scrap_payments,
        "summary": {
            "total_out_gram": round(total_out_gram, 2),
            "total_out_has": round(total_out_has, 6),
            "total_in_gram": round(total_in_gram, 2),
            "total_in_has": round(total_in_has, 6),
            "net_gram": round(total_in_gram - total_out_gram, 2),
            "net_has": round(total_in_has - total_out_has, 6)
        }
    }

