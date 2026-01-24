/**
 * Report Service
 * Rapor API çağrıları
 */
import api from '../lib/api';

export const reportService = {
  /**
   * Kar/Zarar raporu
   * @param {string} startDate - Başlangıç tarihi (YYYY-MM-DD)
   * @param {string} endDate - Bitiş tarihi (YYYY-MM-DD)
   */
  getProfitLoss: async (startDate, endDate) => {
    const response = await api.get('/api/reports/profit-loss', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  },

  /**
   * Hesap ekstresi
   * @param {string} partyId - Party ID
   * @param {string} startDate - Başlangıç tarihi
   * @param {string} endDate - Bitiş tarihi
   */
  getAccountStatement: async (partyId, startDate, endDate) => {
    const response = await api.get(`/api/unified-ledger/party/${partyId}/statement`, {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  },

  /**
   * Altın hareketleri raporu
   * @param {string} startDate - Başlangıç tarihi
   * @param {string} endDate - Bitiş tarihi
   * @param {Object} filters - Ek filtreler
   */
  getGoldMovements: async (startDate, endDate, filters = {}) => {
    const response = await api.get('/api/reports/gold-movements', {
      params: { start_date: startDate, end_date: endDate, ...filters }
    });
    return response.data;
  },

  /**
   * Unified Ledger
   * @param {Object} params - Filtreleme parametreleri
   */
  getUnifiedLedger: async (params = {}) => {
    const response = await api.get('/api/reports/unified-ledger', { params });
    return response.data;
  },

  /**
   * Stok raporu
   * @param {Object} params - Filtreleme parametreleri
   */
  getStockReport: async (params = {}) => {
    const response = await api.get('/api/stock-lots', { params });
    return response.data;
  },

  /**
   * Stok havuzu raporu
   */
  getStockPools: async () => {
    const response = await api.get('/api/stock-pools');
    return response.data;
  },

  /**
   * Gider özeti raporu
   * @param {string} startDate - Başlangıç tarihi
   * @param {string} endDate - Bitiş tarihi
   */
  getExpenseSummary: async (startDate, endDate) => {
    const response = await api.get('/api/expenses/summary', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }
};

export default reportService;
