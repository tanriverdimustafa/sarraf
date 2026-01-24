"""Market data routes - Price snapshots and related endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import logging

from database import get_db
from auth import get_current_user
from models.user import User

router = APIRouter(tags=["Market"])
logger = logging.getLogger(__name__)


@router.get("/price-snapshots/latest")
async def get_latest_price_snapshot(current_user: User = Depends(get_current_user)):
    """Get latest price snapshot"""
    db = get_db()
    
    snapshot = await db.price_snapshots.find_one(
        {},
        {"_id": 0},
        sort=[("as_of", -1)]
    )
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="No price snapshot found")
    
    # Convert datetime
    if isinstance(snapshot.get("as_of"), datetime):
        snapshot["as_of"] = snapshot["as_of"].isoformat()
    if isinstance(snapshot.get("created_at"), datetime):
        snapshot["created_at"] = snapshot["created_at"].isoformat()
    
    return snapshot


@router.get("/market-data/latest")
async def get_latest_market_data(current_user: User = Depends(get_current_user)):
    """Get latest market data from cache"""
    db = get_db()
    
    market = await db.market_data.find_one(
        {},
        {"_id": 0},
        sort=[("timestamp", -1)]
    )
    
    if not market:
        raise HTTPException(status_code=404, detail="No market data found")
    
    return market
