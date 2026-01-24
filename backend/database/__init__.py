"""Database utilities package"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'kuyumcu')

# Database reference (can be set externally)
_db = None

def set_db(database):
    """Set database instance externally"""
    global _db
    _db = database

def get_db():
    """Get database instance"""
    global _db
    if _db is not None:
        return _db
    # Fallback to creating own connection
    client = AsyncIOMotorClient(mongo_url)
    return client[DB_NAME]

def get_client():
    """Get MongoDB client"""
    return AsyncIOMotorClient(mongo_url)

# Import indexes
from .indexes import init_database_indexes

__all__ = ["set_db", "get_db", "get_client", "init_database_indexes"]
