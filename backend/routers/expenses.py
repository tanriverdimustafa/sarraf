"""Expense management routes"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from database import get_db
from auth import get_current_user
from models.user import User
from expense_management import (
    get_expense_categories, get_expense_category,
    create_expense_category, update_expense_category, delete_expense_category,
    get_expenses, get_expense, create_expense, update_expense, delete_expense,
    get_expenses_summary, ExpenseCategoryCreate, ExpenseCategoryUpdate, 
    ExpenseCreate, ExpenseUpdate
)
from cash_management import create_cash_movement_internal

router = APIRouter(tags=["Expenses"])
logger = logging.getLogger(__name__)


# ==================== EXPENSE CATEGORIES ====================

@router.get("/expense-categories")
async def api_get_expense_categories(
    is_active: Optional[bool] = None, 
    user=Depends(get_current_user)
):
    """Get all expense categories"""
    return await get_expense_categories(is_active)


@router.get("/expense-categories/{category_id}")
async def api_get_expense_category(
    category_id: str, 
    user=Depends(get_current_user)
):
    """Get single expense category"""
    category = await get_expense_category(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/expense-categories")
async def api_create_expense_category(
    data: ExpenseCategoryCreate, 
    user=Depends(get_current_user)
):
    """Create new expense category"""
    try:
        return await create_expense_category(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/expense-categories/{category_id}")
async def api_update_expense_category(
    category_id: str, 
    data: ExpenseCategoryUpdate, 
    user=Depends(get_current_user)
):
    """Update expense category"""
    try:
        return await update_expense_category(category_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/expense-categories/{category_id}")
async def api_delete_expense_category(
    category_id: str, 
    user=Depends(get_current_user)
):
    """Delete expense category"""
    try:
        return await delete_expense_category(category_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== EXPENSES ====================

@router.get("/expenses")
async def api_get_expenses(
    category_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    per_page: Optional[int] = None,
    user=Depends(get_current_user)
):
    """Get expenses with filters"""
    # per_page parametresi varsa onu kullan, yoksa page_size kullan
    actual_page_size = per_page if per_page is not None else page_size
    return await get_expenses(category_id, start_date, end_date, page, actual_page_size)


@router.get("/expenses/summary")
async def api_get_expenses_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Get expense summary by category"""
    return await get_expenses_summary(start_date, end_date)


@router.get("/expenses/{expense_id}")
async def api_get_expense(
    expense_id: str, 
    user=Depends(get_current_user)
):
    """Get single expense"""
    expense = await get_expense(expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.post("/expenses")
async def api_create_expense(
    data: ExpenseCreate, 
    user=Depends(get_current_user)
):
    """Create new expense with cash movement"""
    try:
        user_id = user.id if hasattr(user, 'id') else user.get("id", "unknown")
        return await create_expense(data, user_id, create_cash_movement_internal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/expenses/{expense_id}")
async def api_update_expense(
    expense_id: str, 
    data: ExpenseUpdate, 
    user=Depends(get_current_user)
):
    """Update expense"""
    try:
        return await update_expense(expense_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/expenses/{expense_id}")
async def api_delete_expense(
    expense_id: str, 
    user=Depends(get_current_user)
):
    """Delete expense"""
    try:
        return await delete_expense(expense_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
