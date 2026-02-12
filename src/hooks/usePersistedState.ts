import { useState, useCallback, useEffect } from 'react';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return defaultValue;
      const parsed = JSON.parse(stored);
      // Revive ISO date strings back to Date objects if defaultValue is a Date
      if (defaultValue instanceof Date && typeof parsed === 'string') {
        const date = new Date(parsed);
        return (isNaN(date.getTime()) ? defaultValue : date) as T;
      }
      return parsed;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // sessionStorage full or unavailable
    }
  }, [key, state]);

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  return [state, setPersistedState];
}
