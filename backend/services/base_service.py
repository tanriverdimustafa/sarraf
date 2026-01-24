"""Base Service - Common utilities for all transaction services"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from bson import ObjectId as BsonObjectId
from fastapi import HTTPException
import logging
import uuid

from financial_v2_helpers import (
    round_has, round_currency, generate_transaction_code,
    get_or_create_price_snapshot, calculate_material_has, calculate_labor_has,
    convert_currency_to_has, convert_has_to_currency, write_audit_log
)

# Import cash management for automatic cash movements
from cash_management import create_cash_movement_internal, set_database as set_cash_db

# Import unified ledger for dual-write
from init_unified_ledger import create_ledger_entry

logger = logging.getLogger(__name__)


def parse_transaction_date(date_str: str) -> datetime:
    """
    Kullanıcıdan gelen tarihe şu anki saati ekle.
    Eğer zaten saat varsa olduğu gibi kullan.
    
    Örnek:
    - "2025-12-18" -> "2025-12-18T14:30:45+00:00" (şu anki saat)
    - "2025-12-18T10:00:00" -> "2025-12-18T10:00:00+00:00" (verilen saat)
    """
    date_str = date_str.replace('Z', '+00:00')
    
    # Eğer sadece tarih geldiyse (saat yok), şu anki saati ekle
    if 'T' not in date_str:
        now = datetime.now(timezone.utc)
        return datetime.fromisoformat(f"{date_str}T{now.strftime('%H:%M:%S')}+00:00")
    
    # Eğer tarih + saat geldiyse olduğu gibi kullan
    try:
        return datetime.fromisoformat(date_str)
    except:
        # Fallback: timezone ekle
        if '+' not in date_str and '-' not in date_str[-6:]:
            return datetime.fromisoformat(date_str + '+00:00')
        return datetime.fromisoformat(date_str)


# Re-export commonly used utilities
__all__ = [
    'parse_transaction_date',
    'round_has',
    'round_currency',
    'generate_transaction_code',
    'get_or_create_price_snapshot',
    'calculate_material_has',
    'calculate_labor_has',
    'convert_currency_to_has',
    'convert_has_to_currency',
    'write_audit_log',
    'create_cash_movement_internal',
    'create_ledger_entry',
    'logger',
    'HTTPException',
    'datetime',
    'timezone',
    'uuid',
    'BsonObjectId',
]
