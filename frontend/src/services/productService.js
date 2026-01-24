/**
 * Product Service
 * Ürün yönetimi API çağrıları
 */
import api from '../lib/api';

export const productService = {
  /**
   * Tüm ürünleri getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getAll: async (params = {}) => {
    const response = await api.get('/api/products', { params });
    return response.data;
  },

  /**
   * Ürün detayı getir
   * @param {string} id - Product ID
   */
  getById: async (id) => {
    const response = await api.get(`/api/products/${id}`);
    return response.data;
  },

  /**
   * Yeni ürün oluştur
   * @param {Object} data - Ürün verileri
   */
  create: async (data) => {
    const response = await api.post('/api/products', data);
    return response.data;
  },

  /**
   * Ürün güncelle
   * @param {string} id - Product ID
   * @param {Object} data - Güncellenecek veriler
   */
  update: async (id, data) => {
    const response = await api.put(`/api/products/${id}`, data);
    return response.data;
  },

  /**
   * Ürün sil
   * @param {string} id - Product ID
   */
  delete: async (id) => {
    const response = await api.delete(`/api/products/${id}`);
    return response.data;
  },

  /**
   * Ürün geçmişi getir
   * @param {string} id - Product ID
   */
  getHistory: async (id) => {
    const response = await api.get(`/api/products/${id}/history`);
    return response.data;
  },

  /**
   * Barkod ile ürün ara
   * @param {string} barcode - Barkod
   */
  getByBarcode: async (barcode) => {
    const response = await api.get(`/api/products/barcode/${barcode}`);
    return response.data;
  },

  /**
   * Stok durumunu güncelle
   * @param {string} id - Product ID
   * @param {string} status - Yeni stok durumu
   */
  updateStatus: async (id, status) => {
    const response = await api.patch(`/api/products/${id}/status`, { status });
    return response.data;
  }
};

export default productService;
