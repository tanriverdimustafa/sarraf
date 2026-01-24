/**
 * useLookups Hook
 * Lookup verilerini yönetir ve cache'ler
 */
import { useState, useEffect, useCallback } from 'react';
import { lookupService } from '../services';

// Global cache - component'ler arası paylaşılır
let globalLookups = null;
let loadingPromise = null;

export function useLookups() {
  const [lookups, setLookups] = useState(globalLookups);
  const [loading, setLoading] = useState(!globalLookups);
  const [error, setError] = useState(null);

  const loadLookups = useCallback(async (force = false) => {
    // Eğer zaten yükleniyor veya cache varsa
    if (!force && globalLookups) {
      setLookups(globalLookups);
      setLoading(false);
      return globalLookups;
    }

    // Eğer başka bir component yüklüyorsa, onu bekle
    if (loadingPromise) {
      const result = await loadingPromise;
      setLookups(result);
      setLoading(false);
      return result;
    }

    setLoading(true);
    setError(null);

    try {
      loadingPromise = lookupService.getAll();
      const data = await loadingPromise;
      globalLookups = data;
      setLookups(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      loadingPromise = null;
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const refresh = useCallback(() => {
    lookupService.clearCache();
    globalLookups = null;
    return loadLookups(true);
  }, [loadLookups]);

  // Helper functions
  const getKaratById = useCallback((id) => {
    return lookups?.karats?.find(k => k.id === id);
  }, [lookups]);

  const getCurrencyById = useCallback((id) => {
    return lookups?.currencies?.find(c => c.id === id);
  }, [lookups]);

  const getPartyTypeById = useCallback((id) => {
    return lookups?.partyTypes?.find(pt => pt.id === id);
  }, [lookups]);

  const getProductTypeById = useCallback((id) => {
    return lookups?.productTypes?.find(pt => pt.id === id);
  }, [lookups]);

  const getPaymentMethodById = useCallback((id) => {
    return lookups?.paymentMethods?.find(pm => pm.id === id);
  }, [lookups]);

  return {
    lookups,
    loading,
    error,
    refresh,
    // Individual lookups
    karats: lookups?.karats || [],
    currencies: lookups?.currencies || [],
    partyTypes: lookups?.partyTypes || [],
    paymentMethods: lookups?.paymentMethods || [],
    productTypes: lookups?.productTypes || [],
    laborTypes: lookups?.laborTypes || [],
    stockStatuses: lookups?.stockStatuses || [],
    transactionTypes: lookups?.transactionTypes || [],
    // Helpers
    getKaratById,
    getCurrencyById,
    getPartyTypeById,
    getProductTypeById,
    getPaymentMethodById
  };
}

export default useLookups;
