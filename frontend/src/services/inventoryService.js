/**
 * Inventory Service
 * Stok sayım ve envanter yönetimi API çağrıları
 */
import api from '../lib/api';

export const inventoryService = {
  /**
   * Stok sayımlarını getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getStockCounts: async (params = {}) => {
    const response = await api.get('/api/stock-counts', { params });
    return response.data;
  },

  /**
   * Stok sayımı detayı
   * @param {string} id - Stock Count ID
   */
  getStockCountById: async (id) => {
    const response = await api.get(`/api/stock-counts/${id}`);
    return response.data;
  },

  /**
   * Yeni stok sayımı başlat
   * @param {Object} data - Sayım verileri
   */
  createStockCount: async (data) => {
    const response = await api.post('/api/stock-counts', data);
    return response.data;
  },

  /**
   * Stok sayımı güncelle
   * @param {string} id - Stock Count ID
   * @param {Object} data - Güncellenecek veriler
   */
  updateStockCount: async (id, data) => {
    const response = await api.put(`/api/stock-counts/${id}`, data);
    return response.data;
  },

  /**
   * Stok sayımına ürün ekle
   * @param {string} countId - Stock Count ID
   * @param {Object} data - Ürün verileri
   */
  addItemToCount: async (countId, data) => {
    const response = await api.post(`/api/stock-counts/${countId}/items`, data);
    return response.data;
  },

  /**
   * Sayım ürünlerini getir
   * @param {string} countId - Stock Count ID
   */
  getCountItems: async (countId) => {
    const response = await api.get(`/api/stock-counts/${countId}/items`);
    return response.data;
  },

  /**
   * Stok lotlarını getir (FIFO)
   * @param {Object} params - Filtreleme parametreleri
   */
  getStockLots: async (params = {}) => {
    const response = await api.get('/api/stock-lots', { params });
    return response.data;
  },

  /**
   * Stok havuzlarını getir
   * @param {Object} params - Filtreleme parametreleri
   */
  getStockPools: async (params = {}) => {
    const response = await api.get('/api/stock-pools', { params });
    return response.data;
  },

  /**
   * Belirli bir stok havuzu detayı
   * @param {number} productTypeId - Ürün tipi ID
   * @param {number} karatId - Ayar ID
   */
  getStockPoolInfo: async (productTypeId, karatId) => {
    const response = await api.get(`/api/stock-pools/${productTypeId}/${karatId}`);
    return response.data;
  },

  /**
   * Stok lot özeti
   * @param {number} productTypeId - Ürün tipi ID
   * @param {number} karatId - Ayar ID (opsiyonel)
   */
  getStockLotSummary: async (productTypeId, karatId = null) => {
    const params = karatId ? { karat_id: karatId } : {};
    const response = await api.get(`/api/stock-lots/summary/${productTypeId}`, { params });
    return response.data;
  }
};

export default inventoryService;
