"""Market WebSocket client for real-time price data"""
import socketio
import asyncio
import json
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Global market data cache
market_data_cache = {
    "has_gold_buy": None,
    "has_gold_sell": None,
    "usd_buy": None,
    "usd_sell": None,
    "eur_buy": None,
    "eur_sell": None,
    "timestamp": None
}

# Database reference (set during initialization)
_db = None

def set_database(db):
    """Set database reference for WebSocket module"""
    global _db
    _db = db

def get_market_data_cache():
    """Get current market data cache"""
    return market_data_cache.copy()

async def connect_to_market_websocket():
    """Connect to the market data WebSocket and store data in MongoDB"""
    global _db
    
    sio = socketio.AsyncClient(logger=False, engineio_logger=False)
    
    @sio.event
    async def connect():
        logger.info('Connected to market WebSocket')
    
    @sio.event
    async def disconnect():
        logger.info('Disconnected from market WebSocket')
    
    @sio.event
    async def message(data):
        """Handle message events"""
        try:
            logger.info(f"Received message: {str(data)[:200]}")
            await process_market_data(data)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    # Listen to specific events that might contain price data
    @sio.on('price_changed')
    async def on_price_changed(data):
        """Handle price_changed events"""
        try:
            logger.info(f"Price changed event received")
            logger.info(f"Data keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")
            logger.info(f"Sample data: {str(data)[:500]}")
            await process_market_data(data)
        except Exception as e:
            logger.error(f"Error in price_changed: {e}")
    
    # Listen to all events
    @sio.on('*')
    async def catch_all(event, *args):
        """Catch all events from the WebSocket"""
        try:
            if event != 'price_changed':  # Don't duplicate price_changed logs
                logger.info(f"Received event '{event}' with {len(args)} args")
            
            if args and len(args) > 0 and event != 'price_changed':
                data = args[0]
                await process_market_data(data)
        
        except Exception as e:
            logger.error(f"Error in catch_all: {e}")
    
    async def process_market_data(data):
        """Process and store market data"""
        global _db
        
        try:
            # Parse market data
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except:
                    pass
            
            if isinstance(data, dict):
                new_data = {}
                timestamp = datetime.now(timezone.utc).isoformat()
                
                # Extract data from the nested structure
                market_data = data.get('data', {})
                
                # Extract gold prices (ALTIN)
                if 'ALTIN' in market_data:
                    altin = market_data['ALTIN']
                    if 'alis' in altin:
                        try:
                            new_data['has_gold_buy'] = float(altin['alis'])
                        except (ValueError, TypeError):
                            pass
                    if 'satis' in altin:
                        try:
                            new_data['has_gold_sell'] = float(altin['satis'])
                        except (ValueError, TypeError):
                            pass
                
                # Extract USD prices (USDTRY)
                if 'USDTRY' in market_data:
                    usd = market_data['USDTRY']
                    if 'alis' in usd:
                        try:
                            new_data['usd_buy'] = float(usd['alis'])
                        except (ValueError, TypeError):
                            pass
                    if 'satis' in usd:
                        try:
                            new_data['usd_sell'] = float(usd['satis'])
                        except (ValueError, TypeError):
                            pass
                
                # Extract EUR prices (EURTRY)
                if 'EURTRY' in market_data:
                    eur = market_data['EURTRY']
                    if 'alis' in eur:
                        try:
                            new_data['eur_buy'] = float(eur['alis'])
                        except (ValueError, TypeError):
                            pass
                    if 'satis' in eur:
                        try:
                            new_data['eur_sell'] = float(eur['satis'])
                        except (ValueError, TypeError):
                            pass
                
                # Only update if we got some data and it's different
                if new_data:
                    is_different = False
                    for key, value in new_data.items():
                        if market_data_cache.get(key) != value:
                            is_different = True
                            break
                    
                    if is_different:
                        market_data_cache.update(new_data)
                        market_data_cache['timestamp'] = timestamp
                        
                        # Store in MongoDB (market_data)
                        if _db is not None:
                            await _db.market_data.insert_one({
                                **market_data_cache,
                                "_id": str(uuid.uuid4())
                            })
                            
                            # Store price snapshot for financial_transactions V2
                            if 'has_gold_buy' in new_data and 'has_gold_sell' in new_data:
                                # Get USD rates from market_data_cache if not in new_data
                                usd_buy = new_data.get('usd_buy') or market_data_cache.get('usd_buy')
                                usd_sell = new_data.get('usd_sell') or market_data_cache.get('usd_sell')
                                eur_buy = new_data.get('eur_buy') or market_data_cache.get('eur_buy')
                                eur_sell = new_data.get('eur_sell') or market_data_cache.get('eur_sell')
                                
                                snapshot_doc = {
                                    "as_of": datetime.now(timezone.utc),
                                    "source": "HAREM_SOCKET",
                                    "has_buy_tl": round(new_data['has_gold_buy'], 6),
                                    "has_sell_tl": round(new_data['has_gold_sell'], 6),
                                    "usd_buy_tl": round(usd_buy, 4) if usd_buy else None,
                                    "usd_sell_tl": round(usd_sell, 4) if usd_sell else None,
                                    "eur_buy_tl": round(eur_buy, 4) if eur_buy else None,
                                    "eur_sell_tl": round(eur_sell, 4) if eur_sell else None,
                                    "raw_payload": data,
                                    "created_at": datetime.now(timezone.utc),
                                    "created_by": "system"
                                }
                                
                                # Check if similar snapshot exists in last 60 seconds (debounce)
                                last_snapshot = await _db.price_snapshots.find_one(
                                    {"source": "HAREM_SOCKET"},
                                    sort=[("as_of", -1)]
                                )
                                
                                should_insert = True
                                if last_snapshot and last_snapshot.get("as_of"):
                                    last_as_of = last_snapshot["as_of"]
                                    # Ensure both datetimes are timezone-aware
                                    if last_as_of.tzinfo is None:
                                        last_as_of = last_as_of.replace(tzinfo=timezone.utc)
                                    time_diff = (snapshot_doc["as_of"] - last_as_of).total_seconds()
                                    if time_diff < 60:  # Less than 60 seconds
                                        should_insert = False
                                
                                if should_insert:
                                    await _db.price_snapshots.insert_one(snapshot_doc)
                                    logger.info(f"Ã„Å¸Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° Price snapshot saved: HAS Buy={snapshot_doc['has_buy_tl']}, Sell={snapshot_doc['has_sell_tl']}")
                        
                        logger.info(f"Updated market data: {new_data}")
        
        except Exception as e:
            logger.error(f"Error processing market data: {e}")
    
    while True:
        try:
            logger.info("Attempting to connect to market WebSocket...")
            await sio.connect(
                'https://socket.haremaltin.com',
                transports=['websocket'],
                wait_timeout=10,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://www.haremaltin.com',
                    'Referer': 'https://www.haremaltin.com/'
                }
            )
            await sio.wait()
        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            await asyncio.sleep(10)  # Wait before reconnecting
