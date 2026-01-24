"""Activity Log Models"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ActivityLog(BaseModel):
    """Activity Log entry model"""
    id: str
    user_id: str
    username: str
    action: str  # LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VIEW
    entity_type: str  # PARTY, PRODUCT, TRANSACTION, USER, SETTINGS, etc.
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime


class ActivityLogResponse(BaseModel):
    """Activity Log response model"""
    id: str
    user_id: str
    username: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: str
