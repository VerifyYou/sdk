/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the API origin at build time. Falls back to the prod host. */
  readonly VITE_VERIFYYOU_API_BASE?: string;
  /** Override the connect-service origin (`/v3/initialize`). Falls back to the dev host. */
  readonly VITE_VERIFYYOU_CONNECT_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
