/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Código ISO de la moneda (USD, PEN, MXN, COP, EUR…). Por defecto USD. */
  readonly VITE_CURRENCY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
