"""User management routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid
import bcrypt
import logging

from database import get_db
from models.user import User, UserCreate, UserUpdate, UserResponse
from auth import get_current_user, hash_password

router = APIRouter(prefix="/users", tags=["Users"])
logger = logging.getLogger(__name__)


@router.get("", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(get_current_user)):
    """Get all users (ADMIN only)"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    
    # Convert to response format
    result = []
    for user in users:
        user.pop("_id", None)
        result.append(UserResponse(**user))
    
    return result


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    """Create new user (ADMIN only)"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username already exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "name": user_data.name,
        "role": user_data.role,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.id
    }
    
    await db.users.insert_one(user_doc)
    
    user_doc.pop("_id", None)
    user_doc.pop("password")
    
    return UserResponse(**user_doc)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update user (ADMIN only)"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update document
    update_doc = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if user_data.username:
        # Check if username already taken by another user
        existing = await db.users.find_one({"username": user_data.username, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        update_doc["username"] = user_data.username
    
    if user_data.email:
        # Check if email already taken by another user
        existing = await db.users.find_one({"email": user_data.email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        update_doc["email"] = user_data.email
    
    if user_data.password:
        # Hash new password
        hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
        update_doc["password"] = hashed_password
    
    if user_data.name:
        update_doc["name"] = user_data.name
    
    if user_data.role:
        update_doc["role"] = user_data.role
    
    if user_data.is_active is not None:
        update_doc["is_active"] = user_data.is_active
    
    # Update user
    await db.users.update_one({"id": user_id}, {"$set": update_doc})
    
    # Get updated user
    updated_user = await db.users.find_one({"id": user_id}, {"password": 0, "_id": 0})
    
    return UserResponse(**updated_user)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete user (ADMIN only)"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Soft delete
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_active": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "User deleted successfully"}
