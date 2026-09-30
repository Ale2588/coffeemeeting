import { useEffect, useState } from "react";
import { ApiError, fetchCatalog, type Catalog } from "../lib/api";

type CatalogState = { catalog: Catalog | null; error: string | null };

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ catalog: null, error: null });
  useEffect(() => {
    let alive = true;
    fetchCatalog()
      .then((catalog) => alive && setState({ catalog, error: null }))
      .catch((e: unknown) =>
        alive && setState({ catalog: null, error: e instanceof ApiError ? e.message : "Impossibile caricare zone e orari." }),
      );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
