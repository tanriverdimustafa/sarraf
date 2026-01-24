"""Activity Logger Utility"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import Request


async def log_activity(
    db,
    user_id: str,
    username: str,
    action: str,
    entity_type: str,
    entity_id: str = None,
    entity_name: str = None,
    details: dict = None,
    request: Request = None
):
    """
    Log user activity to database
    
    Args:
        db: Database connection
        user_id: ID of the user performing the action
        username: Username of the user
        action: Action type (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VIEW)
        entity_type: Type of entity (PARTY, PRODUCT, TRANSACTION, USER, etc.)
        entity_id: ID of the entity (optional)
        entity_name: Name/code of the entity (optional)
        details: Additional details (optional)
        request: FastAPI Request object for IP/User-Agent (optional)
    """
    log_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": username,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "details": details,
        "ip_address": None,
        "user_agent": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Extract IP and User-Agent from request if available
    if request:
        # Get real IP (considering proxies)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            log_entry["ip_address"] = forwarded_for.split(",")[0].strip()
        else:
            log_entry["ip_address"] = request.client.host if request.client else None
        
        log_entry["user_agent"] = request.headers.get("user-agent")
    
    try:
        await db.activity_logs.insert_one(log_entry)
    except Exception as e:
        # Log error but don't fail the main operation
        print(f"Error logging activity: {e}")


# Action constants
class Actions:
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    VIEW = "VIEW"
    CANCEL = "CANCEL"


# Entity type constants
class EntityTypes:
    USER = "USER"
    PARTY = "PARTY"
    PRODUCT = "PRODUCT"
    TRANSACTION = "TRANSACTION"
    CASH_REGISTER = "CASH_REGISTER"
    CASH_MOVEMENT = "CASH_MOVEMENT"
    EXPENSE = "EXPENSE"
    EMPLOYEE = "EMPLOYEE"
    PARTNER = "PARTNER"
    SETTINGS = "SETTINGS"
    REPORT = "REPORT"
