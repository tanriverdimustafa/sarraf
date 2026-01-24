"""User related Pydantic models"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional
import uuid


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "STAFF"  # ADMIN or STAFF


class UserLogin(BaseModel):
    username: str  # email yerine username ile login
    password: str


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: Optional[str] = None
    email: str
    name: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "user"
    status: str = "ACTIVE"
    is_active: bool = True
    created_at: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    name: str
    role: str  # ADMIN, STORE_MANAGER, SALES


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    username: Optional[str] = None
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    created_at: str
    updated_at: Optional[str] = None
