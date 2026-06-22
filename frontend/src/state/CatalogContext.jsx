//  InGen Studio — CatalogContext
//
//  Loads the static catalog once (via the CatalogService mock adapter) and shares it. The catalog
//  drives palettes/dropdowns; in Phase 1 it is consumed lightly (e.g. to label available output
//  types) but the provider establishes the pattern for Phase 2 forms.

import { createContext, useContext, useEffect, useState } from 'react';
import { getServices } from '../services/index.js';

/** @type {import('react').Context<{ catalog: any, loading: boolean }>} */
const CatalogContext = createContext({ catalog: null, loading: true });

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getServices()
      .catalog.getCatalog()
      .then((c) => {
        if (!alive) return;
        setCatalog(c);
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return <CatalogContext.Provider value={{ catalog, loading }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useContext(CatalogContext);
}
