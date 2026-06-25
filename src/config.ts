/**
 * Static SDK configuration.
 *
 * Responses are authenticated with an EdDSA-signed token that arrives as a URL
 * query param; the verifying key is fetched from a well-known JWKS endpoint and
 * selected by `kid`. So there is no API key and no runtime `configure()` step —
 * everything here is baked in at build time (overridable via Vite env vars).
 *
 * ASSUMPTIONS TO CONFIRM against the real API — change here if they differ:
 *   1. The signed token arrives in the `vy_token` query param (TOKEN_PARAM).
 *   2. The JWKS lives at `/.well-known/jwks.json` under the API origin (JWKS_URL).
 *   3. The token is a compact EdDSA JWT with `kid` in its header — this one is
 *      enforced (and documented) in token.ts, not configurable here.
 */

/** API origin. Override at build time with `VITE_VERIFYYOU_API_BASE`. */
export const API_BASE: string =
  import.meta.env.VITE_VERIFYYOU_API_BASE ?? "https://api.verifyyou.io";

/**
 * Connect-service origin the SDK calls to start a flow from a publishable key
 * (`POST /v3/initialize`). Override with `VITE_VERIFYYOU_CONNECT_BASE`; the
 * local default matches connect-service's dev server. The app-fe origin used
 * for the iframe + postMessage check is derived from the URL that endpoint
 * returns, so it is not configured here.
 */
export const CONNECT_BASE: string =
  import.meta.env.VITE_VERIFYYOU_CONNECT_BASE ?? "http://localhost:8090";

/** Well-known JWKS endpoint holding the EdDSA public keys (by `kid`). */
export const JWKS_URL: string =
  import.meta.env.VITE_VERIFYYOU_JWKS_URL ??
  `${API_BASE}/.well-known/jwks.json`;

/** Query-string parameter the signed token arrives in. */
export const TOKEN_PARAM = "vy_token";

/** How long a fetched JWKS is trusted before a refresh, in milliseconds. */
export const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

/** Default network timeout for SDK requests, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 10_000;
