/**
 * Market Service
 * Piyasa verileri API çağrıları
 */
import api from '../lib/api';

export const marketService = {
  /**
   * En son piyasa verilerini getir
   */
  getLatest: async () => {
    const response = await api.get('/api/market-data/latest');
    return response.data;
  },

  /**
   * En son fiyat snapshot'ını getir
   */
  getLatestPriceSnapshot: async () => {
    const response = await api.get('/api/price-snapshots/latest');
    return response.data;
  },

  /**
   * Altın fiyatlarını getir
   */
  getGoldPrices: async () => {
    const response = await api.get('/api/market-data/latest');
    const data = response.data;
    return {
      buy: data.has_gold_buy,
      sell: data.has_gold_sell,
      timestamp: data.timestamp
    };
  },

  /**
   * Döviz kurlarını getir
   */
  getExchangeRates: async () => {
    const response = await api.get('/api/market-data/latest');
    const data = response.data;
    return {
      usd: { buy: data.usd_buy, sell: data.usd_sell },
      eur: { buy: data.eur_buy, sell: data.eur_sell },
      timestamp: data.timestamp
    };
  }
};

export default marketService;
