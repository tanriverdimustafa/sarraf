"""Transaction related Pydantic models"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import uuid


class TransactionCreate(BaseModel):
    party_id: str
    asset_type_id: int
    direction_id: int
    quantity: Optional[float] = None  # For HAS_GOLD
    amount: Optional[float] = None  # For TRY/USD/EUR
    transaction_date: str
    description: Optional[str] = None


class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    party_id: str
    asset_type_id: int
    direction_id: int
    quantity: Optional[float] = None
    amount: Optional[float] = None
    transaction_date: str
    created_at: str
    description: Optional[str] = None


class FinancialTransactionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type_code: str
    party_id: Optional[str] = None
    counterparty_id: Optional[str] = None
    transaction_date: str
    currency: Optional[str] = None
    total_amount_currency: Optional[float] = None
    payment_method_code: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[List[dict]] = []
    meta: Optional[dict] = {}
    idempotency_key: Optional[str] = None
    # For EXCHANGE
    from_currency: Optional[str] = None
    to_currency: Optional[str] = None
    from_amount: Optional[float] = None
    to_amount: Optional[float] = None
    fx_rate: Optional[float] = None
    # For GOLD_SCRAP payment
    scrap_lines: Optional[List[dict]] = None
    total_has_amount: Optional[float] = None
    # For SALE - Discount/Debt (Pazarlık)
    expected_amount_tl: Optional[float] = None
    actual_amount_tl: Optional[float] = None
    discount_tl: Optional[float] = None
    discount_has: Optional[float] = None
    sale_has_value: Optional[float] = None
    collected_has: Optional[float] = None
    customer_debt_has: Optional[float] = None
    is_credit_sale: Optional[bool] = None
    has_price_used: Optional[float] = None
    # For RECEIPT/PAYMENT - Discount
    paid_has: Optional[float] = None
    remaining_debt_has: Optional[float] = None
    is_discount: Optional[bool] = None
    party_debt_has: Optional[float] = None
    our_debt_has: Optional[float] = None
    # For CASH REGISTER INTEGRATION
    cash_register_id: Optional[str] = None
    # DÖVİZ ALANLARI
    payment_currency: Optional[str] = None  # USD, EUR, TRY
    foreign_amount: Optional[float] = None  # Döviz tutarı (100 USD gibi)
    exchange_rate: Optional[float] = None   # Döviz kuru (42.50 gibi)
    tl_equivalent: Optional[float] = None   # TL karşılığı (4250 gibi)
    # EXCHANGE kasa alanları
    foreign_cash_register_id: Optional[str] = None  # USD/EUR Kasa ID
    tl_cash_register_id: Optional[str] = None       # TL Kasa ID
    exchange_type: Optional[str] = None             # BUY veya SELL
    tl_amount: Optional[float] = None               # TL tutarı
    # PURCHASE fark işlemi seçimi
    payment_difference_action: Optional[str] = None  # "PROFIT_LOSS" veya "CREDIT"


class FinancialTransactionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str
    type_code: str
    party_id: Optional[str] = None
    transaction_date: str
    status: str
    total_has_amount: float
    currency: Optional[str] = None
    total_amount_currency: Optional[float] = None
    notes: Optional[str] = None
    meta: Optional[dict] = {}


class TransactionCancelRequest(BaseModel):
    reason: str = "İşlem iptal edildi"


class TransactionEditRequest(BaseModel):
    party_id: Optional[str] = None
    transaction_date: Optional[str] = None
    notes: Optional[str] = None
    payment_type: Optional[str] = None
    paid_amount: Optional[float] = None
    payment_currency: Optional[str] = None
    cash_register_id: Optional[str] = None
    discount_has: Optional[float] = None
    discount_description: Optional[str] = None
