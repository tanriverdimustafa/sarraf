/**
 * Financial Transactions V2 API Service
 * Backend endpoint'lere uyumlu API servisleri
 */

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Helper: Auth token al
const getAuthToken = () => {
  const token = localStorage.getItem('token');
  return token;
};

// Helper: Fetch wrapper with auth
const fetchWithAuth = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

// ==================== TRANSACTIONS ====================

/**
 * Create a new financial transaction
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>}
 */
export const createFinancialTransaction = async (data) => {
  return fetchWithAuth('/api/financial-transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Get all financial transactions with filters
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>}
 */
export const getFinancialTransactions = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/financial-transactions${queryString ? `?${queryString}` : ''}`;
  return fetchWithAuth(url);
};

/**
 * Get a single transaction by code
 * @param {string} code - Transaction code
 * @returns {Promise<Object>}
 */
export const getFinancialTransaction = async (code) => {
  return fetchWithAuth(`/api/financial-transactions/${code}`);
};

// ==================== PARTY BALANCE ====================

/**
 * Get party balance (HAS aggregation)
 * @param {string} partyId - Party ID
 * @returns {Promise<Object>}
 */
export const getPartyBalance = async (partyId) => {
  return fetchWithAuth(`/api/financial-v2/parties/${partyId}/balance`);
};

// ==================== LOOKUPS ====================

/**
 * Get transaction types
 * @returns {Promise<Array>}
 */
export const getTransactionTypes = async () => {
  const response = await fetchWithAuth('/api/financial-v2/lookups/transaction-types');
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
};

/**
 * Get payment methods
 * @returns {Promise<Array>}
 */
export const getPaymentMethods = async () => {
  const response = await fetchWithAuth('/api/financial-v2/lookups/payment-methods');
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
};

/**
 * Get currencies
 * @returns {Promise<Array>}
 */
export const getCurrencies = async () => {
  const response = await fetchWithAuth('/api/financial-v2/lookups/currencies');
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
};

// ==================== PARTIES ====================

/**
 * Get all parties
 * @returns {Promise<Array>}
 */
export const getParties = async () => {
  const response = await fetchWithAuth('/api/parties');
  // API returns {data: [...], pagination: {...}} - extract data array
  if (response && Array.isArray(response.data)) {
    return response.data;
  }
  // Fallback: if response is already an array
  if (Array.isArray(response)) {
    return response;
  }
  return [];
};

/**
 * Get a single party by ID
 * @param {string} partyId - Party ID
 * @returns {Promise<Object>}
 */
export const getParty = async (partyId) => {
  return fetchWithAuth(`/api/parties/${partyId}`);
};

// ==================== PRODUCTS ====================

/**
 * Get all products
 * @param {Object} filters - Optional filters (e.g., stock_status_id)
 * @returns {Promise<Array>}
 */
export const getProducts = async (filters = {}) => {
  const queryString = new URLSearchParams(filters).toString();
  const url = `/api/products${queryString ? `?${queryString}` : ''}`;
  const response = await fetchWithAuth(url);
  // API returns {products: [...], pagination: {...}} - extract products array
  if (response && Array.isArray(response.products)) {
    return response.products;
  }
  // Fallback: if response is already an array
  if (Array.isArray(response)) {
    return response;
  }
  return [];
};

/**
 * Get a single product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>}
 */
export const getProduct = async (productId) => {
  return fetchWithAuth(`/api/products/${productId}`);
};

/**
 * Get product by barcode
 * @param {string} barcode - Product barcode/SKU
 * @returns {Promise<Object>}
 */
export const getProductByBarcode = async (barcode) => {
  const products = await getProducts();
  return products.find(p => p.barcode === barcode || p.sku === barcode);
};

// ==================== KARATS ====================

/**
 * Get all karats
 * @returns {Promise<Array>}
 */
export const getKarats = async () => {
  const response = await fetchWithAuth('/api/karats');
  // Handle both array and object formats
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
};

// ==================== LOOKUPS ====================

/**
 * Get party types
 * @returns {Promise<Array>}
 */
export const getPartyTypes = async () => {
  const response = await fetchWithAuth('/api/lookups/party-types');
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
};

/**
 * Get product types
 * @returns {Promise<Array>}
 */
export const getProductTypes = async () => {
  const response = await fetchWithAuth('/api/lookups/product-types');
  if (Array.isArray(response)) return response;
  if (response?.data && Array.isArray(response.data)) return response.data;
  return [];
};

// ==================== PRICE SNAPSHOTS ====================

/**
 * Get latest price snapshot
 * @returns {Promise<Object>}
 */
export const getLatestPriceSnapshot = async () => {
  return fetchWithAuth('/api/price-snapshots/latest');
};

// ==================== HELPERS ====================

/**
 * Format HAS value (6 decimal)
 * @param {number} value
 * @returns {string}
 */
export const formatHAS = (value) => {
  if (value === null || value === undefined) return '0.000000';
  return Number(value).toFixed(6);
};

/**
 * Format currency value (2 decimal)
 * @param {number} value
 * @returns {string}
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined) return '0.00';
  return Number(value).toFixed(2);
};

/**
 * Format transaction date
 * @param {string} dateString
 * @returns {string}
 */
export const formatTransactionDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get transaction type label (Turkish)
 * @param {string} typeCode
 * @returns {string}
 */
export const getTransactionTypeLabel = (typeCode) => {
  const labels = {
    PURCHASE: 'Alış',
    SALE: 'Satış',
    PAYMENT: 'Ödeme',
    RECEIPT: 'Tahsilat',
    EXCHANGE: 'Döviz İşlemi',
    HURDA: 'Hurda Altın',
    ADJUSTMENT: 'Düzeltme',
  };
  return labels[typeCode] || typeCode;
};

/**
 * Get status label (Turkish)
 * @param {string} status
 * @returns {string}
 */
export const getStatusLabel = (status) => {
  const labels = {
    COMPLETED: 'Tamamlandı',
    PENDING: 'Beklemede',
    CANCELLED: 'İptal',
    RECONCILED: 'Mutabakat Yapıldı',
  };
  return labels[status] || status;
};

/**
 * Get status color
 * @param {string} status
 * @returns {string}
 */
export const getStatusColor = (status) => {
  const colors = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    CANCELLED: 'bg-red-100 text-red-800',
    RECONCILED: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// ==================== STOCK LOTS (FIFO_LOT) ====================

export const getStockLots = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.product_type_id) queryParams.append('product_type_id', params.product_type_id);
  if (params.karat_id) queryParams.append('karat_id', params.karat_id);
  if (params.status) queryParams.append('status', params.status);
  
  return fetchWithAuth(`/api/stock-lots?${queryParams.toString()}`);
};

export const getStockLotSummary = async (productTypeId, karatId = null) => {
  let url = `/api/stock-lots/summary/${productTypeId}`;
  if (karatId) url += `?karat_id=${karatId}`;
  
  return fetchWithAuth(url);
};

// ==================== STOCK POOLS (Bilezik vb.) ====================

export const getStockPools = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.product_type_id) queryParams.append('product_type_id', params.product_type_id);
  if (params.karat_id) queryParams.append('karat_id', params.karat_id);
  
  return fetchWithAuth(`/api/stock-pools?${queryParams.toString()}`);
};

export const getStockPoolInfo = async (productTypeId, karatId) => {
  return fetchWithAuth(`/api/stock-pools/${productTypeId}/${karatId}`);
};

export default {
  createFinancialTransaction,
  getFinancialTransactions,
  getFinancialTransaction,
  getPartyBalance,
  getTransactionTypes,
  getPaymentMethods,
  getCurrencies,
  getLatestPriceSnapshot,
  getParties,
  getParty,
  getProducts,
  getProduct,
  getProductByBarcode,
  getKarats,
  getPartyTypes,
  getProductTypes,
  getStockLots,
  getStockLotSummary,
  getStockPools,
  getStockPoolInfo,
  formatHAS,
  formatCurrency,
  formatTransactionDate,
  getTransactionTypeLabel,
  getStatusLabel,
  getStatusColor,
};
