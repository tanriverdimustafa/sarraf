/**
 * Party (Cari) Service
 * Müşteri ve Tedarikçi yönetimi API çağrıları
 */
import api from '../lib/api';

export const partyService = {
  /**
   * Tüm parti'leri getir
   * @param {Object} params - Filtreleme parametreleri
   * @param {number} params.page - Sayfa numarası
   * @param {number} params.page_size - Sayfa başına kayıt
   * @param {number} params.party_type_id - Party tipi filtresi
   * @param {boolean} params.is_active - Aktif/Pasif filtresi
   * @param {string} params.search - Arama terimi
   * @param {string} params.role - 'customer' | 'supplier'
   */
  getAll: async (params = {}) => {
    const response = await api.get('/api/parties', { params });
    return response.data;
  },

  /**
   * Party detayı getir
   * @param {string} id - Party ID
   */
  getById: async (id) => {
    const response = await api.get(`/api/parties/${id}`);
    return response.data;
  },

  /**
   * Party bakiyesi getir
   * @param {string} id - Party ID
   */
  getBalance: async (id) => {
    const response = await api.get(`/api/parties/${id}/balance`);
    return response.data;
  },

  /**
   * Party işlemlerini getir
   * @param {string} id - Party ID
   * @param {Object} params - Filtreleme parametreleri
   */
  getTransactions: async (id, params = {}) => {
    const response = await api.get(`/api/parties/${id}/transactions`, { params });
    return response.data;
  },

  /**
   * Yeni party oluştur
   * @param {Object} data - Party verileri
   */
  create: async (data) => {
    const response = await api.post('/api/parties', data);
    return response.data;
  },

  /**
   * Party güncelle
   * @param {string} id - Party ID
   * @param {Object} data - Güncellenecek veriler
   */
  update: async (id, data) => {
    const response = await api.put(`/api/parties/${id}`, data);
    return response.data;
  },

  /**
   * Party sil
   * @param {string} id - Party ID
   */
  delete: async (id) => {
    const response = await api.delete(`/api/parties/${id}`);
    return response.data;
  },

  /**
   * Party ekstre (hesap özeti)
   * @param {string} id - Party ID
   * @param {string} startDate - Başlangıç tarihi
   * @param {string} endDate - Bitiş tarihi
   */
  getStatement: async (id, startDate, endDate) => {
    const response = await api.get(`/api/unified-ledger/party/${id}/statement`, {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }
};

export default partyService;
