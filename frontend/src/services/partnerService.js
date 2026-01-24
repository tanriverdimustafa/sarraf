/**
 * Partner Service
 * Ortak/Sermaye yönetimi API çağrıları
 */
import api from '../lib/api';

export const partnerService = {
  /**
   * Tüm ortakları getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getAll: async (params = {}) => {
    const response = await api.get('/api/partners', { params });
    return response.data;
  },

  /**
   * Ortak detayı getir
   * @param {string} id - Partner ID
   */
  getById: async (id) => {
    const response = await api.get(`/api/partners/${id}`);
    return response.data;
  },

  /**
   * Yeni ortak oluştur
   * @param {Object} data - Ortak verileri
   */
  create: async (data) => {
    const response = await api.post('/api/partners', data);
    return response.data;
  },

  /**
   * Ortak güncelle
   * @param {string} id - Partner ID
   * @param {Object} data - Güncellenecek veriler
   */
  update: async (id, data) => {
    const response = await api.put(`/api/partners/${id}`, data);
    return response.data;
  },

  /**
   * Ortak sil/pasif yap
   * @param {string} id - Partner ID
   */
  delete: async (id) => {
    const response = await api.delete(`/api/partners/${id}`);
    return response.data;
  },

  /**
   * Sermaye hareketlerini getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getCapitalMovements: async (params = {}) => {
    const response = await api.get('/api/capital-movements', { params });
    return response.data;
  },

  /**
   * Yeni sermaye hareketi oluştur
   * @param {Object} data - Hareket verileri
   */
  createCapitalMovement: async (data) => {
    const response = await api.post('/api/capital-movements', data);
    return response.data;
  },

  /**
   * Ortak sermaye özeti
   * @param {string} id - Partner ID
   */
  getCapitalSummary: async (id) => {
    const response = await api.get(`/api/partners/${id}/capital-summary`);
    return response.data;
  },

  /**
   * Tüm ortakların sermaye dağılımı
   */
  getCapitalDistribution: async () => {
    const response = await api.get('/api/partners/capital-distribution');
    return response.data;
  }
};

export default partnerService;
