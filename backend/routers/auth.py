"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
import uuid
import logging

from database import get_db
from models.user import UserRegister, UserLogin, User
from auth import hash_password, verify_password, create_access_token, get_current_user
from utils.activity_logger import log_activity, Actions, EntityTypes

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


@router.post("/register")
async def register(user_data: UserRegister):
    """Register a new user"""
    db = get_db()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token({"user_id": user_dict["id"]})
    
    # Return user without password
    user_dict.pop("password")
    user_dict.pop("_id", None)
    
    return {
        "user": user_dict,
        "token": token
    }


@router.post("/login")
async def login(credentials: UserLogin, request: Request):
    """Login and get access token"""
    db = get_db()
    
    logger.info(f"Login attempt for username: {credentials.username}")
    
    # Username ile ara
    user = await db.users.find_one({"$or": [{"username": credentials.username}, {"email": credentials.username}]})
    
    if not user:
        logger.warning(f"User not found: {credentials.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    logger.info(f"User found: {user.get('username')}, checking password...")
    
    # Support both 'password' and 'hashed_password' field names
    stored_password = user.get("password") or user.get("hashed_password")
    if not stored_password:
        logger.warning(f"No password hash found for user: {credentials.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    password_valid = verify_password(credentials.password, stored_password)
    logger.info(f"Password valid: {password_valid}")
    
    if not password_valid:
        logger.warning(f"Invalid password for user: {credentials.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Check if user is active (support both status and is_active fields)
    is_active = user.get("is_active", True) and user.get("status", "ACTIVE") == "ACTIVE"
    if not is_active:
        logger.warning(f"Inactive user: {credentials.username}")
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    # Create token
    token = create_access_token({"user_id": user["id"]})
    logger.info(f"Login successful for user: {credentials.username}")
    
    # Log activity
    await log_activity(
        db=db,
        user_id=user["id"],
        username=user.get("username", user.get("email")),
        action=Actions.LOGIN,
        entity_type=EntityTypes.USER,
        entity_id=user["id"],
        entity_name=user.get("username"),
        request=request
    )
    
    # Return user without password (support both field names)
    user.pop("password", None)
    user.pop("hashed_password", None)
    user.pop("_id", None)
    
    return {
        "user": user,
        "token": token
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user
