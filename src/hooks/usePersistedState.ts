import { useState, useCallback, useEffect } from 'react';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
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
