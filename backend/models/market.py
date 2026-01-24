"""Market data Pydantic models"""
from pydantic import BaseModel
from typing import Optional


class MarketData(BaseModel):
    has_gold_buy: Optional[float] = None
    has_gold_sell: Optional[float] = None
    usd_buy: Optional[float] = None
    usd_sell: Optional[float] = None
    eur_buy: Optional[float] = None
    eur_sell: Optional[float] = None
    timestamp: str
