/**
 * useCash Hook
 * Kasa verilerini yönetir
 */
import { useState, useCallback } from 'react';
import { cashService } from '../services';
import useApi from './useApi';

export function useCash() {
  const [registers, setRegisters] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const { loading, error, execute } = useApi();

  const fetchRegisters = useCallback(async () => {
    return execute(
      () => cashService.getRegisters(),
      (response) => setRegisters(response)
    );
  }, [execute]);

  const fetchMovements = useCallback(async (params = {}) => {
    return execute(
      () => cashService.getMovements(params),
      (response) => {
        setMovements(response.movements || []);
        setPagination({
          page: response.page || 1,
          pageSize: response.per_page || 20,
          total: response.total || 0,
          totalPages: response.total_pages || 0
        });
      }
    );
  }, [execute]);

  const createMovement = useCallback(async (data) => {
    return execute(
      () => cashService.createMovement(data),
      () => {
        fetchMovements();
        fetchRegisters(); // Kasa bakiyelerini güncelle
      }
    );
  }, [execute, fetchMovements, fetchRegisters]);

  // Kasa bakiyesi hesapla (currency bazında)
  const getRegisterBalance = useCallback((currency = 'TRY') => {
    const register = registers.find(r => r.currency === currency);
    return register?.balance || 0;
  }, [registers]);

  // Tüm kasaların toplam TL karşılığı
  const getTotalBalance = useCallback((exchangeRates = {}) => {
    return registers.reduce((total, register) => {
      if (register.currency === 'TRY') {
        return total + (register.balance || 0);
      } else if (register.currency === 'USD' && exchangeRates.usd) {
        return total + (register.balance || 0) * exchangeRates.usd;
      } else if (register.currency === 'EUR' && exchangeRates.eur) {
        return total + (register.balance || 0) * exchangeRates.eur;
      }
      return total;
    }, 0);
  }, [registers]);

  return {
    registers,
    movements,
    pagination,
    loading,
    error,
    // Actions
    fetchRegisters,
    fetchMovements,
    createMovement,
    // Helpers
    getRegisterBalance,
    getTotalBalance
  };
}

export default useCash;
