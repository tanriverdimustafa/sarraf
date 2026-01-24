"""Admin routes - Administrative operations"""
from fastapi import APIRouter, HTTPException, Depends
import logging

from database import get_db
from auth import get_current_user
from models.user import User

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


@router.post("/fix-party-balances")
async def fix_all_party_balances(
    current_user: User = Depends(get_current_user)
):
    """
    TÜM party'lerin has_balance değerlerini transaction'lardan yeniden hesapla.
    Bu endpoint mevcut verileri düzeltmek için kullanılır.
    """
    db = get_db()
    
    fixed_parties = []
    
    # Tüm party'leri al
    parties = await db.parties.find({}).to_list(1000)
    
    for party in parties:
        party_id = party["id"]
        old_balance = party.get("has_balance", 0)
        
        # Bu party'nin COMPLETED transaction'larını al
        pipeline = [
            {"$match": {"party_id": party_id, "status": {"$ne": "CANCELLED"}}},
            {"$group": {
                "_id": "$type_code",
                "total": {"$sum": "$total_has_amount"}
            }}
        ]
        
        results = await db.financial_transactions.aggregate(pipeline).to_list(10)
        
        # Transaction tipine göre balance hesapla
        new_balance = 0
        breakdown = {}
        
        for r in results:
            type_code = r["_id"]
            total = r["total"]
            breakdown[type_code] = total
            
            if type_code == "PURCHASE":
                # Alış: biz borçlandık (pozitif)
                new_balance += total
            elif type_code == "PAYMENT":
                # Ödeme: borcumuzu kapattık (total zaten negatif)
                new_balance += total  # -57.5 ekleniyor
            elif type_code == "SALE":
                # Satış: müşteri borçlandı (total negatif = bize borçlu)
                # Müşterinin bize borcu = bizim alacağımız = negatif balance
                new_balance += total  # total zaten negatif
            elif type_code == "RECEIPT":
                # Tahsilat: müşteri ödedi (total pozitif = alacağımız azaldı)
                new_balance += total
        
        # Bakiyeyi güncelle
        await db.parties.update_one(
            {"id": party_id},
            {"$set": {"has_balance": new_balance}}
        )
        
        if abs(old_balance - new_balance) > 0.0001:
            fixed_parties.append({
                "party_id": party_id,
                "name": party.get("name"),
                "old_balance": old_balance,
                "new_balance": new_balance,
                "breakdown": breakdown
            })
        
        logger.info(f"Fixed party {party.get('name')}: {old_balance} -> {new_balance}")
    
    return {
        "success": True,
        "message": f"{len(fixed_parties)} party bakiyesi düzeltildi",
        "fixed_parties": fixed_parties
    }
