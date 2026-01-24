/**
 * useProducts Hook
 * Ürün verilerini yönetir
 */
import { useState, useCallback } from 'react';
import { productService } from '../services';
import useApi from './useApi';

export function useProducts(initialParams = {}) {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState(initialParams);
  const { loading, error, execute } = useApi();

  const fetchProducts = useCallback(async (params = {}) => {
    const mergedParams = { ...filters, ...params };
    
    return execute(
      () => productService.getAll(mergedParams),
      (response) => {
        setProducts(response.products || []);
        setPagination({
          page: response.page || 1,
          pageSize: response.page_size || 20,
          total: response.total || 0,
          totalPages: response.total_pages || 0
        });
      }
    );
  }, [filters, execute]);

  const getProductById = useCallback(async (id) => {
    return execute(() => productService.getById(id));
  }, [execute]);

  const getProductByBarcode = useCallback(async (barcode) => {
    return execute(() => productService.getByBarcode(barcode));
  }, [execute]);

  const createProduct = useCallback(async (data) => {
    return execute(
      () => productService.create(data),
      () => fetchProducts()
    );
  }, [execute, fetchProducts]);

  const updateProduct = useCallback(async (id, data) => {
    return execute(
      () => productService.update(id, data),
      () => fetchProducts()
    );
  }, [execute, fetchProducts]);

  const deleteProduct = useCallback(async (id) => {
    return execute(
      () => productService.delete(id),
      () => fetchProducts()
    );
  }, [execute, fetchProducts]);

  const setPage = useCallback((page) => {
    fetchProducts({ page });
  }, [fetchProducts]);

  const setSearch = useCallback((search) => {
    setFilters(prev => ({ ...prev, search }));
    fetchProducts({ search, page: 1 });
  }, [fetchProducts]);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    fetchProducts({ [key]: value, page: 1 });
  }, [fetchProducts]);

  return {
    products,
    pagination,
    filters,
    loading,
    error,
    // Actions
    fetchProducts,
    getProductById,
    getProductByBarcode,
    createProduct,
    updateProduct,
    deleteProduct,
    // Pagination & Filters
    setPage,
    setSearch,
    setFilter
  };
}

export default useProducts;
