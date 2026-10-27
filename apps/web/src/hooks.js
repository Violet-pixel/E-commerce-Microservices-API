import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

/** Carrega dados de forma assíncrona e expõe estado de carregamento, erro e recarga. */
export const useAsync = (load, deps) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, deps);
  return { data, error, loading, reload, setData };
};

export const useInterval = (fn, ms) => {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
};

/** Estado guardado no navegador. Se o armazenamento falhar (aba anônima, bloqueio), segue só em memória. */
export const useStored = (key, initial) => {
  const read = () => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  };
  const [value, setValue] = useState(read);
  const ref = useRef(value);
  ref.current = value;
  useEffect(() => setValue(read()), [key]);
  // Grava na hora, fora do updater do React: se o componente sair da tela logo depois, o valor não se perde.
  const update = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(ref.current) : next;
      ref.current = resolved;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {}
      setValue(resolved);
    },
    [key]
  );
  return [value, update];
};

/** Atalho de teclado global; ignora quando o foco está num campo de texto (exceto Escape). */
export const useKey = (key, handler) => {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '') || event.target?.isContentEditable;
      if (event.key !== key || (typing && key !== 'Escape') || event.metaKey || event.ctrlKey || event.altKey) return;
      ref.current(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);
};

export const useDebounced = (value, ms = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
};
