/**
 * useParties Hook
 * Party (Cari) verilerini yönetir
 */
import { useState, useCallback } from 'react';
import { partyService } from '../services';
import useApi from './useApi';

export function useParties(initialParams = {}) {
  const [parties, setParties] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState(initialParams);
  const { loading, error, execute } = useApi();

  const fetchParties = useCallback(async (params = {}) => {
    const mergedParams = { ...filters, ...params };
    
    return execute(
      () => partyService.getAll(mergedParams),
      (response) => {
        setParties(response.data || []);
        setPagination({
          page: response.page || 1,
          pageSize: response.page_size || 10,
          total: response.total || 0,
          totalPages: response.total_pages || 0
        });
      }
    );
  }, [filters, execute]);

  const getPartyById = useCallback(async (id) => {
    return execute(() => partyService.getById(id));
  }, [execute]);

  const getPartyBalance = useCallback(async (id) => {
    return execute(() => partyService.getBalance(id));
  }, [execute]);

  const getPartyTransactions = useCallback(async (id, params = {}) => {
    return execute(() => partyService.getTransactions(id, params));
  }, [execute]);

  const createParty = useCallback(async (data) => {
    return execute(
      () => partyService.create(data),
      () => fetchParties() // Refresh list after create
    );
  }, [execute, fetchParties]);

  const updateParty = useCallback(async (id, data) => {
    return execute(
      () => partyService.update(id, data),
      () => fetchParties() // Refresh list after update
    );
  }, [execute, fetchParties]);

  const deleteParty = useCallback(async (id) => {
    return execute(
      () => partyService.delete(id),
      () => fetchParties() // Refresh list after delete
    );
  }, [execute, fetchParties]);

  const setPage = useCallback((page) => {
    fetchParties({ page });
  }, [fetchParties]);

  const setSearch = useCallback((search) => {
    setFilters(prev => ({ ...prev, search }));
    fetchParties({ search, page: 1 });
  }, [fetchParties]);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    fetchParties({ [key]: value, page: 1 });
  }, [fetchParties]);

  return {
    parties,
    pagination,
    filters,
    loading,
    error,
    // Actions
    fetchParties,
    getPartyById,
    getPartyBalance,
    getPartyTransactions,
    createParty,
    updateParty,
    deleteParty,
    // Pagination & Filters
    setPage,
    setSearch,
    setFilter
  };
}

export default useParties;
