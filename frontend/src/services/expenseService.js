/**
 * Expense Service
 * Gider yönetimi API çağrıları
 */
import api from '../lib/api';

export const expenseService = {
  /**
   * Tüm giderleri getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getAll: async (params = {}) => {
    const response = await api.get('/api/expenses', { params });
    return response.data;
  },

  /**
   * Gider detayı getir
   * @param {string} id - Expense ID
   */
  getById: async (id) => {
    const response = await api.get(`/api/expenses/${id}`);
    return response.data;
  },

  /**
   * Yeni gider oluştur
   * @param {Object} data - Gider verileri
   */
  create: async (data) => {
    const response = await api.post('/api/expenses', data);
    return response.data;
  },

  /**
   * Gider güncelle
   * @param {string} id - Expense ID
   * @param {Object} data - Güncellenecek veriler
   */
  update: async (id, data) => {
    const response = await api.put(`/api/expenses/${id}`, data);
    return response.data;
  },

  /**
   * Gider sil
   * @param {string} id - Expense ID
   */
  delete: async (id) => {
    const response = await api.delete(`/api/expenses/${id}`);
    return response.data;
  },

  /**
   * Gider kategorilerini getir
   */
  getCategories: async () => {
    const response = await api.get('/api/expense-categories');
    return response.data;
  },

  /**
   * Yeni kategori oluştur
   * @param {Object} data - Kategori verileri
   */
  createCategory: async (data) => {
    const response = await api.post('/api/expense-categories', data);
    return response.data;
  },

  /**
   * Kategori güncelle
   * @param {string} id - Category ID
   * @param {Object} data - Güncellenecek veriler
   */
  updateCategory: async (id, data) => {
    const response = await api.put(`/api/expense-categories/${id}`, data);
    return response.data;
  },

  /**
   * Kategori sil
   * @param {string} id - Category ID
   */
  deleteCategory: async (id) => {
    const response = await api.delete(`/api/expense-categories/${id}`);
    return response.data;
  },

  /**
   * Gider özeti (kategori bazında)
   * @param {string} startDate - Başlangıç tarihi
   * @param {string} endDate - Bitiş tarihi
   */
  getSummary: async (startDate, endDate) => {
    const response = await api.get('/api/expenses/summary', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }
};

export default expenseService;
