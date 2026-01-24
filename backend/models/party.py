"""Party related Pydantic models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class PartyCreate(BaseModel):
    party_type_id: int  # 1=CUSTOMER, 2=SUPPLIER
    # Müşteri için
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tc_kimlik_no: Optional[str] = None
    # Tedarikçi için
    company_name: Optional[str] = None
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    contact_person: Optional[str] = None
    # Ortak alanlar
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class PartyUpdate(BaseModel):
    party_type_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tc_kimlik_no: Optional[str] = None
    company_name: Optional[str] = None
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class Party(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str  # Computed: first_name + last_name or company_name
    party_type_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tc_kimlik_no: Optional[str] = None
    company_name: Optional[str] = None
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class PartyBalance(BaseModel):
    party_id: str
    has_gold_balance: float = 0.0
    try_balance: float = 0.0
    usd_balance: float = 0.0
    eur_balance: float = 0.0


def generate_party_code(party_type_id: int) -> str:
    """Generate party code based on type"""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:4].upper()
    
    if party_type_id == 1:  # CUSTOMER
        return f"CUST-{date_str}-{random_suffix}"
    elif party_type_id == 2:  # SUPPLIER
        return f"SUP-{date_str}-{random_suffix}"
    else:
        return f"PARTY-{date_str}-{random_suffix}"
