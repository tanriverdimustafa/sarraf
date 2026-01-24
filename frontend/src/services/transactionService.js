/**
 * Transaction Service
 * Finansal işlem API çağrıları
 */
import api from '../lib/api';

export const transactionService = {
  /**
   * Tüm işlemleri getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getAll: async (params = {}) => {
    const response = await api.get('/api/financial-transactions', { params });
    return response.data;
  },

  /**
   * İşlem detayı getir (code ile)
   * @param {string} code - Transaction code
   */
  getByCode: async (code) => {
    const response = await api.get(`/api/financial-transactions/${code}`);
    return response.data;
  },

  /**
   * Yeni işlem oluştur
   * @param {Object} data - İşlem verileri
   */
  create: async (data) => {
    const response = await api.post('/api/financial-transactions', data);
    return response.data;
  },

  /**
   * İşlemi iptal et
   * @param {string} code - Transaction code
   */
  void: async (code) => {
    const response = await api.post(`/api/financial-transactions/${code}/void`);
    return response.data;
  },

  /**
   * İşlem tiplerini getir
   */
  getTypes: async () => {
    const response = await api.get('/api/lookups/transaction-types');
    return response.data;
  },

  /**
   * Son işlemleri getir
   * @param {number} limit - Limit
   */
  getRecent: async (limit = 10) => {
    const response = await api.get('/api/financial-transactions', {
      params: { page: 1, per_page: limit, sort_by: 'created_at', sort_order: 'desc' }
    });
    return response.data;
  }
};

export default transactionService;
