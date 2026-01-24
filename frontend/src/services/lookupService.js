/**
 * Lookup Service
 * Sabit değerler (lookup) API çağrıları
 * Bu servis cache kullanır - değerler sık değişmez
 */
import api from '../lib/api';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

const getCached = async (key, fetcher) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

export const lookupService = {
  /**
   * Ayar değerleri (karats)
   */
  getKarats: async () => {
    return getCached('karats', async () => {
      const response = await api.get('/api/lookups/karats');
      return response.data;
    });
  },

  /**
   * Para birimleri
   */
  getCurrencies: async () => {
    return getCached('currencies', async () => {
      const response = await api.get('/api/lookups/currencies');
      return response.data;
    });
  },

  /**
   * Party tipleri
   */
  getPartyTypes: async () => {
    return getCached('partyTypes', async () => {
      const response = await api.get('/api/lookups/party-types');
      return response.data;
    });
  },

  /**
   * Ödeme yöntemleri
   */
  getPaymentMethods: async () => {
    return getCached('paymentMethods', async () => {
      const response = await api.get('/api/lookups/payment-methods');
      return response.data;
    });
  },

  /**
   * Ürün tipleri
   */
  getProductTypes: async () => {
    return getCached('productTypes', async () => {
      const response = await api.get('/api/lookups/product-types');
      return response.data;
    });
  },

  /**
   * İşçilik tipleri
   */
  getLaborTypes: async () => {
    return getCached('laborTypes', async () => {
      const response = await api.get('/api/lookups/labor-types');
      return response.data;
    });
  },

  /**
   * Stok durumları
   */
  getStockStatuses: async () => {
    return getCached('stockStatuses', async () => {
      const response = await api.get('/api/lookups/stock-statuses');
      return response.data;
    });
  },

  /**
   * İşlem tipleri
   */
  getTransactionTypes: async () => {
    return getCached('transactionTypes', async () => {
      const response = await api.get('/api/lookups/transaction-types');
      return response.data;
    });
  },

  /**
   * Generic lookup getter
   * @param {string} lookupName - Lookup adı
   */
  get: async (lookupName) => {
    return getCached(lookupName, async () => {
      const response = await api.get(`/api/lookups/${lookupName}`);
      return response.data;
    });
  },

  /**
   * Tüm lookupları bir kerede getir (optimizasyon)
   */
  getAll: async () => {
    const [karats, currencies, partyTypes, paymentMethods, productTypes, laborTypes, stockStatuses, transactionTypes] = await Promise.all([
      lookupService.getKarats(),
      lookupService.getCurrencies(),
      lookupService.getPartyTypes(),
      lookupService.getPaymentMethods(),
      lookupService.getProductTypes(),
      lookupService.getLaborTypes(),
      lookupService.getStockStatuses(),
      lookupService.getTransactionTypes()
    ]);
    return {
      karats,
      currencies,
      partyTypes,
      paymentMethods,
      productTypes,
      laborTypes,
      stockStatuses,
      transactionTypes
    };
  },

  /**
   * Cache temizle
   */
  clearCache: () => {
    cache.clear();
  }
};

export default lookupService;
