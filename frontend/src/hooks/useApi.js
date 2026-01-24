/**
 * useApi Hook
 * Generic API fetch hook with loading, error states
 */
import { useState, useCallback } from 'react';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall, onSuccess, onError) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall();
      if (onSuccess) {
        onSuccess(result);
      }
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Bir hata oluştu';
      setError(errorMessage);
      if (onError) {
        onError(err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, execute, reset };
}

export default useApi;
