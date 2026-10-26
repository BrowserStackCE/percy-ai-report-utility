import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Project } from "./types";

/** Which Percy product the user is working in. Decides which projects the sidebar offers. */
export type Product = "web" | "app";

const STORAGE_KEY = "percy_report_product";

interface ProductValue {
  product: Product;
  setProduct: (p: Product) => void;
}

const ProductContext = createContext<ProductValue | null>(null);

function read(): Product {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "app" ? "app" : "web";
  } catch {
    return "web";
  }
}

/** Projects of one product. Projects whose kind Percy did not report are kept so nothing disappears. */
export function projectsForProduct(projects: Project[], product: Product): Project[] {
  return projects.filter((p) => p.kind === product || p.kind === "unknown");
}

export function ProductProvider({ children }: { children: ReactNode }) {
  const [product, setState] = useState<Product>(() => read());

  const setProduct = useCallback((p: Product) => {
    setState(p);
    try {
      sessionStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* the choice just won't persist across reloads */
    }
  }, []);

  const value = useMemo(() => ({ product, setProduct }), [product, setProduct]);
  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProduct(): ProductValue {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProduct must be used inside <ProductProvider>");
  return ctx;
}
