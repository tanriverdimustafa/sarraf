"""Constants used throughout the application"""

# Transaction types
TRANSACTION_TYPES = ["PURCHASE", "SALE", "PAYMENT", "RECEIPT", "EXCHANGE", "HURDA"]

# Party types mapping
PARTY_TYPES = {
    "CUSTOMER": 1,
    "SUPPLIER": 2,
    "BOTH": 3
}

# Default currency
DEFAULT_CURRENCY = "TRY"

# Supported currencies
CURRENCIES = ["TRY", "USD", "EUR", "HAS"]

# Stock statuses
STOCK_STATUS = {
    "IN_STOCK": 1,
    "SOLD": 2,
    "RESERVED": 3
}

# Labor types
LABOR_TYPES = {
    "PER_GRAM": 1,
    "PER_PIECE": 2
}

# Track types
TRACK_TYPES = ["FIFO", "POOL", "UNIQUE"]

# Product groups
PRODUCT_GROUPS = ["SARRAFIYE", "GRAM_GOLD", "HURDA", "TAKI", "BILEZIK"]
