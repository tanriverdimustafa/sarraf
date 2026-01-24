"""
Expense Management Module
Gider yönetimi - kategoriler ve gider kayıtları
"""

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
import logging
import uuid

# Import unified ledger for dual-write
from init_unified_ledger import create_ledger_entry, create_adjustment_entry, create_void_entry

logger = logging.getLogger("expense_management")

# Database reference
db = None

def set_expense_db(database):
    """Set database reference"""
    global db
    db = database

# ==================== PYDANTIC MODELS ====================

class ExpenseCategoryCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ExpenseCreate(BaseModel):
    category_id: str
    description: str
    amount: float
    currency: Optional[str] = "TRY"
    payment_method: Optional[str] = "CASH_TRY"
    cash_register_id: str
    expense_date: str
    payee: Optional[str] = None
    receipt_no: Optional[str] = None
    notes: Optional[str] = None
    # Döviz alanları
    exchange_rate: Optional[float] = None
    foreign_amount: Optional[float] = None

class ExpenseUpdate(BaseModel):
    category_id: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    payee: Optional[str] = None
    receipt_no: Optional[str] = None
    notes: Optional[str] = None

# ==================== DEFAULT CATEGORIES ====================

DEFAULT_EXPENSE_CATEGORIES = [
    {"code": "RENT", "name": "Kira", "description": "Dükkan kirası"},
    {"code": "BILL_ELECTRIC", "name": "Elektrik", "description": "Elektrik faturası"},
    {"code": "BILL_WATER", "name": "Su", "description": "Su faturası"},
    {"code": "BILL_GAS", "name": "Doğalgaz", "description": "Doğalgaz faturası"},
    {"code": "BILL_INTERNET", "name": "İnternet", "description": "İnternet faturası"},
    {"code": "BILL_PHONE", "name": "Telefon", "description": "Telefon faturası"},
    {"code": "FIXTURE", "name": "Demirbaş", "description": "Manken, vitrin, kasa, para sayma makinesi"},
    {"code": "SUPPLY", "name": "Sarf Malzeme", "description": "Poşet, kutu, etiket, kağıt"},
    {"code": "MAINTENANCE", "name": "Bakım/Onarım", "description": "Tamirat, servis"},
    {"code": "TAX", "name": "Vergi", "description": "Vergi ödemeleri"},
    {"code": "INSURANCE", "name": "Sigorta", "description": "İşyeri sigortası"},
    {"code": "SALARY", "name": "Maaş", "description": "Personel maaşları"},
    {"code": "OTHER", "name": "Diğer", "description": "Diğer giderler"},
]

# ==================== CATEGORY FUNCTIONS ====================

async def init_expense_categories():
    """Initialize default expense categories if not exists"""
    if db is None:
        logger.error("Database not set for expense management")
        return
    
    existing = await db.expense_categories.count_documents({})
    if existing > 0:
        logger.info(f"Expense categories already exist: {existing}")
        return
    
    for idx, cat in enumerate(DEFAULT_EXPENSE_CATEGORIES, 1):
        cat_doc = {
            "id": f"CAT-{str(idx).zfill(3)}",
            "code": cat["code"],
            "name": cat["name"],
            "description": cat.get("description", ""),
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.expense_categories.insert_one(cat_doc)
    
    logger.info(f"Created {len(DEFAULT_EXPENSE_CATEGORIES)} default expense categories")

async def get_expense_categories(is_active: Optional[bool] = None):
    """Get all expense categories"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    categories = []
    async for cat in db.expense_categories.find(query, {"_id": 0}).sort("name", 1):
        categories.append(cat)
    return categories

async def get_expense_category(category_id: str):
    """Get single category by ID"""
    return await db.expense_categories.find_one({"id": category_id}, {"_id": 0})

async def create_expense_category(data: ExpenseCategoryCreate):
    """Create new expense category"""
    # Check if code exists
    existing = await db.expense_categories.find_one({"code": data.code})
    if existing:
        raise ValueError(f"Category with code {data.code} already exists")
    
    # Generate ID
    count = await db.expense_categories.count_documents({})
    cat_id = f"CAT-{str(count + 1).zfill(3)}"
    
    cat_doc = {
        "id": cat_id,
        "code": data.code.upper(),
        "name": data.name,
        "description": data.description or "",
        "is_active": data.is_active if data.is_active is not None else True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.expense_categories.insert_one(cat_doc)
    logger.info(f"Created expense category: {cat_id} - {data.name}")
    
    return {k: v for k, v in cat_doc.items() if k != "_id"}

async def update_expense_category(category_id: str, data: ExpenseCategoryUpdate):
    """Update expense category"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise ValueError("No fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.expense_categories.update_one(
        {"id": category_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise ValueError("Category not found or no changes made")
    
    return await get_expense_category(category_id)

async def delete_expense_category(category_id: str):
    """Delete expense category (soft delete - set is_active=False)"""
    # Check if category has expenses
    expense_count = await db.expenses.count_documents({"category_id": category_id})
    if expense_count > 0:
        # Soft delete
        await db.expense_categories.update_one(
            {"id": category_id},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
        )
        return {"message": "Category deactivated (has expenses)", "expense_count": expense_count}
    else:
        # Hard delete
        result = await db.expense_categories.delete_one({"id": category_id})
        if result.deleted_count == 0:
            raise ValueError("Category not found")
        return {"message": "Category deleted"}

# ==================== EXPENSE FUNCTIONS ====================

def generate_expense_id():
    """Generate unique expense ID"""
    date_str = datetime.now().strftime("%Y%m%d")
    unique = uuid.uuid4().hex[:4].upper()
    return f"EXP-{date_str}-{unique}"

async def get_expenses(
    category_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 50
):
    """Get expenses with filters"""
    query = {}
    
    if category_id:
        query["category_id"] = category_id
    
    if start_date:
        query["expense_date"] = {"$gte": start_date}
    
    if end_date:
        if "expense_date" in query:
            query["expense_date"]["$lte"] = end_date
        else:
            query["expense_date"] = {"$lte": end_date}
    
    # Get total count
    total = await db.expenses.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * page_size
    expenses = []
    
    # Sıralama: En son tarih en üstte, aynı tarihte en son eklenen en üstte
    async for exp in db.expenses.find(query, {"_id": 0}).sort([("expense_date", -1), ("created_at", -1)]).skip(skip).limit(page_size):
        # Get category info
        category = await db.expense_categories.find_one({"id": exp.get("category_id")}, {"_id": 0, "name": 1, "code": 1})
        exp["category_name"] = category.get("name") if category else "Bilinmiyor"
        exp["category_code"] = category.get("code") if category else ""
        expenses.append(exp)
    
    return {
        "expenses": expenses,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "total_records": total
        }
    }

async def get_expense(expense_id: str):
    """Get single expense by ID"""
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if expense:
        category = await db.expense_categories.find_one({"id": expense.get("category_id")}, {"_id": 0, "name": 1, "code": 1})
        expense["category_name"] = category.get("name") if category else "Bilinmiyor"
        expense["category_code"] = category.get("code") if category else ""
    return expense

async def create_expense(data: ExpenseCreate, user_id: str, create_cash_movement_func):
    """Create new expense with cash movement"""
    # Validate category
    category = await db.expense_categories.find_one({"id": data.category_id})
    if not category:
        raise ValueError(f"Category not found: {data.category_id}")
    
    # Generate ID
    expense_id = generate_expense_id()
    
    # Calculate foreign amount if exchange rate provided
    foreign_amount = None
    if data.exchange_rate and data.exchange_rate > 0:
        foreign_amount = data.amount / data.exchange_rate
    elif data.foreign_amount:
        foreign_amount = data.foreign_amount
    
    # Determine currency from payment method
    payment_currency = "TRY"
    if data.payment_method and "USD" in data.payment_method:
        payment_currency = "USD"
    elif data.payment_method and "EUR" in data.payment_method:
        payment_currency = "EUR"
    
    expense_doc = {
        "id": expense_id,
        "category_id": data.category_id,
        "category_code": category.get("code"),
        "description": data.description,
        "amount": data.amount,  # TL tutarı
        "currency": data.currency or "TRY",
        "payment_method": data.payment_method or "CASH_TRY",
        "payment_currency": payment_currency,
        "cash_register_id": data.cash_register_id,
        "expense_date": data.expense_date,
        "payee": data.payee,
        "receipt_no": data.receipt_no,
        "notes": data.notes,
        "exchange_rate": data.exchange_rate,
        "foreign_amount": foreign_amount,
        "created_at": datetime.now(timezone.utc),
        "created_by": user_id,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.expenses.insert_one(expense_doc)
    
    # Create cash movement (OUT)
    try:
        # Döviz ile ödeme ise döviz tutarını kasadan düş
        if payment_currency in ['USD', 'EUR'] and foreign_amount and foreign_amount > 0:
            await create_cash_movement_func(
                cash_register_id=data.cash_register_id,
                movement_type="OUT",
                amount=foreign_amount,
                currency=payment_currency,
                reference_type="EXPENSE",
                reference_id=expense_id,
                description=f"Gider: {data.description}",
                created_by=user_id,
                transaction_date=datetime.fromisoformat(data.expense_date.replace('Z', '+00:00')) if 'T' in data.expense_date else datetime.strptime(data.expense_date, '%Y-%m-%d')
            )
            logger.info(f"Cash movement created for expense {expense_id}: -{foreign_amount:.2f} {payment_currency}")
        else:
            # Normal TL ödeme
            await create_cash_movement_func(
                cash_register_id=data.cash_register_id,
                movement_type="OUT",
                amount=data.amount,
                currency="TRY",
                reference_type="EXPENSE",
                reference_id=expense_id,
                description=f"Gider: {data.description}",
                created_by=user_id,
                transaction_date=datetime.fromisoformat(data.expense_date.replace('Z', '+00:00')) if 'T' in data.expense_date else datetime.strptime(data.expense_date, '%Y-%m-%d')
            )
            logger.info(f"Cash movement created for expense {expense_id}: -{data.amount} TL")
    except Exception as e:
        logger.error(f"Failed to create cash movement for expense {expense_id}: {e}")
        # Don't fail the expense creation, just log the error
    
    logger.info(f"Expense created: {expense_id} - {data.description} - {data.amount} TL")
    
    # ==================== UNIFIED LEDGER KAYDI (EXPENSE) ====================
    try:
        # Kasa bilgisi
        register = await db.cash_registers.find_one({"id": data.cash_register_id})
        register_name = register.get("name") if register else None
        
        # Transaction date parse
        expense_date_obj = None
        if data.expense_date:
            if 'T' in data.expense_date:
                expense_date_obj = datetime.fromisoformat(data.expense_date.replace('Z', '+00:00'))
            else:
                expense_date_obj = datetime.strptime(data.expense_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        
        await create_ledger_entry(
            entry_type="EXPENSE",
            transaction_date=expense_date_obj,
            
            # Gider = para çıkışı (HAS yok)
            has_in=0.0,
            has_out=0.0,
            
            # Para çıkışı
            currency=payment_currency,
            amount_in=0.0,
            amount_out=data.amount if payment_currency == "TRY" else (foreign_amount or 0),
            exchange_rate=data.exchange_rate,
            
            # Kategori
            category_id=data.category_id,
            category_name=category.get("name"),
            
            # Kasa
            cash_register_id=data.cash_register_id,
            cash_register_name=register_name,
            
            # Referans
            reference_type="expenses",
            reference_id=expense_id,
            
            description=data.description,
            notes=data.notes,
            created_by=user_id
        )
        logger.info(f"✅ Unified ledger entry created for EXPENSE: {expense_id}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for EXPENSE {expense_id}: {e}")
    
    return {k: v for k, v in expense_doc.items() if k != "_id"}

async def update_expense(expense_id: str, data: ExpenseUpdate):
    """Update expense (no cash movement adjustment)"""
    
    # Güncelleme öncesi eski değerleri al
    expense = await db.expenses.find_one({"id": expense_id})
    if not expense:
        raise ValueError("Expense not found")
    
    old_amount = expense.get("amount", 0)
    old_currency = expense.get("payment_currency", "TRY")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise ValueError("No fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.expenses.update_one(
        {"id": expense_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise ValueError("Expense not found or no changes made")
    
    # ==================== UNIFIED LEDGER ADJUSTMENT ====================
    try:
        updated = await db.expenses.find_one({"id": expense_id})
        new_amount = updated.get("amount", 0)
        amount_diff = new_amount - old_amount
        
        if abs(amount_diff) > 0.01:  # Sadece anlamlı fark varsa kayıt oluştur
            await create_adjustment_entry(
                original_reference_type="expenses",
                original_reference_id=expense_id,
                adjustment_reason=f"Gider düzeltme: {old_amount:.2f} → {new_amount:.2f} {old_currency}",
                # amount_out_diff: pozitif = daha fazla gider
                amount_in_diff=abs(amount_diff) if amount_diff < 0 else 0,
                amount_out_diff=amount_diff if amount_diff > 0 else 0,
                currency=old_currency,
                created_by=None
            )
            logger.info(f"Expense ADJUSTMENT created: {expense_id}, diff: {amount_diff:.2f}")
    except Exception as e:
        logger.error(f"Expense ADJUSTMENT failed: {e}")
    
    return await get_expense(expense_id)

async def delete_expense(expense_id: str):
    """Delete expense (not recommended - cash movement remains)"""
    expense = await db.expenses.find_one({"id": expense_id})
    if not expense:
        raise ValueError("Expense not found")
    
    # ==================== VOID KAYDI OLUŞTUR (SİLMEDEN ÖNCE) ====================
    try:
        # Kategori bilgisi
        category = await db.expense_categories.find_one({"id": expense.get("category_id")})
        
        amount = expense.get("amount", 0) or 0
        currency = expense.get("payment_currency", "TRY") or "TRY"
        
        await create_void_entry(
            original_reference_type="expenses",
            original_reference_id=expense_id,
            void_reason=f"Gider silindi: {expense.get('description', '')}",
            created_by=None,
            # Fallback değerleri - giderin tersi (para çıkışı iptali = para girişi)
            fallback_amount_in=amount,  # İptal: para geri
            fallback_amount_out=0,
            fallback_currency=currency,
            fallback_category_id=expense.get("category_id")
        )
        logger.info(f"Expense VOID created for {expense_id}")
    except Exception as e:
        logger.error(f"Expense VOID failed: {e}")
    
    # Just delete the expense record
    # Cash movement will remain as historical record
    await db.expenses.delete_one({"id": expense_id})
    
    return {"message": "Expense deleted", "id": expense_id}

async def get_expenses_summary(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get expense summary by category"""
    match_query = {}
    
    if start_date:
        match_query["expense_date"] = {"$gte": start_date}
    
    if end_date:
        if "expense_date" in match_query:
            match_query["expense_date"]["$lte"] = end_date
        else:
            match_query["expense_date"] = {"$lte": end_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$group": {
                "_id": "$category_id",
                "total_amount": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"total_amount": -1}}
    ]
    
    summary = []
    async for item in db.expenses.aggregate(pipeline):
        category = await db.expense_categories.find_one({"id": item["_id"]}, {"_id": 0, "name": 1, "code": 1})
        summary.append({
            "category_id": item["_id"],
            "category_name": category.get("name") if category else "Bilinmiyor",
            "category_code": category.get("code") if category else "",
            "total_amount": item["total_amount"],
            "count": item["count"]
        })
    
    # Calculate grand total
    grand_total = sum(item["total_amount"] for item in summary)
    
    return {
        "by_category": summary,
        "grand_total": grand_total,
        "start_date": start_date,
        "end_date": end_date
    }
