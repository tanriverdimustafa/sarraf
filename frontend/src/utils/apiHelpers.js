/**
 * API Response Helper Functions
 * API'lerden gelen farklı formatlardaki verileri standart hale getirir
 */

/**
 * API response'dan data array'ini çıkarır
 * @param {Object} response - Axios response objesi veya data
 * @returns {Array} - Array formatında veri
 * 
 * Desteklenen formatlar:
 * - Pagination: {data: [...], pagination: {...}}
 * - Direct array: [...]
 * - Items format: {items: [...]}
 * - Products format: {products: [...]}
 * - Nested data: response.data.data
 */
export function extractArrayData(response) {
  // Null/undefined kontrolü
  if (!response) return [];
  
  // Axios response objesi ise .data al
  const responseData = response?.data !== undefined ? response.data : response;
  
  if (!responseData) return [];
  
  // Zaten array ise direkt dön
  if (Array.isArray(responseData)) {
    return responseData;
  }
  
  // Pagination format: {data: [...], pagination: {...}}
  if (responseData.data && Array.isArray(responseData.data)) {
    return responseData.data;
  }
  
  // Items format: {items: [...]}
  if (responseData.items && Array.isArray(responseData.items)) {
    return responseData.items;
  }
  
  // Products format: {products: [...]}
  if (responseData.products && Array.isArray(responseData.products)) {
    return responseData.products;
  }
  
  // Users format: {users: [...]}
  if (responseData.users && Array.isArray(responseData.users)) {
    return responseData.users;
  }
  
  // Entries format: {entries: [...]}
  if (responseData.entries && Array.isArray(responseData.entries)) {
    return responseData.entries;
  }
  
  // Results format: {results: [...]}
  if (responseData.results && Array.isArray(responseData.results)) {
    return responseData.results;
  }
  
  // Fallback - boş array
  console.warn('Unexpected API response format:', responseData);
  return [];
}

/**
 * API response'dan pagination bilgisini çıkarır
 * @param {Object} response - Axios response objesi
 * @returns {Object} - Pagination bilgisi
 */
export function extractPagination(response) {
  const responseData = response?.data;
  
  if (responseData?.pagination) {
    return responseData.pagination;
  }
  
  // Total bilgisi varsa
  if (responseData?.total !== undefined) {
    return {
      page: responseData.page || 1,
      page_size: responseData.page_size || responseData.per_page || 10,
      total_items: responseData.total,
      total_pages: responseData.total_pages || Math.ceil(responseData.total / (responseData.page_size || 10))
    };
  }
  
  // Default pagination
  const items = extractArrayData(response);
  return {
    page: 1,
    page_size: items.length || 10,
    total_items: items.length,
    total_pages: 1
  };
}

/**
 * Güvenli array kontrolü ve dönüşümü
 * @param {any} data - Kontrol edilecek veri
 * @returns {Array} - Array formatında veri
 */
export function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.products && Array.isArray(data.products)) return data.products;
  return [];
}

/**
 * State setter için güvenli data extraction
 * @param {Object} response - API response
 * @param {Function} setter - React setState function
 */
export function safeSetArrayState(response, setter) {
  const data = extractArrayData(response);
  setter(data);
  return data;
}

export default {
  extractArrayData,
  extractPagination,
  ensureArray,
  safeSetArrayState
};
