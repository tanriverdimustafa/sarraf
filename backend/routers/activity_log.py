"""Activity Log Router"""
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime
from database import get_db
from models.user import User
from auth import get_current_user

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])


@router.get("")
async def get_activity_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get activity logs with filtering and pagination (ADMIN only)"""
    db = get_db()
    
    # Only admin can view activity logs
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Build filter
    filter_query = {}
    
    if user_id:
        filter_query["user_id"] = user_id
    
    if action:
        filter_query["action"] = action
    
    if entity_type:
        filter_query["entity_type"] = entity_type
    
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        if end_date:
            # Add one day to include the entire end date
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            date_filter["$lte"] = end_dt.replace(hour=23, minute=59, second=59)
        filter_query["created_at"] = date_filter
    
    # Count total
    total = await db.activity_logs.count_documents(filter_query)
    
    # Calculate pagination
    total_pages = (total + page_size - 1) // page_size
    skip = (page - 1) * page_size
    
    # Get logs
    cursor = db.activity_logs.find(filter_query).sort("created_at", -1).skip(skip).limit(page_size)
    
    logs = []
    async for log in cursor:
        log.pop("_id", None)
        # Convert datetime to string
        if isinstance(log.get("created_at"), datetime):
            log["created_at"] = log["created_at"].isoformat()
        logs.append(log)
    
    return {
        "logs": logs,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages
        }
    }


@router.get("/users")
async def get_users_for_filter(current_user: User = Depends(get_current_user)):
    """Get unique users from activity logs for filter dropdown"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get distinct users
    pipeline = [
        {"$group": {"_id": {"user_id": "$user_id", "username": "$username"}}},
        {"$project": {"user_id": "$_id.user_id", "username": "$_id.username", "_id": 0}},
        {"$sort": {"username": 1}}
    ]
    
    cursor = db.activity_logs.aggregate(pipeline)
    users = [doc async for doc in cursor]
    
    return users


@router.get("/actions")
async def get_actions_for_filter(current_user: User = Depends(get_current_user)):
    """Get unique actions from activity logs for filter dropdown"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get distinct actions
    actions = await db.activity_logs.distinct("action")
    
    return sorted(actions)


@router.get("/entity-types")
async def get_entity_types_for_filter(current_user: User = Depends(get_current_user)):
    """Get unique entity types from activity logs for filter dropdown"""
    db = get_db()
    
    if current_user.role not in ["ADMIN", "SUPER_ADMIN"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get distinct entity types
    entity_types = await db.activity_logs.distinct("entity_type")
    
    return sorted(entity_types)
