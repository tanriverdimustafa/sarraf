/**
 * Cash Service
 * Kasa yönetimi API çağrıları
 */
import api from '../lib/api';

export const cashService = {
  /**
   * Tüm kasaları getir
   */
  getRegisters: async () => {
    const response = await api.get('/api/cash-registers');
    return response.data;
  },

  /**
   * Kasa detayı getir
   * @param {string} id - Kasa ID
   */
  getRegisterById: async (id) => {
    const response = await api.get(`/api/cash-registers/${id}`);
    return response.data;
  },

  /**
   * Kasa güncelle
   * @param {string} id - Kasa ID
   * @param {Object} data - Güncellenecek veriler
   */
  updateRegister: async (id, data) => {
    const response = await api.put(`/api/cash-registers/${id}`, data);
    return response.data;
  },

  /**
   * Kasa hareketlerini getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getMovements: async (params = {}) => {
    const response = await api.get('/api/cash-movements', { params });
    return response.data;
  },

  /**
   * Yeni kasa hareketi oluştur
   * @param {Object} data - Hareket verileri
   */
  createMovement: async (data) => {
    const response = await api.post('/api/cash-movements', data);
    return response.data;
  },

  /**
   * Kasa dashboard verileri
   */
  getDashboard: async () => {
    const response = await api.get('/api/cash/dashboard');
    return response.data;
  },

  /**
   * Kasa özeti (currency bazında)
   * @param {string} currency - Para birimi (TRY, USD, EUR)
   */
  getSummary: async (currency = 'TRY') => {
    const response = await api.get('/api/cash-registers', {
      params: { currency }
    });
    return response.data;
  }
};

export default cashService;
