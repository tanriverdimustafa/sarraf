/**
 * Employee Service
 * Çalışan yönetimi API çağrıları
 */
import api from '../lib/api';

export const employeeService = {
  /**
   * Tüm çalışanları getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getAll: async (params = {}) => {
    const response = await api.get('/api/employees', { params });
    return response.data;
  },

  /**
   * Çalışan detayı getir
   * @param {string} id - Employee ID
   */
  getById: async (id) => {
    const response = await api.get(`/api/employees/${id}`);
    return response.data;
  },

  /**
   * Yeni çalışan oluştur
   * @param {Object} data - Çalışan verileri
   */
  create: async (data) => {
    const response = await api.post('/api/employees', data);
    return response.data;
  },

  /**
   * Çalışan güncelle
   * @param {string} id - Employee ID
   * @param {Object} data - Güncellenecek veriler
   */
  update: async (id, data) => {
    const response = await api.put(`/api/employees/${id}`, data);
    return response.data;
  },

  /**
   * Çalışan sil/pasif yap
   * @param {string} id - Employee ID
   */
  delete: async (id) => {
    const response = await api.delete(`/api/employees/${id}`);
    return response.data;
  },

  /**
   * Maaş hareketlerini getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getSalaryMovements: async (params = {}) => {
    const response = await api.get('/api/salary-movements', { params });
    return response.data;
  },

  /**
   * Yeni maaş hareketi oluştur
   * @param {Object} data - Hareket verileri
   */
  createSalaryMovement: async (data) => {
    const response = await api.post('/api/salary-movements', data);
    return response.data;
  },

  /**
   * Çalışan borç durumu
   * @param {string} id - Employee ID
   */
  getDebtStatus: async (id) => {
    const response = await api.get(`/api/employees/${id}/debt-status`);
    return response.data;
  },

  /**
   * Çalışan maaş geçmişi
   * @param {string} id - Employee ID
   * @param {Object} params - Filtreleme parametreleri
   */
  getSalaryHistory: async (id, params = {}) => {
    const response = await api.get(`/api/employees/${id}/salary-history`, { params });
    return response.data;
  }
};

export default employeeService;
