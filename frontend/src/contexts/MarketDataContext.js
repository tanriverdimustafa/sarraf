import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

const MarketDataContext = createContext(null);

export const MarketDataProvider = ({ children }) => {
  const [marketData, setMarketData] = useState({
    has_gold_buy: null,
    has_gold_sell: null,
    usd_buy: null,
    usd_sell: null,
    eur_buy: null,
    eur_sell: null,
    timestamp: null
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const fetchMarketData = useCallback(async () => {
    try {
      const response = await api.get('/api/market-data/latest');
      const data = response.data;
      
      if (data) {
        setMarketData({
          has_gold_buy: data.has_gold_buy,
          has_gold_sell: data.has_gold_sell,
          usd_buy: data.usd_buy,
          usd_sell: data.usd_sell,
          eur_buy: data.eur_buy,
          eur_sell: data.eur_sell,
          timestamp: data.timestamp
        });
        
        if (data.has_gold_buy !== null || data.usd_buy !== null) {
          setConnected(true);
          setError(null);
          retryCountRef.current = 0;
        }
      }
    } catch (err) {
      console.warn('Market data fetch warning:', err.message);
      
      // 429 veya diğer hatalar için retry logic
      if (err.response?.status === 429) {
        retryCountRef.current += 1;
        if (retryCountRef.current >= maxRetries) {
          setError('Rate limited - bekleyin');
          setConnected(false);
        }
      } else if (err.response?.status === 401) {
        // Token expired - sayfayı yenilemeden önce bekle
        setError('Oturum süresi doldu');
      } else {
        setError('Bağlantı hatası');
        setConnected(false);
      }
    }
  }, []);

  useEffect(() => {
    // Token varsa fetch yap
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    // Initial fetch
    fetchMarketData();

    // Poll every 30 seconds (was 5 - causing 429)
    const interval = setInterval(fetchMarketData, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchMarketData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    retryCountRef.current = 0;
    fetchMarketData();
  }, [fetchMarketData]);

  return (
    <MarketDataContext.Provider value={{ marketData, connected, error, refresh }}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within MarketDataProvider');
  }
  return context;
};
