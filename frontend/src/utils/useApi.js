import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Fetches `path` whenever it (or `query`) changes. While refetching, the previous data is kept
 * so views can dim instead of flashing a skeleton; `dataPath` says which path that data came from.
 */
export function useApi(path, query) {
  const [state, setState] = useState({ data: null, dataPath: null, error: null, loading: Boolean(path) });
  const key = path ? `${path}?${JSON.stringify(query || {})}` : null;
  const latest = useRef(key);

  const load = useCallback(async () => {
    if (!key) return;
    latest.current = key;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path, { query });
      if (latest.current === key) setState({ data, dataPath: path, error: null, loading: false });
    } catch (error) {
      if (latest.current === key) setState((s) => ({ ...s, error, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);
  return { ...state, reload: load, setData };
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
