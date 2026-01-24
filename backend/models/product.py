"""Product related Pydantic models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import uuid


class ProductCreate(BaseModel):
    product_type_id: int
    name: str
    notes: Optional[str] = None
    # Altın bilgisi (only if is_gold_based)
    karat_id: Optional[int] = None
    weight_gram: Optional[float] = None
    # İşçilik
    labor_type_id: Optional[int] = None
    labor_has_value: Optional[float] = None
    # Altın olmayan ürün maliyeti
    alis_has_degeri: Optional[float] = None
    # Satış
    profit_rate_percent: float
    # Fotoğraflar
    images: Optional[List[str]] = None
    # Tedarikçi bilgisi
    supplier_party_id: Optional[str] = None
    purchase_date: Optional[str] = None  # ISO format datetime
    # Miktar (sarrafiye için)
    quantity: Optional[int] = 1


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    karat_id: Optional[int] = None
    weight_gram: Optional[float] = None
    labor_type_id: Optional[int] = None
    labor_has_value: Optional[float] = None
    alis_has_degeri: Optional[float] = None
    profit_rate_percent: Optional[float] = None
    images: Optional[List[str]] = None
    stock_status_id: Optional[int] = None
    # Tedarikçi bilgisi
    supplier_party_id: Optional[str] = None
    purchase_date: Optional[str] = None


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barcode: str
    product_type_id: int
    name: str
    notes: Optional[str] = None
    # Altın bilgisi
    karat_id: Optional[int] = None
    fineness: Optional[float] = None
    weight_gram: Optional[float] = None
    # İşçilik
    labor_type_id: Optional[int] = None
    labor_has_value: Optional[float] = None
    # Maliyet
    material_has_cost: float
    labor_has_cost: float
    total_cost_has: float
    alis_has_degeri: Optional[float] = None
    # Satış
    profit_rate_percent: float
    sale_has_value: float
    # Sarrafiye/FIFO için
    quantity: Optional[float] = None  # Toplam miktar (adet veya gram)
    remaining_quantity: Optional[float] = None  # Kalan miktar
    unit_has: Optional[float] = None  # Birim HAS değeri
    track_type: Optional[str] = None  # FIFO, POOL, UNIQUE
    unit: Optional[str] = None  # PIECE, GRAM
    fixed_weight: Optional[float] = None  # Sarrafiye sabit ağırlık
    # Tedarikçi bilgisi
    supplier_party_id: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_price_has: Optional[float] = None
    purchase_transaction_id: Optional[str] = None
    # Metadata
    images: List[str] = []
    stock_status_id: int
    is_gold_based: bool
    created_at: str
    updated_at: str


class ImageUpload(BaseModel):
    image: str  # Base64 encoded image data
    filename: Optional[str] = None
