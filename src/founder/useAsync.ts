import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";

/** Carica dati con stato di caricamento ed errore; `reload` li ricarica. */
export function useAsync<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const value = await load();
      setData(value);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossibile caricare i dati.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
