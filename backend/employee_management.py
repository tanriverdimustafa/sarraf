# ==================== EMPLOYEE MANAGEMENT MODULE ====================
# Personel Yönetimi - Maaş ve Borç Takibi

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from math import ceil
import uuid
import logging

# Import unified ledger for dual-write
from init_unified_ledger import create_ledger_entry, create_void_entry

logger = logging.getLogger(__name__)

# Router
employee_router = APIRouter(prefix="/api", tags=["Employee Management"])

# Database reference (set by main app)
db = None

# Cash movement function reference (set by main app)
create_cash_movement_func = None

def set_database(database):
    global db
    db = database

def set_cash_movement_func(func):
    global create_cash_movement_func
    create_cash_movement_func = func

# ==================== MODELS ====================

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    salary: float = Field(default=0, ge=0)
    start_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    salary: Optional[float] = None
    start_date: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class SalaryAccrualCreate(BaseModel):
    employee_id: str
    period: str  # YYYY-MM format
    amount: float = Field(..., gt=0)
    description: Optional[str] = None
    movement_date: str  # YYYY-MM-DD

class SalaryPaymentCreate(BaseModel):
    employee_id: str
    period: Optional[str] = None  # YYYY-MM format
    amount: float = Field(..., gt=0)
    currency: str = Field(default="TRY", pattern="^(TRY|USD|EUR)$")
    cash_register_id: str
    exchange_rate: Optional[float] = None
    description: Optional[str] = None
    movement_date: str  # YYYY-MM-DD

class EmployeeDebtCreate(BaseModel):
    employee_id: str
    type: str = Field(..., pattern="^(DEBT|PAYMENT)$")  # DEBT = borç ver, PAYMENT = tahsilat
    amount: float = Field(..., gt=0)
    currency: str = Field(default="TRY", pattern="^(TRY|USD|EUR)$")
    cash_register_id: str
    exchange_rate: Optional[float] = None
    description: Optional[str] = None
    movement_date: str  # YYYY-MM-DD

# ==================== HELPER FUNCTIONS ====================

def generate_employee_id():
    return f"EMP-{str(uuid.uuid4())[:8].upper()}"

def generate_salary_movement_id():
    return f"SAL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

def generate_debt_movement_id():
    return f"DEBT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

async def calculate_employee_balances(employee_id: str):
    """Calculate salary and debt balances for an employee"""
    
    # MAAŞ BAKİYESİ
    # Tahakkuklar (borcumuz)
    accrual_pipeline = [
        {"$match": {"employee_id": employee_id, "type": "ACCRUAL"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    accruals = await db.salary_movements.aggregate(accrual_pipeline).to_list(1)
    accrual_total = accruals[0]["total"] if accruals else 0
    
    # Ödemeler
    payment_pipeline = [
        {"$match": {"employee_id": employee_id, "type": "PAYMENT"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    payments = await db.salary_movements.aggregate(payment_pipeline).to_list(1)
    payment_total = payments[0]["total"] if payments else 0
    
    # Negatif = biz borçluyuz
    salary_balance = payment_total - accrual_total
    
    # BORÇ BAKİYESİ
    # Verilen borçlar
    debt_pipeline = [
        {"$match": {"employee_id": employee_id, "type": "DEBT"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    debts = await db.employee_debts.aggregate(debt_pipeline).to_list(1)
    debt_total = debts[0]["total"] if debts else 0
    
    # Tahsilatlar
    debt_payment_pipeline = [
        {"$match": {"employee_id": employee_id, "type": "PAYMENT"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    debt_payments = await db.employee_debts.aggregate(debt_payment_pipeline).to_list(1)
    debt_payment_total = debt_payments[0]["total"] if debt_payments else 0
    
    # Pozitif = çalışan bize borçlu
    debt_balance = debt_total - debt_payment_total
    
    return {
        "salary_balance": salary_balance,
        "debt_balance": debt_balance
    }

# ==================== EMPLOYEES API ====================

@employee_router.get("/employees")
async def get_employees(
    page: int = 1,
    per_page: int = 20,
    is_active: Optional[bool] = None
):
    """Get all employees with pagination and balances"""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    # Count total
    total = await db.employees.count_documents(query)
    
    # Get employees sorted by created_at DESC
    employees = await db.employees.find(query, {"_id": 0}).sort([
        ("created_at", -1),
        ("id", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    # Add balances to each employee
    for emp in employees:
        balances = await calculate_employee_balances(emp["id"])
        emp["salary_balance"] = balances["salary_balance"]
        emp["debt_balance"] = balances["debt_balance"]
    
    return {
        "employees": employees,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": ceil(total / per_page) if total > 0 else 1
        }
    }

@employee_router.get("/employees/all")
async def get_all_employees():
    """Get all active employees for dropdown"""
    employees = await db.employees.find({"is_active": True}, {"_id": 0}).sort("name", 1).to_list(1000)
    
    # Add balances
    for emp in employees:
        balances = await calculate_employee_balances(emp["id"])
        emp["salary_balance"] = balances["salary_balance"]
        emp["debt_balance"] = balances["debt_balance"]
    
    return employees

@employee_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str):
    """Get single employee with balances"""
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Add balances
    balances = await calculate_employee_balances(employee_id)
    employee["salary_balance"] = balances["salary_balance"]
    employee["debt_balance"] = balances["debt_balance"]
    
    return employee

@employee_router.post("/employees")
async def create_employee(data: EmployeeCreate):
    """Create new employee"""
    employee = {
        "id": generate_employee_id(),
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "position": data.position,
        "salary": data.salary,
        "start_date": data.start_date,
        "notes": data.notes,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employees.insert_one(employee)
    logger.info(f"Created employee: {employee['id']} - {employee['name']}")
    
    employee.pop("_id", None)
    employee["salary_balance"] = 0
    employee["debt_balance"] = 0
    return employee

@employee_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate):
    """Update employee"""
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.email is not None:
        update_data["email"] = data.email
    if data.position is not None:
        update_data["position"] = data.position
    if data.salary is not None:
        update_data["salary"] = data.salary
    if data.start_date is not None:
        update_data["start_date"] = data.start_date
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.employees.update_one({"id": employee_id}, {"$set": update_data})
    
    updated = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    balances = await calculate_employee_balances(employee_id)
    updated["salary_balance"] = balances["salary_balance"]
    updated["debt_balance"] = balances["debt_balance"]
    return updated

@employee_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    """Delete employee (soft delete if has movements)"""
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if employee has movements
    salary_count = await db.salary_movements.count_documents({"employee_id": employee_id})
    debt_count = await db.employee_debts.count_documents({"employee_id": employee_id})
    
    if salary_count > 0 or debt_count > 0:
        # Soft delete
        await db.employees.update_one(
            {"id": employee_id}, 
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Employee deactivated (has movements)"}
    else:
        # Hard delete
        await db.employees.delete_one({"id": employee_id})
        return {"message": "Employee deleted"}

# ==================== SALARY MOVEMENTS API ====================

@employee_router.get("/salary-movements")
async def get_salary_movements(
    page: int = 1,
    per_page: int = 20,
    employee_id: Optional[str] = None,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None
):
    """Get salary movements with pagination and filters"""
    query = {}
    
    if employee_id:
        query["employee_id"] = employee_id
    if period:
        query["period"] = period
    if type:
        query["type"] = type
    if start_date:
        query["movement_date"] = {"$gte": start_date}
    if end_date:
        if "movement_date" in query:
            query["movement_date"]["$lte"] = end_date
        else:
            query["movement_date"] = {"$lte": end_date}
    
    # Count total
    total = await db.salary_movements.count_documents(query)
    
    # Get movements sorted by movement_date DESC
    movements = await db.salary_movements.find(query, {"_id": 0}).sort([
        ("movement_date", -1),
        ("created_at", -1),
        ("id", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "movements": movements,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": ceil(total / per_page) if total > 0 else 1
        }
    }

@employee_router.post("/salary-movements/accrual")
async def create_salary_accrual(data: SalaryAccrualCreate):
    """Create salary accrual (tahakkuk) - no cash movement"""
    
    # Validate employee
    employee = await db.employees.find_one({"id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Validate period (check if closed)
    period = await db.accrual_periods.find_one({"code": data.period})
    if period and period.get("is_closed"):
        raise HTTPException(status_code=400, detail="Bu dönem kapatılmış, işlem yapılamaz")
    
    movement = {
        "id": generate_salary_movement_id(),
        "employee_id": data.employee_id,
        "employee_name": employee["name"],
        "type": "ACCRUAL",
        "amount": data.amount,
        "currency": "TRY",
        "period": data.period,
        "description": data.description or f"{data.period} maaş tahakkuku",
        "movement_date": data.movement_date,
        "cash_register_id": None,
        "cash_register_name": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.salary_movements.insert_one(movement)
    logger.info(f"Created salary accrual: {movement['id']} - {data.amount} TRY for {employee['name']}")
    
    # ==================== UNIFIED LEDGER KAYDI (SALARY_ACCRUAL) ====================
    try:
        await create_ledger_entry(
            entry_type="SALARY_ACCRUAL",
            transaction_date=datetime.strptime(data.movement_date, '%Y-%m-%d').replace(tzinfo=timezone.utc),
            
            has_in=0.0,
            has_out=0.0,
            
            currency="TRY",
            amount_in=0.0,
            amount_out=data.amount,  # Tahakkuk = borçlanma
            
            party_id=data.employee_id,
            party_name=employee.get("name"),
            party_type="EMPLOYEE",
            
            reference_type="salary_movements",
            reference_id=movement["id"],
            
            description=f"Maaş tahakkuku: {data.period}",
            created_by=None
        )
        logger.info(f"✅ Unified ledger entry created for SALARY_ACCRUAL: {movement['id']}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for SALARY_ACCRUAL: {e}")
    
    movement.pop("_id", None)
    return movement

@employee_router.post("/salary-movements/payment")
async def create_salary_payment(data: SalaryPaymentCreate):
    """Create salary payment - with cash movement (OUT)"""
    global create_cash_movement_func
    
    # Validate employee
    employee = await db.employees.find_one({"id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Validate cash register
    cash_register = await db.cash_registers.find_one({"id": data.cash_register_id})
    if not cash_register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    
    # Calculate TL equivalent for foreign currency
    tl_equivalent = None
    if data.currency in ["USD", "EUR"] and data.exchange_rate:
        tl_equivalent = round(data.amount * data.exchange_rate, 2)
    
    movement = {
        "id": generate_salary_movement_id(),
        "employee_id": data.employee_id,
        "employee_name": employee["name"],
        "type": "PAYMENT",
        "amount": data.amount,
        "currency": data.currency,
        "period": data.period,
        "cash_register_id": data.cash_register_id,
        "cash_register_name": cash_register["name"],
        "exchange_rate": data.exchange_rate,
        "tl_equivalent": tl_equivalent,
        "description": data.description or f"Maaş ödemesi - {employee['name']}",
        "movement_date": data.movement_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.salary_movements.insert_one(movement)
    logger.info(f"Created salary payment: {movement['id']} - {data.amount} {data.currency} for {employee['name']}")
    
    # Create cash movement (OUT)
    if create_cash_movement_func:
        try:
            await create_cash_movement_func(
                cash_register_id=data.cash_register_id,
                movement_type="OUT",
                amount=data.amount,
                currency=data.currency,
                reference_type="SALARY",
                reference_id=movement["id"],
                description=f"Maaş ödemesi - {employee['name']}"
            )
            logger.info(f"Cash movement created for salary payment: {movement['id']}")
        except Exception as e:
            await db.salary_movements.delete_one({"id": movement["id"]})
            logger.error(f"Failed to create cash movement: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create cash movement: {str(e)}")
    
    # ==================== UNIFIED LEDGER KAYDI (SALARY_PAYMENT) ====================
    try:
        await create_ledger_entry(
            entry_type="SALARY_PAYMENT",
            transaction_date=datetime.strptime(data.movement_date, '%Y-%m-%d').replace(tzinfo=timezone.utc),
            
            has_in=0.0,
            has_out=0.0,
            
            currency=data.currency,
            amount_in=0.0,
            amount_out=data.amount,
            exchange_rate=data.exchange_rate,
            
            party_id=data.employee_id,
            party_name=employee.get("name"),
            party_type="EMPLOYEE",
            
            cash_register_id=data.cash_register_id,
            cash_register_name=cash_register.get("name"),
            
            reference_type="salary_movements",
            reference_id=movement["id"],
            
            description=f"Maaş ödemesi: {employee.get('name')}",
            created_by=None
        )
        logger.info(f"✅ Unified ledger entry created for SALARY_PAYMENT: {movement['id']}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for SALARY_PAYMENT: {e}")
    
    movement.pop("_id", None)
    return movement

# ==================== EMPLOYEE DEBTS API ====================

@employee_router.get("/employee-debts")
async def get_employee_debts(
    page: int = 1,
    per_page: int = 20,
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None
):
    """Get employee debt movements with pagination and filters"""
    query = {}
    
    if employee_id:
        query["employee_id"] = employee_id
    if type:
        query["type"] = type
    if start_date:
        query["movement_date"] = {"$gte": start_date}
    if end_date:
        if "movement_date" in query:
            query["movement_date"]["$lte"] = end_date
        else:
            query["movement_date"] = {"$lte": end_date}
    
    # Count total
    total = await db.employee_debts.count_documents(query)
    
    # Get movements sorted by movement_date DESC
    movements = await db.employee_debts.find(query, {"_id": 0}).sort([
        ("movement_date", -1),
        ("created_at", -1),
        ("id", -1)
    ]).skip((page - 1) * per_page).limit(per_page).to_list(per_page)
    
    return {
        "movements": movements,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": ceil(total / per_page) if total > 0 else 1
        }
    }

@employee_router.post("/employee-debts/debt")
async def create_employee_debt(data: EmployeeDebtCreate):
    """Create employee debt (borç verme) - cash OUT"""
    global create_cash_movement_func
    
    if data.type != "DEBT":
        raise HTTPException(status_code=400, detail="Invalid type for debt creation")
    
    # Validate employee
    employee = await db.employees.find_one({"id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Validate cash register
    cash_register = await db.cash_registers.find_one({"id": data.cash_register_id})
    if not cash_register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    
    # Calculate TL equivalent for foreign currency
    tl_equivalent = None
    if data.currency in ["USD", "EUR"] and data.exchange_rate:
        tl_equivalent = round(data.amount * data.exchange_rate, 2)
    
    movement = {
        "id": generate_debt_movement_id(),
        "employee_id": data.employee_id,
        "employee_name": employee["name"],
        "type": "DEBT",
        "amount": data.amount,
        "currency": data.currency,
        "cash_register_id": data.cash_register_id,
        "cash_register_name": cash_register["name"],
        "exchange_rate": data.exchange_rate,
        "tl_equivalent": tl_equivalent,
        "description": data.description or "Avans",
        "movement_date": data.movement_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employee_debts.insert_one(movement)
    logger.info(f"Created employee debt: {movement['id']} - {data.amount} {data.currency} for {employee['name']}")
    
    # Create cash movement (OUT - borç veriyoruz)
    if create_cash_movement_func:
        try:
            await create_cash_movement_func(
                cash_register_id=data.cash_register_id,
                movement_type="OUT",
                amount=data.amount,
                currency=data.currency,
                reference_type="EMPLOYEE_DEBT",
                reference_id=movement["id"],
                description=f"Personel avans - {employee['name']} - {data.description or 'Avans'}"
            )
            logger.info(f"Cash movement created for employee debt: {movement['id']}")
        except Exception as e:
            await db.employee_debts.delete_one({"id": movement["id"]})
            logger.error(f"Failed to create cash movement: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create cash movement: {str(e)}")
    
    # ==================== UNIFIED LEDGER KAYDI (EMPLOYEE_DEBT) ====================
    try:
        await create_ledger_entry(
            entry_type="EMPLOYEE_DEBT",
            transaction_date=datetime.strptime(data.movement_date, '%Y-%m-%d').replace(tzinfo=timezone.utc),
            
            has_in=0.0,
            has_out=0.0,
            
            currency=data.currency,
            amount_in=0.0,
            amount_out=data.amount,  # Kasadan çıkış
            exchange_rate=data.exchange_rate,
            
            party_id=data.employee_id,
            party_name=employee.get("name"),
            party_type="EMPLOYEE",
            
            cash_register_id=data.cash_register_id,
            cash_register_name=cash_register.get("name"),
            
            reference_type="employee_debts",
            reference_id=movement["id"],
            
            description=f"Personel avansı: {employee.get('name')}",
            created_by=None
        )
        logger.info(f"✅ Unified ledger entry created for EMPLOYEE_DEBT: {movement['id']}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for EMPLOYEE_DEBT: {e}")
    
    movement.pop("_id", None)
    return movement

@employee_router.post("/employee-debts/payment")
async def create_debt_payment(data: EmployeeDebtCreate):
    """Create debt payment (borç tahsilatı) - cash IN"""
    global create_cash_movement_func
    
    if data.type != "PAYMENT":
        raise HTTPException(status_code=400, detail="Invalid type for debt payment")
    
    # Validate employee
    employee = await db.employees.find_one({"id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Validate cash register
    cash_register = await db.cash_registers.find_one({"id": data.cash_register_id})
    if not cash_register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    
    # Calculate TL equivalent for foreign currency
    tl_equivalent = None
    if data.currency in ["USD", "EUR"] and data.exchange_rate:
        tl_equivalent = round(data.amount * data.exchange_rate, 2)
    
    movement = {
        "id": generate_debt_movement_id(),
        "employee_id": data.employee_id,
        "employee_name": employee["name"],
        "type": "PAYMENT",
        "amount": data.amount,
        "currency": data.currency,
        "cash_register_id": data.cash_register_id,
        "cash_register_name": cash_register["name"],
        "exchange_rate": data.exchange_rate,
        "tl_equivalent": tl_equivalent,
        "description": data.description or "Borç ödemesi",
        "movement_date": data.movement_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employee_debts.insert_one(movement)
    logger.info(f"Created debt payment: {movement['id']} - {data.amount} {data.currency} from {employee['name']}")
    
    # Create cash movement (IN - tahsilat)
    if create_cash_movement_func:
        try:
            await create_cash_movement_func(
                cash_register_id=data.cash_register_id,
                movement_type="IN",
                amount=data.amount,
                currency=data.currency,
                reference_type="EMPLOYEE_DEBT",
                reference_id=movement["id"],
                description=f"Personel borç tahsilatı - {employee['name']}"
            )
            logger.info(f"Cash movement created for debt payment: {movement['id']}")
        except Exception as e:
            await db.employee_debts.delete_one({"id": movement["id"]})
            logger.error(f"Failed to create cash movement: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to create cash movement: {str(e)}")
    
    # ==================== UNIFIED LEDGER KAYDI (EMPLOYEE_DEBT_PAYMENT) ====================
    try:
        await create_ledger_entry(
            entry_type="EMPLOYEE_DEBT_PAYMENT",
            transaction_date=datetime.strptime(data.movement_date, '%Y-%m-%d').replace(tzinfo=timezone.utc),
            
            has_in=0.0,
            has_out=0.0,
            
            currency=data.currency,
            amount_in=data.amount,  # Kasaya giriş
            amount_out=0.0,
            exchange_rate=data.exchange_rate,
            
            party_id=data.employee_id,
            party_name=employee.get("name"),
            party_type="EMPLOYEE",
            
            cash_register_id=data.cash_register_id,
            cash_register_name=cash_register.get("name"),
            
            reference_type="employee_debts",
            reference_id=movement["id"],
            
            description=f"Personel borç tahsilatı: {employee.get('name')}",
            created_by=None
        )
        logger.info(f"✅ Unified ledger entry created for EMPLOYEE_DEBT_PAYMENT: {movement['id']}")
    except Exception as e:
        logger.error(f"Failed to create ledger entry for EMPLOYEE_DEBT_PAYMENT: {e}")
    
    movement.pop("_id", None)
    return movement


# ==================== MAAS HAREKETİ SİLME ====================

@employee_router.delete("/salary-movements/{movement_id}")
async def delete_salary_movement(movement_id: str):
    """Maaş hareketi sil"""
    
    # Hareketi bul
    movement = await db.salary_movements.find_one({"id": movement_id})
    if not movement:
        raise HTTPException(status_code=404, detail="Maaş hareketi bulunamadı")
    
    # Personel bilgisini al
    employee = await db.employees.find_one({"id": movement.get("employee_id")})
    employee_name = employee.get("name") if employee else "Bilinmiyor"
    
    # ==================== UNIFIED LEDGER VOID ====================
    try:
        movement_type = movement.get("type", "ACCRUAL")
        amount = movement.get("amount", 0)
        currency = movement.get("currency", "TRY")
        
        # Maaş ödemesi ise amount_out var, tahakkuk ise amount_in yok
        await create_void_entry(
            original_reference_type="salary_movements",
            original_reference_id=movement_id,
            void_reason=f"Maaş hareketi silindi: {employee_name} - {movement.get('description', '')}",
            created_by=None,
            # Ödeme ise tersine çevir
            fallback_amount_in=amount if movement_type == "PAYMENT" else 0,
            fallback_amount_out=0 if movement_type == "PAYMENT" else amount,
            fallback_currency=currency,
            fallback_party_id=movement.get("employee_id"),
            fallback_party_name=employee_name,
            fallback_party_type="EMPLOYEE"
        )
        logger.info(f"Salary movement VOID created: {movement_id}")
    except Exception as e:
        logger.error(f"Salary VOID failed: {e}")
    
    # Hareketi sil
    await db.salary_movements.delete_one({"id": movement_id})
    
    return {"success": True, "message": "Maaş hareketi silindi"}

# ==================== PERSONEL BORÇ SİLME ====================

@employee_router.delete("/employee-debts/{debt_id}")
async def delete_employee_debt(debt_id: str):
    """Personel borç hareketi sil"""
    
    # Hareketi bul
    debt = await db.employee_debts.find_one({"id": debt_id})
    if not debt:
        raise HTTPException(status_code=404, detail="Borç hareketi bulunamadı")
    
    # Personel bilgisini al
    employee = await db.employees.find_one({"id": debt.get("employee_id")})
    employee_name = employee.get("name") if employee else "Bilinmiyor"
    
    # ==================== UNIFIED LEDGER VOID ====================
    try:
        debt_type = debt.get("type", "DEBT")
        amount = debt.get("amount", 0)
        currency = debt.get("currency", "TRY")
        
        await create_void_entry(
            original_reference_type="employee_debts",
            original_reference_id=debt_id,
            void_reason=f"Personel borç silindi: {employee_name} - {debt.get('description', '')}",
            created_by=None,
            # DEBT = verilen borç (OUT), PAYMENT = geri alınan borç (IN)
            fallback_amount_in=amount if debt_type == "PAYMENT" else 0,
            fallback_amount_out=amount if debt_type == "DEBT" else 0,
            fallback_currency=currency,
            fallback_party_id=debt.get("employee_id"),
            fallback_party_name=employee_name,
            fallback_party_type="EMPLOYEE"
        )
        logger.info(f"Employee debt VOID created: {debt_id}")
    except Exception as e:
        logger.error(f"Employee debt VOID failed: {e}")
    
    # Hareketi sil
    await db.employee_debts.delete_one({"id": debt_id})
    
    return {"success": True, "message": "Borç hareketi silindi"}

