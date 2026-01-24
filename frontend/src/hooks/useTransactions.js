/**
 * useTransactions Hook
 * Finansal işlem verilerini yönetir
 */
import { useState, useCallback } from 'react';
import { transactionService } from '../services';
import useApi from './useApi';

export function useTransactions(initialParams = {}) {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState(initialParams);
  const { loading, error, execute } = useApi();

  const fetchTransactions = useCallback(async (params = {}) => {
    const mergedParams = { ...filters, ...params };
    
    return execute(
      () => transactionService.getAll(mergedParams),
      (response) => {
        setTransactions(response.data || response.transactions || []);
        setPagination({
          page: response.page || 1,
          pageSize: response.per_page || 20,
          total: response.total || 0,
          totalPages: response.total_pages || 0
        });
      }
    );
  }, [filters, execute]);

  const getTransactionByCode = useCallback(async (code) => {
    return execute(() => transactionService.getByCode(code));
  }, [execute]);

  const createTransaction = useCallback(async (data) => {
    return execute(
      () => transactionService.create(data),
      () => fetchTransactions()
    );
  }, [execute, fetchTransactions]);

  const voidTransaction = useCallback(async (code) => {
    return execute(
      () => transactionService.void(code),
      () => fetchTransactions()
    );
  }, [execute, fetchTransactions]);

  const setPage = useCallback((page) => {
    fetchTransactions({ page });
  }, [fetchTransactions]);

  const setDateRange = useCallback((startDate, endDate) => {
    setFilters(prev => ({ ...prev, start_date: startDate, end_date: endDate }));
    fetchTransactions({ start_date: startDate, end_date: endDate, page: 1 });
  }, [fetchTransactions]);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    fetchTransactions({ [key]: value, page: 1 });
  }, [fetchTransactions]);

  const setTypeFilter = useCallback((typeCode) => {
    setFilters(prev => ({ ...prev, type_code: typeCode }));
    fetchTransactions({ type_code: typeCode, page: 1 });
  }, [fetchTransactions]);

  return {
    transactions,
    pagination,
    filters,
    loading,
    error,
    // Actions
    fetchTransactions,
    getTransactionByCode,
    createTransaction,
    voidTransaction,
    // Pagination & Filters
    setPage,
    setDateRange,
    setFilter,
    setTypeFilter
  };
}

export default useTransactions;
