"""Lookup Pydantic models"""
from pydantic import BaseModel, ConfigDict
from typing import Optional


class PartyType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    code: str
    name: str


class AssetType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    code: str
    name: str
    unit: str


class TransactionDirection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    code: str
    name: str


class ProductType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    code: str
    name: str
    is_gold_based: bool
    track_type: Optional[str] = None  # FIFO, POOL, UNIQUE
    fixed_weight: Optional[float] = None  # Sarrafiye için sabit ağırlık
    unit: Optional[str] = None  # PIECE, GRAM
    group: Optional[str] = None  # SARRAFIYE, GRAM_GOLD, HURDA, TAKI
    default_labor_rate: Optional[float] = None  # Default işçilik (HAS/gr)
    fineness: Optional[float] = None  # Milyem değeri (hurda için)
    has_labor: Optional[bool] = True  # İşçilik var mı? (hurda için false)


class Karat(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    karat: int
    fineness: float


class LaborType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    code: str
    name: str


class StockStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    code: str
    name: str
